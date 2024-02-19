let dataMode = true
let graphLoaded = false
let scaleFactor = 1
let heuristicLock = false
let toggleSwitches = []; // Add this at the global level
let appState
let showSettings = false;
let graphMover,tableMover


function setup() {
  createCanvas(windowWidth, windowHeight);
  graph = new ViewerGraph();
  textSize(40);
  textAlign(CENTER, CENTER);
  graphMover = new MovementControl(10, height-110,1)
  tableMover = new MovementControl(120, height-110,0)
  let settingsPanel = select('#settingsPanel');
  settingsPanel.mousePressed((e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  select('#settingsPanel').hide(); // Initially hide the settings panel
  appState = {
    scaleFactor: 1,
    heuristicLock: false,
    showSettings: false,
    dataMode: true,
    modeTextShow: true,
    movementControls:false
  };

  addButtons()
  toggleSettingsPanel()

}

function addButtons() {
  new TextField('Viewer Controls');
  new ToggleSwitch('Heuristic Lock', 'heuristicLock', appState);
  new ToggleSwitch('Data Table Show', 'dataMode', appState);
  new ToggleSwitch('On Screen Text', 'modeTextShow', appState);
  new ToggleSwitch('Movement Controls', 'movementControls', appState);
  new ActionButton('Node Display Mode', toggleNodeDisplay)
  new ActionButton('Load Graph From File', loadFromFile)
   new ActionButton('Save Graph To File', saveToFile)
  new ActionButton('Save Graph as Image', saveCanvasWithPrompt)
  new ChangeButton("Zoom Level", decreaseZoom,increaseZoom, "+", "-");
  new ChangeButton("Step Forward or Back", backwardStep, forwardStep, ">", "<");
}

function toggleNodeDisplay(){
   graph.displayMode = (graph.displayMode + 1) % 2
}

function saveToFile(){
  const serializedGraph = serializeGraph(graph);
  // Save the serialized graph to a file
  saveGraphWithPrompt()
}

function backwardStep() {
  graph.undoStep();
}
 
function updateToggleSwitches() {
  toggleSwitches.forEach(toggleSwitch => {
    // Update the state of the toggle switch based on appState
    toggleSwitch.state = toggleSwitch.appState[toggleSwitch.stateKey];
    toggleSwitch.updateSwitchState(); // Reflect this new state visually
  });
}
 
function forwardStep() {
  if(!graph.pathFound){
     graph.executeAStarStep();
  }
 
}

function increaseZoom() {
  scaleFactor +=0.05
}
function decreaseZoom() {
  scaleFactor -=0.05
}
function loadFromFile() {
  document.getElementById('fileInput').click();
  appState.heuristicLock = true
  updateToggleSwitches()
  graphLoaded = true;
}
function draw() {
  background(190);
  graph.display();
  push()
  textSize(20)
  if (appState.modeTextShow) {
    let t = textWidth('EDITOR MODE Weight Lock OFF') * 1.5

    if (appState.heuristicLock) {
      text('VIEWER MODE Heuristic Lock ON', width-t, 20)
    } else {
      text('VIEWER MODE Heuristic Lock OFF',width-t, 20)
    }

  }
  if(appState.movementControls){
    graphMover.display()
    tableMover.display()
  }

  pop()

  if (keyIsDown(SHIFT)) {
    if (keyIsDown(LEFT_ARROW)) {
      graph.dataTableOffsetX += 3;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      graph.dataTableOffsetX -= 3;
    }
    if (keyIsDown(UP_ARROW)) {
      graph.dataTableOffsetY -= 3;
    }
    if (keyIsDown(DOWN_ARROW)) {
      graph.dataTableOffsetY += 3;
    }
  } else {
    if (keyIsDown(LEFT_ARROW)) {
      graph.moveGraphX(-3)
    }
    if (keyIsDown(RIGHT_ARROW)) {
      graph.moveGraphX(3)
    }
    if (keyIsDown(UP_ARROW)) {
      graph.moveGraphY(-3)
    }
    if (keyIsDown(DOWN_ARROW)) {
      graph.moveGraphY(3)
    }
  }
  if (keyIsDown(189)) {
    scaleFactor -= 0.005
  }
  if (keyIsDown(187)) {
    scaleFactor += 0.005
  }
  scaleFactor = constrain(scaleFactor, 0.35, 1.4)

  if (graph.algorithmState == 1) {
    graph.displayData()
  }

}
function serializeGraph(graph) {
  const nodes = graph.nodes.map(node => {
    return {
      value: node.value,
      position: { x: node.position.x, y: node.position.y },
      connections: node.connections.map(connection => ({
        nodeValue: connection.node.value,
        weight: connection.weight
      })),
      heuristic: node.heuristic // Save the heuristic value
    };
  });

  // Include start and end node values
  const startNodeValue = graph.startNode ? graph.startNode.value : null;
  const endNodeValue = graph.endNode ? graph.endNode.value : null;

  return JSON.stringify({ nodes, startNodeValue, endNodeValue });
}

function deserializeGraph(graphData) {
  const data = JSON.parse(graphData);
  const newGraph = new ViewerGraph();

  // Create all nodes, setting heuristics to 0 if undefined
  data.nodes.forEach(nodeData => {
    const newNode = newGraph.addNode(nodeData.value, createVector(nodeData.position.x, nodeData.position.y));
    // Check if heuristic is defined, otherwise default to 0
    newNode.heuristic = typeof nodeData.heuristic !== 'undefined' ? nodeData.heuristic : 0;
  });

  // Recreate connections
  data.nodes.forEach(nodeData => {
    const node = newGraph.findNode(nodeData.value);
    nodeData.connections.forEach(connectionData => {
      const targetNode = newGraph.findNode(connectionData.nodeValue);
      if (!node.isConnected(targetNode)) {
        node.connect(targetNode, connectionData.weight);
      }
    });
  });

  // Set the start and end nodes based on saved values
  if (data.startNodeValue !== null) {
    const startNode = newGraph.findNode(data.startNodeValue);
    if (startNode) newGraph.setStartNode(startNode);
  }
  if (data.endNodeValue !== null) {
    const endNode = newGraph.findNode(data.endNodeValue);
    if (endNode) newGraph.setEndNode(endNode);
  }

  return newGraph;
}

function removeAllButtons() {
  const toggleContainers = selectAll('.toggle-container');
  const actionContainers = selectAll('.action-container');
  const changeContainers = selectAll('.change-button-container')
  const textContainers = selectAll('.text-field-container')

  toggleContainers.forEach(container => container.remove());
  actionContainers.forEach(container => container.remove());
  changeContainers.forEach(container => container.remove());
  textContainers.forEach(container => container.remove());
  // Clear the arrays holding references to the toggle switches and action buttons
  toggleSwitches = [];
}



function saveCanvasWithPrompt() {
  // Prompt the user for a filename
  let filename = prompt("Enter a filename for your image:", "myGraph");

  // Check if the user entered a filename or pressed Cancel
  if (filename) {
    // If a filename was provided, save the canvas as a PNG with that filename
    saveCanvas(filename, 'png');
  } else {
    // If no filename was provided (Cancel was pressed), do not save the canvas
    console.log("Save cancelled by user.");
  }
}

function mousePressed() {
  let mousePos = createVector(mouseX / scaleFactor, mouseY / scaleFactor);
  let clickedNode = null;

  let heuristicClicked = false;

  // Check if any node's heuristic circle was clicked
  graph.nodes.forEach(node => {
    let heuristicCirclePos = createVector(node.position.x, node.position.y - 65); // Position of heuristic circle
    if (dist(mousePos.x, mousePos.y, heuristicCirclePos.x, heuristicCirclePos.y) <= 15) { // Radius of heuristic circle is 15
      heuristicClicked = true;

      clickedNode = node;
    }
  });

  if (heuristicClicked && appState.heuristicLock) {
    // If heuristicLock is true, prompt the user to input a new heuristic value
    let newHeuristic = prompt("Enter new heuristic value for node " + clickedNode.value + ":", clickedNode.heuristic);
    if (newHeuristic !== null && !isNaN(newHeuristic)) {
      clickedNode.heuristic = parseInt(newHeuristic, 10);
    }
    return; // Prevent further actions if heuristic circle was clicked
  }
  // Check if any node was clicked
  graph.nodes.forEach(node => {
    if (dist(mousePos.x, mousePos.y, node.position.x, node.position.y) < 50 * scaleFactor) {
      clickedNode = node;
    }
  });

  if (clickedNode) {
    if (keyIsDown(SHIFT)) {
      // If shift is held, set the clicked node as the end node and highlight the path
      graph.setEndNode(clickedNode);
      //graph.displayPath(); // Assuming this method calculates and visually highlights the path
    } else {
      // Regular click behavior (e.g., setting as start node)
      graph.setStartNode(clickedNode);
      graph.initializeDijkstra(clickedNode.value);
    }
  }
}


function loadGraph(event) {

  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      // Clear the current graph before loading a new one
      graph.clearGraph();

      // Parse the loaded JSON string
      const graphData = JSON.parse(e.target.result);

      // Deserialize the new graph data
      graph = deserializeGraph(graphData);

      // Reset the file input to ensure the change event fires even if the same file is selected again
      event.target.value = '';

      // Additional state resets as needed
      graphLoaded = true;
      resetGraphState(); // Reset other graph-related states as necessary
    };
    reader.readAsText(file);
  }
}


function resetGraphState() {
  // Reset any graph-related state here, such as algorithmState, dijkstraResults, etc.
  graph.algorithmState = null;
  graph.dijkstraResults = null;
  // Reset or reinitialize any other state variables that need to be cleared when a new graph is loaded
}


function toggleSettingsPanel() {
  showSettings = !showSettings;
  const settingsPanel = select('#settingsPanel');
  if (showSettings) {
    settingsPanel.show();
    // Ensure all toggle-container elements are visible
    selectAll('.toggle-container').forEach(container => {
      container.style('display', 'flex');
    });
  } else {
    settingsPanel.hide();
  }
}


function keyPressed() {
  if (keyCode == 32) {
    toggleSettingsPanel()

  }
  if (keyCode == 190 && !graph.pathFound) { // '>' key for stepping forward in A*
    graph.executeAStarStep();
  } else if (keyCode == 188) { // '<' key for stepping backward in A*
    graph.undoStep(); // Make sure this method supports A* logic
  }

  // if (keyCode == 13) {
  //   saveCanvasWithPrompt();
  // } else if (key == 'p') { // 
  //   document.getElementById('fileInput').click();
  //   graphLoaded = true;
  // } else if (keyCode == 190) { // '>' key for stepping forward in A*
  //   graph.executeAStarStep();
  // } else if (keyCode == 188) { // '<' key for stepping backward in A*
  //   graph.undoStep(); // Make sure this method supports A* logic
  // } else if (key === 's' || key === 'S') {
  //   saveCanvas('graph', 'png');
  // } else if (key == 'd' || key == 'D') {
  //   //dataMode = !dataMode;
  // } else if (key == '9') {
  //   heuristicLock=!heuristicLock
  // } else if (key == '8') {
  //   graph.displayMode = (graph.displayMode + 1) % 2
  // } else if (key == 'P' || key == 'p') { // Check for 'P' key press
  //   const serializedGraph = serializeGraph(graph);
  //   // Save the serialized graph to a file
  //   saveGraphWithPrompt()
  // }
}

function saveGraphWithPrompt() {
  // Prompt the user for a filename, with "AstarGraph" as the default
  let filename = prompt("Enter a filename for your graph:", "AstarGraph");

  if (filename) {
    // If a filename was provided, append ".json" extension if not already present
    if (!filename.endsWith(".json")) {
      filename += ".json";
    }
    const serializedGraph = serializeGraph(graph);
    // Save the serialized graph to a file using the provided filename
    saveJSON(serializedGraph, filename);
  } else {
    // If no filename was provided (Cancel was pressed), do not save the graph
    console.log("Save cancelled by user.");
  }
}
