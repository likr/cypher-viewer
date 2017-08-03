import 'eg-renderer'
import 'eg-renderer-ogdf'
import React from 'react'
import {render} from 'react-dom'
import * as d3 from 'd3'

const nodeColor = d3.scaleOrdinal(d3.schemeCategory10)

class App extends React.Component {
  constructor () {
    super()
    this.state = {
      width: 300,
      height: 150,
      layoutMethod: 'fmmm'
    }
  }

  componentDidMount () {
    const {wrapper} = this.refs
    this.setState({
      width: wrapper.clientWidth,
      height: wrapper.clientHeight
    })

    window.addEventListener('resize', () => {
      this.setState({
        width: wrapper.clientWidth,
        height: wrapper.clientHeight
      })
    })
  }

  render () {
    const {
      width,
      height,
      layoutMethod
    } = this.state
    const query = `MATCH (v1)-[r:Correlation]->(v2)
WHERE abs(r.value) > 0.6 AND v1.timeOrder <= v2.timeOrder
RETURN collect(distinct(v1)), collect(r), collect(distinct(v2))`
    return <div className='ui container'>
      <h1>Cypher Viewer</h1>
      <div className='ui vertical segment'>
        <form className='ui form' onSubmit={(event) => event.preventDefault()}>
          <h4 className='ui dividing header'>Query</h4>
          <div className='field'>
            <label>Endpoint URL</label>
            <input ref='url' defaultValue='http://great-auk.local:7474/db/data/transaction/commit' />
          </div>
          <div className='field'>
            <div className='two fields'>
              <div className='field'>
                <label>User ID</label>
                <input ref='userId' defaultValue='' />
              </div>
              <div className='field'>
                <label>Password</label>
                <input ref='password' type='password' defaultValue='' />
              </div>
            </div>
          </div>
          <div className='field'>
            <label>Query</label>
            <textarea ref='query' defaultValue={query} />
          </div>
          <button className='ui button' onClick={this.handleClickLoadButton.bind(this)}>load</button>
        </form>
      </div>
      <div className='ui vertical segment' >
        <div ref='wrapper' style={{height: '600px'}}>
          <eg-renderer-ogdf
            ref='renderer'
            style={{
              border: 'solid 1px #ccc',
              display: 'block'
            }}
            width={width}
            height={height}
            transition-duration='1000'
            graph-nodes-property='nodes'
            graph-links-property='relationships'
            node-id-property='id'
            link-source-property='startNode'
            link-target-property='endNode'
            default-node-width='30'
            default-node-height='30'
            default-node-stroke-width='0'
            default-link-source-marker-size='8'
            default-link-target-marker-size='8'
            layout-method={layoutMethod}
            no-auto-centering
          />
        </div>
      </div>
      <div className='ui vertical segment'>
        <form className='ui form' onSubmit={(event) => event.preventDefault()}>
          <h4 className='ui dividing header'>Renderer Options</h4>
          <div className='field'>
            <label>Layout Method</label>
            <select value={layoutMethod} onChange={this.handleChangeLayoutMethod.bind(this)}>
              <option value='circular'>Circular</option>
              <option value='fmmm'>FMMM</option>
              <option value='planarization'>Planarization</option>
              <option value='sugiyama'>Sugiyama</option>
            </select>
          </div>
          <div className='field'>
            <label>Node Label</label>
            <input ref='nodeLabel' defaultValue='name' />
          </div>
          <div className='field'>
            <label>Node Color</label>
            <input ref='nodeColor' defaultValue='type' />
          </div>
          <button className='ui button' onClick={this.handleClickUpdateButton.bind(this)}>update</button>
        </form>
      </div>
    </div>
  }

  handleChangeLayoutMethod (event) {
    this.setState({
      layoutMethod: event.target.value
    })
  }

  handleClickLoadButton () {
    const query = this.refs.query.value
    const url = this.refs.url.value
    const userId = this.refs.userId.value
    const password = this.refs.password.value
    const headers = {
      'Content-Type': 'application/json'
    }
    if (userId && password) {
      headers['Authorization'] = `Basic ${window.btoa(`${userId}:${password}`)}`
    }
    window
      .fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          statements: [
            {
              statement: query,
              resultDataContents: ['graph']
            }
          ]
        })
      })
      .then((response) => response.json())
      .then(({results}) => {
        const graph = results[0].data[0].graph
        const linkWidthScale = d3.scaleLinear()
          .domain([0, 1])
          .range([0, 5])
        const linkColorScale = d3.scaleLinear()
          .domain([-1, 0, 1])
          .range(['#00f', '#fff', '#f00'])
        const nodeIndices = new Map(graph.nodes.map(({id}, i) => [id, i]))
        for (const node of graph.nodes) {
          node.label = node.properties[this.refs.nodeLabel.value]
          node.fillColor = nodeColor(node.properties[this.refs.nodeColor.value])
        }
        for (const link of graph.relationships) {
          const source = graph.nodes[nodeIndices.get(link.startNode)]
          const target = graph.nodes[nodeIndices.get(link.endNode)]
          link.type = 'line'
          link.strokeWidth = linkWidthScale(Math.abs(link.properties.value))
          link.strokeColor = linkColorScale(link.properties.value)
          link.sourceMarkerShape = source.timeOrder === target.timeOrder ? 'triangle' : 'circle'
          link.targetMarkerShape = 'triangle'
        }
        this.refs.renderer.load(graph)
      })
  }

  handleClickUpdateButton () {
    for (const node of this.refs.renderer.data.nodes) {
      node.label = node.properties[this.refs.nodeLabel.value]
      node.fillColor = nodeColor(node.properties[this.refs.nodeColor.value])
    }
    this.refs.renderer.invalidate()
  }
}

render(<App />, document.getElementById('content'))
