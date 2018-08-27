class AbstractGraph {
  edges () {
    const edges = []
    for (const u of this.vertices()) {
      for (const v of this.outVertices(u)) {
        edges.push([u, v])
      }
    }
    return edges
  }

  outEdges (u) {
    return this.outVertices(u).map((v) => [u, v])
  }

  inEdges (v) {
    return this.outVertices(v).map((u) => [u, v])
  }

  toJSON () {
    return {
      vertices: this.vertices().map((u) => ({u, d: this.vertex(u)})),
      edges: this.edges().map(([u, v]) => ({u, v, d: this.edge(u, v)}))
    }
  }

  toString () {
    return JSON.stringify(this.toJSON())
  }
}

module.exports = AbstractGraph
