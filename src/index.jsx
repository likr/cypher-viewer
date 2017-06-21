import React from 'react'
import {render} from 'react-dom'
import * as d3 from 'd3'
import {
  Attributes,
  Color,
  Graph,
  GraphAttributes,
  GraphIO,
  NodeList,
  Shape,
  SugiyamaLayout
} from 'emogdf'

const {
  nodeGraphics,
  nodeStyle,
  nodeLabel,
  edgeGraphics,
  edgeStyle
} = Attributes

const nodeColor = d3.scaleOrdinal(d3.schemeCategory10)

const attributeFlag = (values) => {
  return values.reduce((a, b) => a | b.value, 0)
}

class App extends React.Component {
  componentDidMount () {
    const {graph, nodes} = this.props
    const attributes = new GraphAttributes(graph, attributeFlag([
      nodeGraphics,
      nodeStyle,
      nodeLabel,
      edgeGraphics,
      edgeStyle
    ]))
    const nodeList = new NodeList()
    graph.allNodes(nodeList)
    for (let i = 0; i < nodeList.size(); ++i) {
      const node = nodeList.at(i)
      attributes.setShape(node, Shape.shEllipse)
      const color = new Color(0, 0, 0, 255)
      color.fromString(nodeColor(nodes.get(node.index()).type))
      attributes.setFillColor(node, color)
      attributes.setLabel(node, nodes.get(node.index()).name)
    }
    const layout = new SugiyamaLayout()
    layout.call(attributes)
    const svg = GraphIO.getSVG(attributes)
    const img = document.createElement('img')
    img.src = `data:image/svg+xml;base64,${window.btoa(svg)}`
    this.refs.container.appendChild(img)
  }

  render () {
    return <div ref='container' />
  }
}

const r = 0
const query = `
  MATCH (v1)-[r:Lasso]->(v2)
  WHERE (r.value < -${r} OR ${r} < r.value) AND v1.timeOrder < v2.timeOrder
  RETURN v1, r, v2
  ORDER BY r.value DESC
  LIMIT 100
  `

window
  .fetch('http://great-auk.local:7474/db/data/cypher', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${window.btoa('neo4j:crest')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query})
  })
  .then((response) => response.json())
  .then(({data}) => {
    const graph = new Graph()
    const dataNodes = new Map()
    const edges = []
    for (const row of data) {
      const v1 = row[0]
      const v2 = row[2]
      dataNodes.set(v1.metadata.id, v1.data)
      dataNodes.set(v2.metadata.id, v2.data)
      edges.push([v1.metadata.id, v2.metadata.id])
    }
    const graphNodes = new Map()
    const nodes = new Map()
    for (const [id] of dataNodes.entries()) {
      const node = graph.newNode()
      graphNodes.set(id, node)
      nodes.set(node.index(), dataNodes.get(id))
    }
    for (const [v1id, v2id] of edges) {
      graph.newEdge(graphNodes.get(v1id), graphNodes.get(v2id))
    }
    render(<App graph={graph} nodes={nodes} />, document.getElementById('content'))
  })
