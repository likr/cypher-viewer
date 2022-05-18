import {
  Coordinates,
  Graph,
  Simulation,
  ManyBodyForce,
  LinkForce,
} from "egraph/dist/web/egraph_wasm";

export async function layout(data) {
  const graph = new Graph();
  const indices = new Map();
  for (const node of data.nodes) {
    indices.set(node.id, graph.addNode(node));
  }
  for (const link of data.relationships) {
    link.type = "line";
    const { startNode: source, endNode: target } = link;
    graph.addEdge(indices.get(source), indices.get(target), link);
  }

  const coordinates = Coordinates.initialPlacement(graph);
  const simulation = new Simulation();
  const forces = [
    new ManyBodyForce(graph, () => ({ strength: -100 })),
    new LinkForce(graph, () => ({ distance: 10 })),
  ];

  simulation.run((alpha) => {
    for (const force of forces) {
      force.apply(coordinates, alpha);
    }
    coordinates.updatePosition(0.6);
    coordinates.centralize();
  });
  for (const u of graph.nodeIndices()) {
    const node = graph.nodeWeight(u);
    node.x = coordinates.x(u);
    node.y = coordinates.y(u);
  }
}
