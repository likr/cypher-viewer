import * as d3 from 'd3'
import {Algorithms} from 'egraph/algorithms'
import {Allocator} from 'egraph/allocator'
import {Simulation} from 'egraph/layout/force-directed'
import {Graph} from 'egraph/graph'
import {EdgeBundling} from 'egraph/edge-bundling'
import {loadModule} from './module'
import EGraph from './egraph/graph'
import EdgeConcentrationTransformer from './egraph/transformer/edge-concentration'

const countGroups = (nodes, key) => {
  const groupCount = new Map()
  for (const node of nodes) {
    if (!groupCount.has(node.properties[key])) {
      groupCount.set(node.properties[key], 0)
    }
    groupCount.set(node.properties[key], groupCount.get(node.properties[key]) + 1)
  }
  const groups = Array.from(groupCount.entries()).map(([name, count]) => ({name, count}))
  groups.sort((a, b) => b.count - a.count)
  return groups
}

const rectGroups = (groups, width, height, Module) => {
  const algorithms = new Algorithms(Module)
  const values = groups.map(({count}) => count)
  const sumValues = values.reduce((a, b) => a + b)
  const normalizedValues = values.map((v) => v / sumValues * width * height)
  return algorithms.squarifiedTreemap(width, height, normalizedValues)
}

const circleGroups = (groups, width, height) => {
  const tree = {
    name: '',
    children: groups.map(({name, count}) => {
      return {
        name,
        size: count
      }
    })
  }
  const root = d3.hierarchy(tree)
    .sum((d) => d.size)
    .sort((a, b) => b.value - a.value)
  const pack = d3.pack().size([width, height])
  const tiles = pack(root).descendants()
    .map((node) => {
      return {
        x: node.x - node.r,
        y: node.y - node.r,
        width: node.r * 2,
        height: node.r * 2
      }
    })
  tiles.shift(0)
  return tiles
}

const groupLayout = (type, groups, width, height, Module) => {
  switch (type) {
    case 'circle-pack':
      return circleGroups(groups, width, height)
    case 'treemap':
      return rectGroups(groups, width, height, Module)
  }
  return rectGroups(groups, width, height, Module)
}

const groupType = new Map([
  ['circle-pack', 'circle'],
  ['treemap', 'rect']
])

const applyEdgeConcentration = (data, groups, options) => {
  const graph = new EGraph()
  for (const node of data.nodes) {
    graph.addVertex(node.id, node)
  }
  for (const {startNode, endNode} of data.relationships) {
    const sourceGroup = graph.vertex(startNode).properties[options.groupProperty]
    const targetGroup = graph.vertex(endNode).properties[options.groupProperty]
    if (sourceGroup === targetGroup) {
      graph.addEdge(startNode, endNode)
    }
  }

  const groupNodes = groups.map(({name}) => {
    return data.nodes.filter((node) => node.properties[options.groupProperty] === name)
  })

  const transformer = new EdgeConcentrationTransformer()
    .idGenerator((graph, source, target) => {
      source = Array.from(source)
      source.sort()
      target = Array.from(target)
      target.sort()
      return `${source.join(',')}:${target.join(',')}`
    })

  for (let i = 0; i < groups.length; ++i) {
    const g1 = groupNodes[i]
    for (let j = i + 1; j < groups.length; ++j) {
      const g2 = groupNodes[j]

      const subGraph = new EGraph()
      for (const node of g1) {
        subGraph.addVertex(node.id, node)
      }
      for (const node of g2) {
        subGraph.addVertex(node.id, node)
      }
      for (const {startNode, endNode} of data.relationships) {
        const sourceGroup = graph.vertex(startNode).properties[options.groupProperty]
        const targetGroup = graph.vertex(endNode).properties[options.groupProperty]
        if (sourceGroup === groups[i].name && targetGroup === groups[j].name) {
          subGraph.addEdge(startNode, endNode)
        }
        if (sourceGroup === groups[j].name && targetGroup === groups[i].name) {
          subGraph.addEdge(endNode, startNode)
        }
      }

      const transformedGraph = transformer.transform(subGraph)
      for (const u of transformedGraph.vertices()) {
        const node = transformedGraph.vertex(u)
        if (node.dummy) {
          console.log(u)
          graph.addVertex(`${u}-l`, Object.assign({}, node, {
            id: `${u}-l`,
            properties: {
              [options.groupProperty]: groups[i].name
            }
          }))
          graph.addVertex(`${u}-r`, Object.assign({}, node, {
            id: `${u}-r`,
            properties: {
              [options.groupProperty]: groups[j].name
            }
          }))
          graph.addEdge(`${u}-l`, `${u}-r`)
        }
      }
      for (const [u, v] of transformedGraph.edges()) {
        const uNode = transformedGraph.vertex(u)
        const vNode = transformedGraph.vertex(v)
        if (!uNode.dummy && !vNode.dummy) {
          // graph.addEdge(u, v)
        }
        if (uNode.dummy && !vNode.dummy) {
          graph.addEdge(`${u}-r`, v)
        }
        if (!uNode.dummy && vNode.dummy) {
          graph.addEdge(u, `${v}-l`)
        }
      }
    }
  }

  return {
    nodes: graph.vertices().map((u) => graph.vertex(u)),
    relationships: graph.edges().map(([u, v]) => ({startNode: u, endNode: v}))
  }
}

const makeGraph = (Module, data, groups, options) => {
  const graph = new Graph(Module)
  let vertexId = 0
  const nodeIds = new Map()
  for (const node of data.nodes) {
    graph.addNode()
    nodeIds.set(node.id, vertexId++)
  }
  for (const {startNode, endNode} of data.relationships) {
    graph.addEdge(nodeIds.get(startNode), nodeIds.get(endNode))
  }
  return graph
}

const calcLayout = (Module, data, options) => {
  const width = 2000
  const height = 2000
  const allocator = new Allocator(Module)

  const groups = countGroups(data.nodes, options.groupProperty)
  const tiles = groupLayout(options.type, groups, width, height, Module)

  const groupsPointer = allocator.alloc(16 * groups.length)
  tiles.forEach((tile, i) => {
    Module.HEAPF32[groupsPointer / 4 + 2 * i] = tile.x + tile.width / 2
    Module.HEAPF32[groupsPointer / 4 + 2 * i + 1] = tile.y + tile.height / 2
  })

  const layoutData = options.useEdgeConcentration ? applyEdgeConcentration(data, groups, options) : data
  const graph = makeGraph(Module, layoutData, groups, options)
  const groupMap = new Map(groups.map(({name}, i) => [name, i]))
  const nodeGroupsPointer = allocator.alloc(4 * graph.nodeCount())
  layoutData.nodes.forEach((node, i) => {
    Module.HEAPU32[nodeGroupsPointer / 4 + i] = groupMap.get(node.properties[options.groupProperty])
  })

  const simulation = new Simulation(Module)
  const f1 = simulation.addGroupManyBodyForce(groupsPointer, groups.length, nodeGroupsPointer, graph.nodeCount())
  const f2 = simulation.addGroupLinkForce(graph, nodeGroupsPointer)
  const f3 = simulation.addGroupCenterForce(groupsPointer, groups.length, nodeGroupsPointer, graph.nodeCount())
  simulation.setStrength(f1, 0.2)
  simulation.setStrength(f2, 1.0)
  simulation.setStrength(f3, 0.8)
  simulation.start(graph)

  const edgeBundling = new EdgeBundling(Module)
  edgeBundling.cycles = options.cycles
  edgeBundling.s0 = options.s0
  edgeBundling.i0 = options.i0
  edgeBundling.sStep = options.sStep
  edgeBundling.iStep = options.iStep
  // const lines = edgeBundling.call(graph)

  tiles.forEach((tile, i) => {
    tile.type = groupType.get(options.type)
    tile.label = groups[i].name.toString()
    tile.x += tile.width / 2
    tile.y += tile.height / 2
  })
  layoutData.groups = tiles

  layoutData.nodes.forEach((node, i) => {
    node.x = graph.getX(i)
    node.y = graph.getY(i)
  })

  layoutData.relationships.forEach((link, i) => {
    // link.bends = lines[i].map(({x, y}) => [x, y])
  })

  return layoutData
}

export const layout = (data, options) => {
  return loadModule().then(({Module}) => {
    return calcLayout(Module, data, options)
  })
}
