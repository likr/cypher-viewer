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
WHERE abs(r.r) > 0.6 AND v1.time_order <= v2.time_order
RETURN v1, r, v2`
    return <div className='ui container'>
      <h1>Cypher Viewer</h1>
      <div className='ui vertical segment'>
        <form className='ui form' onSubmit={(event) => event.preventDefault()}>
          <h4 className='ui dividing header'>Query</h4>
          <div className='field'>
            <label>URL</label>
            <input ref='url' defaultValue='http://localhost:7474/db/data/cypher' />
          </div>
          <div className='field'>
            <div className='two fields'>
              <div className='field'>
                <label>User ID</label>
                <input ref='userId' defaultValue='neo4j' />
              </div>
              <div className='field'>
                <label>Password</label>
                <input ref='password' type='password' defaultValue='neo4j' />
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
            node-id-property='id'
            default-node-width='30'
            default-node-height='30'
            default-node-stroke-width='0'
            default-link-stroke-color='#ccc'
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
    window
      .fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${window.btoa(`${userId}:${password}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({query})
      })
      .then((response) => response.json())
      .then(({data}) => {
        const linkWidthScale = d3.scaleLinear()
          .domain([0, 1])
          .range([0, 5])
        const linkColorScale = d3.scaleLinear()
          .domain([-1, 0, 1])
          .range(['#00f', '#fff', '#f00'])
        const nodes = new Map()
        const links = []
        for (const row of data) {
          const v1 = row[0]
          const v2 = row[2]
          const link = row[1].data
          nodes.set(v1.metadata.id, v1.data)
          nodes.set(v2.metadata.id, v2.data)
          links.push({
            source: v1.data.id,
            target: v2.data.id,
            strokeWidth: linkWidthScale(Math.abs(link.r)),
            strokeColor: linkColorScale(link.r),
            sourceMarkerShape: v1.data.time_order === v2.data.time_order ? 'triangle' : 'circle',
            sourceMarkerSize: 8,
            targetMarkerShape: 'triangle',
            targetMarkerSize: 8,
            d: link
          })
        }
        this.refs.renderer.load({
          nodes: Array.from(nodes.values()).map((node) => {
            return {
              id: node.id,
              label: node[this.refs.nodeLabel.value],
              fillColor: nodeColor(node[this.refs.nodeColor.value]),
              d: node
            }
          }),
          links
        })
      })
  }

  handleClickUpdateButton () {
    for (const node of this.refs.renderer.data.nodes) {
      node.label = node.d[this.refs.nodeLabel.value]
      node.fillColor = nodeColor(node.d[this.refs.nodeColor.value])
    }
    this.refs.renderer.invalidate()
  }
}

render(<App />, document.getElementById('content'))
