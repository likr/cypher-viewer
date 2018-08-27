import * as d3 from 'd3'
import {Algorithms} from 'egraph/algorithms'
import {Allocator} from 'egraph/allocator'
import {Simulation} from 'egraph/layout/force-directed'
import {Graph} from 'egraph/graph'
import {EdgeBundling} from 'egraph/edge-bundling'
import {loadModule} from './module'

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

const calcLayout = (Module, graph, data, options) => {
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

  const groupMap = new Map(groups.map(({name}, i) => [name, i]))
  const nodeGroupsPointer = allocator.alloc(4 * graph.nodeCount())
  data.nodes.forEach((node, i) => {
    Module.HEAPU32[nodeGroupsPointer / 4 + i] = groupMap.get(node.properties[options.groupProperty])
  })

  const simulation = new Simulation(Module)
  const f1 = simulation.addGroupManyBodyForce(groupsPointer, groups.length, nodeGroupsPointer, graph.nodeCount())
  const f2 = simulation.addGroupLinkForce(graph, nodeGroupsPointer)
  const f3 = simulation.addGroupCenterForce(groupsPointer, groups.length, nodeGroupsPointer, graph.nodeCount())
  simulation.setStrength(f1, 0.2)
  simulation.setStrength(f2, 0.1)
  simulation.setStrength(f3, 0.5)
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
    tile.label = groups[i].name.toString()
    tile.x += tile.width / 2
    tile.y += tile.height / 2
  })
  data.groups = tiles

  data.nodes.forEach((node, i) => {
    node.x = graph.getX(i)
    node.y = graph.getY(i)
  })

  data.relationships.forEach((link, i) => {
    link.bends = lines[i].map(({x, y}) => [x, y])
  })
}

export const layout = (data, options) => {
  return loadModule().then(({Module}) => {
    const graph = new Graph(Module)
    const nodeIds = new Map()
    data.nodes.forEach((node, i) => {
      graph.addNode()
      nodeIds.set(node.id, i)
    })
    for (const {startNode, endNode} of data.relationships) {
      graph.addEdge(nodeIds.get(startNode), nodeIds.get(endNode))
    }
    calcLayout(Module, graph, data, options)
    return data
  })
}
