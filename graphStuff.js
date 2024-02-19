

class ViewerNode {
  constructor(value, position) {
    this.value = value;
    this.position = position;
    this.connections = [];
    this.selected = false;
    this.isStartNode = false; // Add this line;
    this.isEndNode = false; // Add this line
    this.processing = false; // Indicates if the node is currently being processed
    this.visited = false; // Indicates if the node has
    this.dist = Infinity;
    this.prev = null;
    this.heuristic = 0;
  }

  // Method to calculate the Euclidean distance as the heuristic
  calculateHeuristic(endNode) {
    if(graph.endNode!=null && appState.heuristicLock==false){
      const dx = this.position.x - endNode.position.x;
      const dy = this.position.y - endNode.position.y;

      this.heuristic = floor(Math.sqrt(dx * dx + dy * dy) / 10);
    }

  }

  
  connect(node, weight = null) {
    const connectionExists = this.connections.some(conn => conn.node === node);
    if (!connectionExists) {
      // Calculate weight based on distance if not provided
      if (weight === null) {
        weight = this.calculateWeight(node);
      }
      this.connections.push({ node: node, weight: weight });
      node.connections.push({ node: this, weight: weight }); // Also update the reciprocal connection
    }
  }



  getAdjacentNodes() {
    return this.connections.map(connection => connection.node);
  }

  isConnected(node) {
    return this.connections.some(connection => connection.node === node);
  }

  // Optional: Method to get the connection weight between this node and another node
  getWeight(node) {
    const connection = this.connections.find(connection => connection.node === node);
    return connection ? connection.weight : null;
  }
}

class ViewerGraph {
  constructor() {
    this.nodes = [];
    this.history = [];
    this.startNode = null;
    this.endNode = null
    this.dijkstraResults = null;
    this.algorithmState = null; // Object to hold state information
    this.dijkstraQueue = []; // This will act as a priority queue for the algorithm
    this.dijkstraVisited = new Set(); // Keeps track of visited nodes
    this.dijkstraDistances = {}; // Keeps track of distances
    this.dijkstraPrevious = {}; // Keeps track of previous nodes in the path
    this.dataTableOffsetX = 595; // Initial offset for the data table
    this.dataTableOffsetY = 40; // Initial Y position for the data tabl
    this.neighbourInfoShow = false;
    this.pathFound = false
    this.displayMode = 1
  }

  toggleNeighbourInfoShow() {
    this.neighbourInfoShow = !this.neighbourInfoShow;
    this.display(); // Assuming this method will eventually call `displayData`
  }

  saveState() {
    const nodesState = this.nodes.map(node => ({
      value: node.value,
      dist: node.dist, // G cost
      prev: node.prev ? node.prev.value : null, // Save prev node's value
      visited: node.visited,
      processing: node.processing,
      heuristic: node.heuristic,
      // Save heuristic value
      // Optionally, save F cost, but it can be derived from dist and heuristic
    }));

    const state = {
      pathFound:this.pathfound,
      nodesState: nodesState,
      dijkstraQueue: this.dijkstraQueue.map(item => ({ ...item })), // Deep copy of the queue
      dijkstraVisited: new Set(this.dijkstraVisited), // Copy of the visited set
      // No need to save dijkstraDistances and dijkstraPrevious separately if they are already captured in nodesState
    };
    // console.log('pushing', state)
    this.history.push(state);
  }

  moveGraphY(dy) {
    this.nodes.forEach(node => {
      node.position.y += dy;
    });
  }

  moveGraphX(dx) {
    this.nodes.forEach(node => {
      node.position.x += dx;
    });
  }

  undoStep() {
    // console.log('undostep')
    if (this.history.length > 0) {
      const prevState = this.history.pop(); // Retrieve the last saved state

      // Clear the current algorithm state
      this.dijkstraQueue = [];
      this.dijkstraVisited.clear();
      this.pathFound = false

      // Restore the queue and visited nodes
      prevState.dijkstraQueue.forEach(item => {
        this.dijkstraQueue.push({ ...item });
      });
      prevState.dijkstraVisited.forEach(visitedNodeValue => {
        this.dijkstraVisited.add(visitedNodeValue);
      });

      // Restore each node's state, including distance (G cost), previous node, and heuristic
      this.nodes.forEach(node => {
        const savedNodeState = prevState.nodesState.find(n => n.value === node.value);
        if (savedNodeState) {
          node.dist = savedNodeState.dist; // G cost
          node.prev = savedNodeState.prev ? this.findNode(savedNodeState.prev) : null;
          node.visited = savedNodeState.visited;
          node.processing = savedNodeState.processing;
          // Heuristic value is recalculated instead of restored to ensure consistency with the current end node
          node.calculateHeuristic(this.endNode);
        }
      });

      // Note: There's no need to restore F cost directly since it's derived from G cost and heuristic,
      // but ensure the priority queue is correctly updated based on the restored states.
    }
  }



  initializeDijkstra(startNodeValue) {
    // Reset the algorithm's state
    this.algorithmState = 1
    this.dijkstraQueue = []; // Start with an empty queue
    this.dijkstraVisited.clear();
    this.nodes.forEach(node => {
      // Reset distances and previous nodes for all nodes
      this.dijkstraDistances[node.value] = Infinity;
      this.dijkstraPrevious[node.value] = null;
      // Reset node-specific states
      node.dist = Infinity;
      node.prev = null;
      node.processing = false;
      node.visited = false;
    });

    // Ensure the start node's distance is set to 0 correctly
    const startNode = this.findNode(startNodeValue);
    if (startNode) {
      startNode.dist = 0; // Set start node's own distance to 0
      startNode.processing = true; // Optionally mark it as processing if needed for visual cues
      // Update global trackers
      this.dijkstraDistances[startNodeValue] = 0;
      // Add start node to the queue with a priority of 0
      this.dijkstraQueue.push({ node: startNodeValue, priority: 0 });
    } else {
       console.error("Start node not found:", startNodeValue);
      return; // Exit if start node is not found to avoid further errors
    }

    // console.log('Initialization complete with start node:', startNodeValue);
  }


  clearGraph() {
    this.nodes = [];
    this.draggedNode = null;
    this.selectedNode = null;
    this.startNode = null;
    this.endNode = null;
    this.dijkstraResults = null;
  }


  // In the Graph class
  setStartNode(node) {
    // Deselect any previous start node visually and logically
    if (this.startNode) {
      this.startNode.isStartNode = false;
    }
    // Set and mark the new start node
    this.startNode = node;
    node.isStartNode = true;

    // Initialize Dijkstra's algorithm with the new start node's value
    this.initializeDijkstra(node.value);
  }

  setEndNode(node) {
    // Deselect any previous end node visually and logically
    if (this.endNode) {
      this.endNode.isEndNode = false;
    }
    // Set and mark the new end node
    this.endNode = node;
    node.isEndNode = true;

    // Important: Recalculate heuristics for all nodes based on the new end node
    this.nodes.forEach(n => n.calculateHeuristic(node));
  }
  // Method to initialize A* search, which will be similar to initializeDijkstra but considering heuristics
  initializeAStar(startNodeValue) {
    // Reset the algorithm's state
    this.algorithmState = 1; // Assuming this indicates A* is running
    this.dijkstraQueue = []; // Using the same queue, but for A*
    this.dijkstraVisited.clear();
    this.nodes.forEach(node => {
      node.dist = Infinity;
      node.prev = null;
      node.processing = false;
      node.visited = false;
      // Initialize node.heuristic if not already done
    });

    const startNode = this.findNode(startNodeValue);
    if (startNode && this.endNode) {
      startNode.dist = 0;
      startNode.heuristic = startNode.calculateHeuristic(this.endNode); // Make sure heuristic is updated
      // Priority is now the sum of dist and heuristic
      this.dijkstraQueue.push({ node: startNodeValue, priority: startNode.heuristic });
    } else {
      console.error("Start or End node not found.");
    }
  }


  // Method to execute a step of A* search
  executeAStarStep() {
    this.saveState();
    // Similar structure to executeStep but considering heuristic
    if (this.dijkstraQueue.length === 0) {
      console.log("A* algorithm has finished executing.");
      return;
    }

    this.dijkstraQueue.sort((a, b) => a.priority - b.priority);
    const current = this.dijkstraQueue.shift();
    const currentNode = this.findNode(current.node);
    // Check if the current node is the end node
    if (currentNode === this.endNode) {
      console.log("End node reached. Path found.");
      this.pathFound = true
      // this.displayPath(); // Assuming this method is responsible for displaying the path
      // this.algorithmState = null; // Or any other state to indicate completion
      // return; // Stop further processing
    }
    if (!this.dijkstraVisited.has(currentNode.value)) {
      currentNode.processing = true;

      currentNode.connections.forEach(connection => {
        const neighbor = connection.node;
        const newDist = currentNode.dist + connection.weight;
        const newPriority = newDist + neighbor.heuristic; // dist + heuristic

        if (newDist < neighbor.dist) {
          neighbor.dist = newDist;
          neighbor.prev = currentNode;
          // Update or add neighbor in the queue with new priority
          const index = this.dijkstraQueue.findIndex(item => item.node === neighbor.value);
          if (index !== -1) this.dijkstraQueue.splice(index, 1);
          this.dijkstraQueue.push({ node: neighbor.value, priority: newPriority });
        }
      });

      currentNode.processing = false;
      currentNode.visited = true;
      this.dijkstraVisited.add(currentNode.value);
    }
  }





  // Connect two nodes by their values
  connectNodes(value1, value2) {
    const node1 = this.findNode(value1);
    const node2 = this.findNode(value2);
    if (node1 && node2) {
      node1.connect(node2);
    } else {
      console.error("One or both nodes not found");
    }
  }
  // Method to add a node to the graph
  addNode(value, position) {
    const newNode = new ViewerNode(value, position);
    this.nodes.push(newNode);
    return newNode; // Return the new node for reference
  }

  setStartNode(node) {
    if (this.startNode === node) {
      this.startNode.isStartNode = false; // Deselect the node
      this.startNode = null; // Clear the reference
    } else {
      if (this.startNode) {
        this.startNode.isStartNode = false; // Reset previous start node
      }
      this.startNode = node;
      node.isStartNode = true; // Mark new start node
    }
  }




  // Find a node by its value
  findNode(value) {
    return this.nodes.find(node => node.value === value);
  }


  displayData() {
    if (!appState.dataMode) return; // Exit if dataMode is not enabled
     this.nodes.sort((a, b) => (a.dist+a.heuristic) === Infinity ? 1 : (b.dist+b.heuristic) === Infinity ? -1 : (a.dist+a.heuristic) - (b.dist+b.heuristic));
    //this.nodes.sort((a, b) => a.dist === Infinity ? 1 : b.dist === Infinity ? -1 : a.dist - b.dist);
    push(); // Start a new drawing state
    strokeWeight(1);
    textFont('Tahoma');
    textSize(22);
    let startX = width - this.dataTableOffsetX; // Adjusted starting X position based on offset
    let startY = this.dataTableOffsetY; // Starting Y position from class property
    let rowHeight = 35; // Height of each row

    // Define columns
    let columns = [
      { title: "NODE", width: 75 },
      { title: "VISITED", width: 100 },
      { title: "PARENT", width: 100 },
      { title: "G COST", width: 100 },
      { title: "H COST", width: 100 }, // Heuristic column
      { title: "F COST", width: 100 } // F Cost column
    ];

    // Display table headers
    columns.forEach(col => {
      fill(0); // Black background for headers
      rect(startX, startY, col.width, rowHeight);
      fill(255); // White text for headers
      textAlign(CENTER, CENTER);
      text(col.title, startX + col.width / 2, startY + rowHeight / 2);
      startX += col.width; // Move to the next column position for the next header
    });

    // Adjust startY for the first row of data
    startY += rowHeight;

    // Display data for each node
    this.nodes.forEach(node => {
      startX = width - this.dataTableOffsetX; // Reset startX for each row

      // Determine if the current node is in the open set (dijkstraQueue)
      const isInOpenSet = this.dijkstraQueue.some(queueItem => queueItem.node === node.value);

      // Set fillColor based on node state
      let fillColor;
      if (node.visited) {
        fillColor = '#ffb6c1'; // Visited nodes
      } else if (isInOpenSet) {
        fillColor = '#98FB98'; // Nodes in the open set
      } else {
        fillColor = '#ADD8E6'; // Default color for nodes
      }

      columns.forEach(col => {
        fill(fillColor); // Use determined fill color for row background
        rect(startX, startY, col.width, rowHeight);
        fill(0); // Black text for data

        let data = '';
        switch (col.title) {
          case "NODE":
            data = node.value;
            break;
          case "G COST":
            data = node.dist === Infinity ? "∞" : node.dist.toString();
            break;
          case "PARENT":
            data = node.prev ? node.prev.value : "None";
            break;
          case "VISITED":
            data = node.visited ? "Yes" : "No";
            break;
          case "H COST":
            data = node.heuristic === Infinity ? "∞" : node.heuristic.toString();
            break;
          case "F COST":
            let fCost = node.dist + node.heuristic;
            data = fCost === Infinity ? "∞" : fCost.toString();
            break;
        }

        textAlign(CENTER, CENTER);
        text(data, startX + col.width / 2, startY + rowHeight / 2);
        startX += col.width; // Move to the next column position for the next data
      });

      startY += rowHeight; // Move to the next row position for the next node
    });

    pop(); // Restore original drawing state
  }

  // display() {
 

  // }
  overlayHeuristic(){
    this.nodes.forEach(node => {
      push()
      stroke(0);
      strokeWeight(3);
      circle(node.position.x, node.position.y,10)
      line(node.position.x, node.position.y, this.endNode.position.x, this.endNode.position.y);
      circle(this.endNode.position.x, this.endNode.position.y,10)
    

   
      pop()
    })
    this.nodes.forEach(node => {
      push()
      stroke(0);
      strokeWeight(3);

      textAlign(CENTER,CENTER)
      fill(0);
      let midX = (node.position.x + this.endNode.position.x) / 2;
      let midY = (node.position.y + this.endNode.position.y) / 2;
      stroke(0)
      strokeWeight(3);
      ellipse(midX, midY, 40); // Background ellipse for heuristic value

      fill(255);
      textSize(16);
      strokeWeight(0.5)
      text(node.heuristic, midX, midY);
      pop()
    })
  }


  display() {
    if(this.displayMode==0){
      if (keyIsPressed && key === 'h' && graph.endNode!=null) {
        push()
        scale(scaleFactor)
        textAlign(CENTER, CENTER)
        this.nodes.forEach(node => {
          push()
          stroke(0);
          strokeWeight(3);

          line(node.position.x, node.position.y, this.endNode.position.x, this.endNode.position.y);

          let midX = (node.position.x + this.endNode.position.x) / 2;
          let midY = (node.position.y + this.endNode.position.y) / 2;

          fill('white');

          stroke(0)
          strokeWeight(3);
          ellipse(midX, midY, 40, 25); // Background ellipse for heuristic value

          fill('black');
          textSize(16);
          strokeWeight(0.5)
          text(node.heuristic, midX, midY);
          pop()
          let fillColor = '#ADD8E6'; // Default color for nodes

          if (node.visited) {
            fillColor = '#ffb6c1'; // Visited nodes
          }

          const isInQueue = this.dijkstraQueue.some(queueItem => queueItem.node === node.value);
          if (isInQueue && !node.visited) {
            fillColor = '#98FB98'; // Pale green for nodes in the queue
          }
          if (graph.algorithmState != 1 && node.isStartNode) {

            fillColor = 'green'; // Start node

          }

          if (node.isStartNode) {
            push()
            fill(fillColor);
            stroke('green')
            strokeWeight(7)
            ellipse(node.position.x, node.position.y, 100);
            pop()
          } else if (node.isEndNode) {
            push()
            fill(fillColor);
            stroke('red')
            strokeWeight(7)
            ellipse(node.position.x, node.position.y, 100);
            pop()
          } else {
            push()
            fill(fillColor);
            strokeWeight(5)
            ellipse(node.position.x, node.position.y, 100); // Draw node
            pop()
          }
          //  fill(fillColor);

          if (this.algorithmState == 1) {
            // if(node.dist === Infinity){
            //   textSize(60)
            // }else{

            // }
            let infoText1 = node.dist === Infinity ? "∞" : node.dist.toString();
            let infoText2 = (node.prev && node.prev.value) ? node.prev.value : "None";


            push()
            textSize(20)
            if (node.dist === Infinity) {
              textSize(30)
            }

            text(infoText1, node.position.x, node.position.y + 10);
            textSize(20); // For distance and parent info
            text(infoText2, node.position.x, node.position.y + 30);
            textSize(45)
            // Node value and Dijkstra's path information
            push()
            fill(0); // Text color
            textSize(50)
            text(node.value, node.position.x, node.position.y - 20);
            pop()
            pop();
            push()
            fill(0)
            noStroke()
            //circle(node.position.x, node.position.y - 60, 30)
            stroke(1)
            fill(255)
            //text(node.heuristic, node.position.x, node.position.y - 60)
            pop()
          } else {

            textSize(60)
            // Node value and Dijkstra's path information
            push()
            fill(0); // Text color
            textSize(50)
            text(node.value, node.position.x, node.position.y);
            pop()
          }




        })
        fill('#ADD8E6')
        circle(graph.endNode.position.x, graph.endNode.position.y, 100)
        //fill(255)
        textAlign(CENTER, CENTER)

        textSize(50)
        fill(0)
        text(graph.endNode.value, graph.endNode.position.x, graph.endNode.position.y)
        pop()
      } else {
        push()
        scale(scaleFactor)
        if (this.pathFound) {
          this.displayPath();
        }
        if (this.algorithmState == 1 && this.endNode != null && graph.dijkstraQueue.length == 0) {
          this.displayPath();
        }
        strokeWeight(1);
        textAlign(CENTER, CENTER);
        // Draw connections
        this.nodes.forEach(node => {
          node.connections.forEach(connection => {

            strokeWeight(1);
            line(node.position.x, node.position.y, connection.node.position.x, connection.node.position.y);

            // Drawing weight
            push();
            fill(190); // Background color for weight text
            noStroke();
            ellipse((node.position.x + connection.node.position.x) / 2, (node.position.y + connection.node.position.y) / 2, 30);
            pop();
            textSize(17);
            fill(0); // Text color for weight
            stroke(0);
            strokeWeight(1);
            text(connection.weight, (node.position.x + connection.node.position.x) / 2, (node.position.y + connection.node.position.y) / 2);
          });
        });

        // Draw nodes
        this.nodes.forEach(node => {
          let fillColor = '#ADD8E6'; // Default color for nodes

          if (node.visited) {
            fillColor = '#ffb6c1'; // Visited nodes
          }

          const isInQueue = this.dijkstraQueue.some(queueItem => queueItem.node === node.value);
          if (isInQueue && !node.visited) {
            fillColor = '#98FB98'; // Pale green for nodes in the queue
          }
          if (graph.algorithmState != 1 && node.isStartNode) {
    
            fillColor = 'green'; // Start node

          }

          if (node.isStartNode) {
            push()
            fill(fillColor);
            stroke('green')
            strokeWeight(7)
            ellipse(node.position.x, node.position.y, 100);
            pop()
          } else if (node.isEndNode) {
            push()
            fill(fillColor);
            stroke('red')
            strokeWeight(7)
            ellipse(node.position.x, node.position.y, 100);
            pop()
          } else {
            push()
            fill(fillColor);
            strokeWeight(5)
            ellipse(node.position.x, node.position.y, 100); // Draw node
            pop()
          }
          //  fill(fillColor);
           textSize(20)
          if (this.algorithmState == 1) {
            // if(node.dist === Infinity){
            //   textSize(60)
            // }else{

            // }
            let infoText1 = node.dist === Infinity ? "∞" : node.dist.toString();
            infoText1 = 'G:'+infoText1
            let infoText2 = (node.prev && node.prev.value) ? node.prev.value : "None";
            textAlign(LEFT)

            push()

            // if (node.dist === Infinity) {
            //   textSize(30)
            // }
             textSize(15)
            //F
            push()
            textFont('courier')
            let fCost = 'F:'+((node.heuristic+node.dist)*1)
              fCost = node.dist === Infinity ? "F:∞" :fCost
            //fCost 
            text(infoText1, node.position.x, node.position.y -15);
            //H
            //text('H:'+node.heuristic, node.position.x-10, node.position.y -8);
            text(fCost, node.position.x, node.position.y +5);
            textFont('Tahoma');
            textSize(50)
            // Node value and Dijkstra's path information
            fill(0); // Text color
            text(node.value, node.position.x-39, node.position.y );
            pop();
            push()
            textSize(20); // For distance and parent info
            text(infoText2, node.position.x-20, node.position.y + 30);
            fill(0)
            noStroke()
            circle(node.position.x, node.position.y - 65, 30)
            stroke(1)
            fill(255)
            textAlign(CENTER,CENTER)
            text(node.heuristic, node.position.x, node.position.y - 65)
            pop()
          } else {

            textSize(60)
            // Node value and Dijkstra's path information
            fill(0); // Text color
            text(node.value, node.position.x, node.position.y);
          }

        });


        pop()
      }
    }else{
      if (keyIsPressed && key === 'h' && graph.endNode!=null) {
        push()
        scale(scaleFactor)
        textAlign(CENTER, CENTER)
  
        this.nodes.forEach(node => {
 
          let fillColor = '#ADD8E6'; // Default color for nodes

          if (node.visited) {
            fillColor = '#ffb6c1'; // Visited nodes
          }

          const isInQueue = this.dijkstraQueue.some(queueItem => queueItem.node === node.value);
          if (isInQueue && !node.visited) {
            fillColor = '#98FB98'; // Pale green for nodes in the queue
          }
          if (graph.algorithmState != 1 && node.isStartNode) {

            fillColor = 'green'; // Start node

          }

          if (node.isStartNode) {
            push()
            fill(fillColor);
            stroke('green')
            strokeWeight(7)
            ellipse(node.position.x, node.position.y, 100);
            pop()
          } else if (node.isEndNode) {
            push()
            fill(fillColor);
            stroke('red')
            strokeWeight(7)
            ellipse(node.position.x, node.position.y, 100);
            pop()
          } else {
            push()
            fill(fillColor);
            strokeWeight(5)
            ellipse(node.position.x, node.position.y, 100); // Draw node
            pop()
          }
          //  fill(fillColor);

          if (this.algorithmState == 1) {
            // if(node.dist === Infinity){
            //   textSize(60)
            // }else{

            // }
            let infoText1 = node.dist === Infinity ? "∞" : node.dist.toString();
            let infoText2 = (node.prev && node.prev.value) ? node.prev.value : "None";


            push()
            textSize(20)
            if (node.dist === Infinity) {
              textSize(30)
            }

            text(infoText1, node.position.x, node.position.y + 10);
            textSize(20); // For distance and parent info
            text(infoText2, node.position.x, node.position.y + 30);
            textSize(45)
            // Node value and Dijkstra's path information
            fill(0); // Text color
            text(node.value, node.position.x, node.position.y - 20);
            pop();
            push()
            fill(0)
            noStroke()
          
            stroke(1)
            fill(255)
       
            pop()
          } else {

            textSize(60)
            // Node value and Dijkstra's path information
            fill(0); // Text color
            text(node.value+'7', node.position.x, node.position.y);
          }




        })
        fill('#ADD8E6')
        circle(graph.endNode.position.x, graph.endNode.position.y, 100)
        //fill(255)
        textAlign(CENTER, CENTER)

        textSize(50)
        fill(0)
        text(graph.endNode.value, graph.endNode.position.x, graph.endNode.position.y)
        pop()
      } else {
        push()
        scale(scaleFactor)
        if (this.pathFound) {
          this.displayPath();
        }
        if (this.algorithmState == 1 && this.endNode != null && graph.dijkstraQueue.length == 0) {
          this.displayPath();
        }
        strokeWeight(1);
        textAlign(CENTER, CENTER);
        // Draw connections
        this.nodes.forEach(node => {
          node.connections.forEach(connection => {

            strokeWeight(1);
            line(node.position.x, node.position.y, connection.node.position.x, connection.node.position.y);

            // Drawing weight
            push();
            fill(190); // Background color for weight text
            noStroke();
            ellipse((node.position.x + connection.node.position.x) / 2, (node.position.y + connection.node.position.y) / 2, 30);
            pop();
            textSize(17);
            fill(0); // Text color for weight
            stroke(0);
            strokeWeight(1);
            text(connection.weight, (node.position.x + connection.node.position.x) / 2, (node.position.y + connection.node.position.y) / 2);
          });
        });

        // Draw nodes
        this.nodes.forEach(node => {
          let fillColor = '#ADD8E6'; // Default color for nodes

          if (node.visited) {
            fillColor = '#ffb6c1'; // Visited nodes
          }

          const isInQueue = this.dijkstraQueue.some(queueItem => queueItem.node === node.value);
          if (isInQueue && !node.visited) {
            fillColor = '#98FB98'; // Pale green for nodes in the queue
          }
          if (graph.algorithmState != 1 && node.isStartNode) {
            //console.log(graph.algorithmState !=1,graph.algorithmState)
            fillColor = 'green'; // Start node

          }

          if (node.isStartNode) {
            push()
            fill(fillColor);
            stroke('green')
            strokeWeight(7)
            ellipse(node.position.x, node.position.y, 100);
            pop()
          } else if (node.isEndNode) {
            push()
            fill(fillColor);
            stroke('red')
            strokeWeight(7)
            ellipse(node.position.x, node.position.y, 100);
            pop()
          } else {
            push()
            fill(fillColor);
            strokeWeight(5)
            ellipse(node.position.x, node.position.y, 100); // Draw node
            pop()
          }
   

          if (this.algorithmState == 1) {
   
            let infoText1 = node.dist === Infinity ? "∞" : node.dist.toString();
            let infoText2 = (node.prev && node.prev.value) ? node.prev.value : "None";


            push()
            textSize(20)
            if (node.dist === Infinity) {
              textSize(30)
            }

            text(infoText1, node.position.x, node.position.y + 10);
            textSize(20); // For distance and parent info
            text(infoText2, node.position.x, node.position.y + 30);
            textSize(50)
            // Node value and Dijkstra's path information
            fill(0); // Text color
            text(node.value, node.position.x, node.position.y - 20);
            pop();
            push()
            fill(0)
            noStroke()
            circle(node.position.x, node.position.y - 65, 30)
            stroke(1)
            fill(255)
            text(node.heuristic, node.position.x, node.position.y - 65)
            pop()
          } else {

            textSize(60)
            // Node value and Dijkstra's path information
            fill(0); // Text color
            text(node.value, node.position.x, node.position.y);
          }

        });


        pop()
      }
    }
    if (keyIsPressed && key === 'h' && graph.endNode!=null){
      this.overlayHeuristic()
    }

  }




  displayPath() {

    let current = this.endNode
    push()
    while (current.prev != null) {
      let from = current.position
      // console.log(current.prev)
      let to = current.prev.position
      strokeWeight(20)
      stroke(0)
      line(from.x, from.y, to.x, to.y)
      strokeWeight(25)
      stroke('blue')
      line(from.x, from.y, to.x, to.y)

      current = current.prev

    }
    pop()



  }




}


class ActionButton {
  constructor(labelText, actionFunction) {
    this.labelText = labelText;
    this.actionFunction = actionFunction;

    this.createElements();
  }

  createElements() {
    this.container = createDiv('').addClass('action-container');
    this.container.style('display', 'flex');
    this.container.style('justify-content', 'space-between');
    this.container.style('align-items', 'center');
    this.container.style('margin-bottom', '10px');
    this.container.style('width', '100%'); // Match the toggle switch container

    this.label = createSpan(this.labelText).parent(this.container);
    this.label.style('margin-right', '10px');

    // Create a button that looks like the toggle switch but doesn't toggle
    this.button = createButton('').parent(this.container);
    this.button.addClass('action-button'); // Use a class to style the button
    this.button.style('background-color', '#ccc'); // Default background
    this.button.style('border', '1px solid black'); // Match toggle switch border
    this.button.style('border-radius', '13.5px'); // Rounded edges
    this.button.style('width', '54px'); // Width to match the toggle switch
    this.button.style('height', '27px'); // Height to match the toggle switch

    this.button.mousePressed(() => {
      this.actionFunction(); // Call the provided action function
      this.button.style('background-color', '#4CD964'); // Change color to green when clicked
      setTimeout(() => {
        this.button.style('background-color', '#ccc'); // Revert to default color after a short delay
      }, 200);
    });

    this.container.parent('#settingsPanel'); // Append to the settings panel
  }
}

class ToggleSwitch {
  constructor(labelText, stateKey, appState) {
    this.labelText = labelText;
    this.stateKey = stateKey; // The key for the variable in appState
    this.appState = appState; // The global state object

    toggleSwitches.push(this); // Add this instance to the array

    this.createElements();
    this.updateSwitchState();
  }
  createElements() {

    this.container = createDiv('').addClass('toggle-container');
    this.container.style('display', 'flex');
    this.container.style('justify-content', 'space-between');
    this.container.style('align-items', 'center');
    this.container.style('margin-bottom', '10px');
    this.container.style('width', '100%'); // Ensure it fills its parent

    this.label = createSpan(this.labelText).parent(this.container);
    this.label.style('margin-right', '10px');

    this.toggle = createDiv('').addClass('toggle-switch').parent(this.container);
    this.knob = createDiv('').addClass('toggle-knob').parent(this.toggle);
    //***********************
    this.toggle.mousePressed((e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleState();
    });
    this.toggle.elt.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleState();
    }, false);
    //************************
    this.toggle.mouseClicked(() => this.toggleState());

    // Ensure the settings panel is initially hidden
    this.container.parent('#settingsPanel');

  }
  toggleState() {
    this.appState[this.stateKey] = !this.appState[this.stateKey];
    this.updateSwitchState();

  }

  updateSwitchState() {
    this.state = this.appState[this.stateKey]; // Update local state based on appState
    if (this.state) {
      this.toggle.addClass('active');
    } else {
      this.toggle.removeClass('active');
    }
  }


}




class ChangeButton {
  constructor(labelText, upFunction, downFunction, downLabel, upLabel) {
    this.labelText = labelText;
    this.upFunction = upFunction;
    this.downFunction = downFunction;
    this.downLabel = downLabel;
    this.upLabel = upLabel;

    this.createElements();
  }

  createElements() {
      // Main container for the label and buttons
      this.container = createDiv('').addClass('change-button-container');
      this.container.style('display', 'flex');
      this.container.style('align-items', 'center');
      this.container.style('justify-content', 'space-between'); // Ensures spacing between label and buttons
      this.container.style('margin-bottom', '10px');
      this.container.style('position', 'relative');
      this.container.style('width', '100%'); // Utilizes full width to position elements
      this.container.parent('#settingsPanel');

      // Label positioned to the left of the buttons
      this.label = createSpan(this.labelText).parent(this.container);
      this.label.style('margin-right', '10px');

      // Pill-shaped container specifically for the buttons
      this.buttonContainer = createDiv('').addClass('pill-container');
      this.buttonContainer.style('display', 'flex');
      this.buttonContainer.style('justify-content', 'space-between');
      this.buttonContainer.style('align-items', 'center');
      this.buttonContainer.style('position', 'absolute');
      this.buttonContainer.style('right', '0px'); // Positions the container 5px from the right
      this.buttonContainer.style('width', '53px'); // Adjusted width to match other controls
      this.buttonContainer.style('height', '27px'); // Adjusted height
      this.buttonContainer.style('border-radius', '15px'); // Pill shape
      this.buttonContainer.style('border', '1px solid black'); // Thin black border
      this.buttonContainer.style('background-color', '#ccc');
      this.buttonContainer.parent(this.container);

      // Creating the up and down buttons within the pill container
      this.createSubButton(this.upButton, this.upLabel, this.upFunction, 'flex-end');
      this.createSubButton(this.downButton, this.downLabel, this.downFunction, 'flex-start');
  }

  createSubButton(button, label, actionFunction, justifyContent) {
      button = createButton(label).parent(this.buttonContainer);
      button.style('width', '23px');
      button.style('height', '23px');
      button.style('border-radius', '50%'); // Circular shape
      button.style('border', '1px solid black');
      button.style('background-color', '#ccc');
      button.style('color', 'black');
      button.style('justify-content', justifyContent);
      button.style('cursor', 'pointer');
      button.style('margin', '2px 2px'); // Adjust margin to bring sub-buttons closer

      button.mousePressed(actionFunction);

      // Flash effect on click
      button.mouseClicked(() => {
          button.style('background-color', '#4CD964'); // Change to green temporarily
          setTimeout(() => button.style('background-color', '#ccc'), 200); // Revert to original color
      });
  }


}


class TextField {
  constructor(text) {
    this.text = text;
    this.createElements();
  }

  createElements() {
    // Main container for the text field
    this.container = createDiv(this.text).addClass('text-field-container');
    this.container.style('width', '270px'); // Fixed width of 100px
    this.container.style('padding', '10px'); // Uniform padding
    this.container.style('margin', '10px auto'); // Center container
    this.container.style('border', '1px solid black'); // Thin black border
    this.container.style('text-align', 'center'); // Center the text within
    this.container.style('font-size', '23px'); // Slightly larger text size
    this.container.style('color', '#000'); // Text color
    this.container.style('background-color', '#f0f0f0'); // Pale grey background color
    this.container.style('box-sizing', 'border-box'); // Include padding and border in the element's total width and height
    this.container.parent('#settingsPanel'); // Assuming it's to be added to an element with id 'settingsPanel'
  }
}



class MovementControl {
  constructor(x, y,type) {
    this.type = type
    this.x = x;
    this.y = y;
    
    this.visible = true;
    this.buttonSize = 35; // Size of the clickable circles
    this.activeButton = null; // Track the active button
  }

  display() {

    if (!this.visible) return; // Don't display if not visible
    push()
    textAlign(CENTER,CENTER)
    textSize(15)
    if(this.type==0){
      text('GRAPH',this.x+50,this.y-10)
    }else{
      text('TABLE',this.x+50,this.y-10)
    }
    stroke(0);
    fill(220);
    rect(this.x, this.y, 100, 100, 10);

    // Check which button, if any, is currently active
    this.updateActiveButton(mouseX, mouseY);

    // Directional controls
    noStroke();

    // Up
    fill(this.activeButton === "UP" ? 'green' : 150);
    circle(this.x + 50, this.y + 20, this.buttonSize);

    // Down
    fill(this.activeButton === "DOWN" ? 'green' : 150);
    circle(this.x + 50, this.y + 80, this.buttonSize);

    // Left
    fill(this.activeButton === "LEFT" ? 'green' : 150);
    circle(this.x + 20, this.y + 50, this.buttonSize);

    // Right
    fill(this.activeButton === "RIGHT" ? 'green' : 150);
    circle(this.x + 80, this.y + 50, this.buttonSize);
    pop()
    this.checkClick(mouseX,mouseY)
  }

  updateActiveButton(mx, my) {
    if (!this.visible || !mouseIsPressed) {
      this.activeButton = null;
      return;
    }

    // Determine which button is active based on mouse position
    if (dist(mx, my, this.x + 50, this.y + 20) < this.buttonSize / 2) {
      this.activeButton = "UP";
    } else if (dist(mx, my, this.x + 50, this.y + 80) < this.buttonSize / 2) {
      this.activeButton = "DOWN";
    } else if (dist(mx, my, this.x + 20, this.y + 50) < this.buttonSize / 2) {
      this.activeButton = "LEFT";
    } else if (dist(mx, my, this.x + 80, this.y + 50) < this.buttonSize / 2) {
      this.activeButton = "RIGHT";
    } else {
      this.activeButton = null; // No button is currently active
    }
  }

  checkClick() {
    if (this.activeButton && mouseIsPressed) {
      this.move(this.activeButton);
    }
  }

  move(direction) {
    const moveStep = 3; // Movement step size
    console.log(direction); // Log the direction for debugging
    // Uncomment and adjust graph and dataTable positions based on the direction

    switch (direction) {
      case "UP":
        console.log('up')
        if(this.type == 0){
          graph.moveGraphY(-3);
        }else{
          graph.dataTableOffsetY -= 3;
        }
        break;
      case "DOWN":
         console.log('down')
        if(this.type == 0){
          graph.moveGraphY(3);
        }else{
          graph.dataTableOffsetY += 3;
        }

        break;
      case "LEFT":
         console.log('left')
        if(this.type == 0){
          graph.moveGraphX(-3);
        }else{
          graph.dataTableOffsetX += 3;
        }

        break;
      case "RIGHT":
         console.log('right')
        if(this.type == 0){
          graph.moveGraphX(3);
        }else{
           graph.dataTableOffsetX -= 3;
        }

        break;
    }


  }

  toggleVisibility() {
    this.visible = !this.visible;
  }
}
