import * as d3 from 'd3'
import {Algorithms} from 'egraph/algorithms'
import {Allocator} from 'egraph/allocator'
import {Simulation} from 'egraph/layout/force-directed'
import {Graph} from 'egraph/graph'
import {EdgeBundling} from 'egraph/edge-bundling'
import {loadModule} from './module'
import EGraph from './egraph/graph'
import copy from './egraph/graph/copy'
import EdgeConcentrationTransformer from './egraph/transformer/edge-concentration'
import quasiBicliqueMining from './egraph/transformer/edge-concentration/quasi-biclique-mining'
import {cellGroups} from './cell-groups'

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
    case 'cell-groups':
      return cellGroups(groups)
  }
  return rectGroups(groups, width, height, Module)
}

const groupType = new Map([
  ['circle-pack', 'circle'],
  ['treemap', 'rect'],
  ['cell-groups', 'rect']
])

const applyEdgeConcentration = (data, groups, options) => {
  const graph = new EGraph()
  for (const node of data.nodes) {
    graph.addVertex(node.id, node)
  }
  const edgeValues = new Map()
  for (const edge of data.relationships) {
    const {startNode, endNode} = edge
    const sourceGroup = graph.vertex(startNode).properties[options.groupProperty]
    const targetGroup = graph.vertex(endNode).properties[options.groupProperty]
    if (sourceGroup === targetGroup) {
      graph.addEdge(startNode, endNode, edge)
    }
    edgeValues.set(`${startNode}-${endNode}`, edge.properties.value)
  }

  const groupNodes = groups.map(({name}) => {
    return data.nodes.filter((node) => node.properties[options.groupProperty] === name)
  })

  const transformer = new EdgeConcentrationTransformer()
    .method((graph, h1, h2) => quasiBicliqueMining(graph, h1, h2, options.mu, options.minCount))
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
      for (const edge of data.relationships) {
        const {startNode, endNode} = edge
        const sourceGroup = graph.vertex(startNode).properties[options.groupProperty]
        const targetGroup = graph.vertex(endNode).properties[options.groupProperty]
        if (sourceGroup === groups[i].name && targetGroup === groups[j].name) {
          subGraph.addEdge(startNode, endNode, edge)
        }
        if (sourceGroup === groups[j].name && targetGroup === groups[i].name) {
          subGraph.addEdge(endNode, startNode, edge)
        }
      }

      transformer.dummy((source, target) => {
        const edges = []
        for (const u of source) {
          for (const v of target) {
            const edge = subGraph.edge(u, v)
            if (edge) {
              edges.push(edge)
            }
          }
        }
        return {
          dummy: true,
          sourceSize: source.length,
          targetSize: target.length,
          count: edges.length,
          average: edges.reduce((a, e) => a + e.properties.value, 0) / edges.length
        }
      })
      const transformedGraph = transformer.transform(copy(subGraph))
      for (const u of transformedGraph.vertices()) {
        const node = transformedGraph.vertex(u)
        if (node.dummy) {
          graph.addVertex(`${u}-l`, Object.assign({}, node, {
            id: `${u}-l`,
            size: node.targetSize,
            properties: {
              [options.groupProperty]: groups[i].name
            }
          }))
          graph.addVertex(`${u}-r`, Object.assign({}, node, {
            id: `${u}-r`,
            size: node.sourceSize,
            properties: {
              [options.groupProperty]: groups[j].name
            }
          }))
          graph.addEdge(`${u}-l`, `${u}-r`, {
            dummy: true,
            size: node.count,
            properties: {
              value: node.average
            }
          })
        }
      }
      for (const [u, v] of transformedGraph.edges()) {
        const uNode = transformedGraph.vertex(u)
        const vNode = transformedGraph.vertex(v)
        if (!uNode.dummy && !vNode.dummy) {
          if (options.showSingleEdge) {
            graph.addEdge(u, v, {
              properties: {
                value: edgeValues.get(`${u}-${v}`) || edgeValues.get(`${v}-${u}`)
              }
            })
          }
        }
        if (uNode.dummy && !vNode.dummy) {
          graph.addEdge(`${u}-r`, v, {
            dummy: true,
            properties: {
              value: uNode.average
            }
          })
        }
        if (!uNode.dummy && vNode.dummy) {
          graph.addEdge(u, `${v}-l`, {
            dummy: true,
            properties: {
              value: vNode.average
            }
          })
        }
      }
    }
  }

  return {
    nodes: graph.vertices().map((u) => graph.vertex(u)),
    relationships: graph.edges().map(([u, v]) => Object.assign({}, graph.edge(u, v), {startNode: u, endNode: v}))
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
  layoutData.nodes.forEach((node, i) => {
    graph.setX(i, node.x || 0)
    graph.setY(i, node.y || 0)
  })
  const groupMap = new Map(groups.map(({name}, i) => [name, i]))
  const nodeGroupsPointer = allocator.alloc(4 * graph.nodeCount())
  layoutData.nodes.forEach((node, i) => {
    Module.HEAPU32[nodeGroupsPointer / 4 + i] = groupMap.get(node.properties[options.groupProperty])
  })

  const simulation = new Simulation(Module)
  const f1 = simulation.addGroupManyBodyForce(groupsPointer, groups.length, nodeGroupsPointer, graph.nodeCount())
  const f2 = simulation.addGroupLinkForce(graph, nodeGroupsPointer, options.intraGroup, options.interGroup)
  const f3 = simulation.addGroupCenterForce(groupsPointer, groups.length, nodeGroupsPointer, graph.nodeCount())
  simulation.setStrength(f1, options.manyBodyForce)
  simulation.setStrength(f2, options.linkForce)
  simulation.setStrength(f3, options.centerForce)
  simulation.start(graph)

  const edgeBundling = new EdgeBundling(Module)
  edgeBundling.cycles = options.cycles
  edgeBundling.s0 = options.s0
  edgeBundling.i0 = options.i0
  edgeBundling.sStep = options.sStep
  edgeBundling.iStep = options.iStep
  const lines = edgeBundling.call(graph)

  tiles.forEach((tile, i) => {
    tile.type = groupType.get(options.type)
    tile.label = groups[i].name || ''
    tile.x += tile.width / 2
    tile.y += tile.height / 2
  })
  layoutData.groups = tiles

  layoutData.nodes.forEach((node, i) => {
    node.x = graph.getX(i)
    node.y = graph.getY(i)
  })

  layoutData.relationships.forEach((link, i) => {
    link.bends = lines[i].map(({x, y}) => [x, y])
  })

  return layoutData
}

export const layout = (data, options) => {
  return loadModule().then(({Module}) => {
    return calcLayout(Module, data, options)
  })
}
