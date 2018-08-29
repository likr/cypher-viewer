import 'eg-renderer'
import React from 'react'
import {render} from 'react-dom'
import * as d3 from 'd3'
import {layout} from './layout'

const nodeColor = d3.scaleOrdinal(d3.schemeCategory10)
const query = `MATCH p = (v1)-[r:Correlation]->(v2)
WHERE abs(r.value) > 0.6
  AND v1.timeOrder < v2.timeOrder
RETURN collect(nodes(p)), collect(relationships(p))`

const fetchGraph = (query, userId, password, nodeColorProperty) => {
  const headers = {
    'Content-Type': 'application/json'
  }
  if (userId && password) {
    headers['Authorization'] = `Basic ${window.btoa(`${userId}:${password}`)}`
  }
  return window
    .fetch('https://neo4j.likr-lab.com/db/data/transaction/commit', {
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
        .range([0, 3])
      const linkColorScale = d3.scaleLinear()
        .domain([-1, 0, 1])
        .range(['#00f', '#fff', '#f00'])
      for (const node of graph.nodes) {
        node.properties.cell = node.properties.cells.join('-')
        node.fillColor = nodeColor(node.properties[nodeColorProperty])
      }
      for (const link of graph.relationships) {
        link.type = 'line'
        link.strokeWidth = linkWidthScale(Math.abs(link.properties.value))
        link.strokeColor = linkColorScale(link.properties.value)
      }
      return graph
    })
}

class App extends React.Component {
  constructor () {
    super()
    this.state = {
      width: 300,
      height: 150
    }
  }

  componentDidMount () {
    const {wrapper} = this.refs
    this.setState({
      width: wrapper.clientWidth,
      height: wrapper.clientHeight
    })

    window.addEventListener('resize', () => {
      if (document.webkitIsFullScreen) {
        this.setState({
          width: window.innerWidth,
          height: window.innerHeight
        })
      } else {
        this.setState({
          width: wrapper.clientWidth,
          height: wrapper.clientHeight
        })
      }
    })
  }

  render () {
    const {
      width,
      height
    } = this.state
    return <div className='ui container'>
      <h1>Cypher Viewer</h1>
      <div className='ui vertical segment'>
        <form className='ui form' onSubmit={this.handleSubmitQueryForm.bind(this)}>
          <h4 className='ui dividing header'>Query</h4>
          <div className='field'>
            <div className='two fields'>
              <div className='field'>
                <label>User ID</label>
                <input ref='userId' defaultValue='neo4j' />
              </div>
              <div className='field'>
                <label>Password</label>
                <input ref='password' type='password' />
              </div>
            </div>
          </div>
          <div className='field'>
            <label>Query</label>
            <textarea ref='query' defaultValue={query} />
          </div>
          <button className='ui button' type='submit'>load</button>
        </form>
      </div>
      <div className='ui vertical segment' >
        <div ref='wrapper' style={{height: '600px'}}>
          <eg-renderer
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
            group-id-property='label'
            node-id-property='id'
            node-label-property='properties.name'
            link-source-property='startNode'
            link-target-property='endNode'
            default-node-width='10'
            default-node-height='10'
            default-node-stroke-width='0'
            default-link-stroke-width='1'
            no-auto-centering
          />
        </div>
        <div className='ui menu'>
          <div className='item'>
            <button className='ui button' onClick={this.handleClickCenterButton.bind(this)}>Center</button>
          </div>
          <div className='item'>
            <button className='ui button' onClick={this.handleClickFullscreenButton.bind(this)}>Fullscreen</button>
          </div>
        </div>
      </div>
      <div className='ui vertical segment'>
        <form className='ui form' onSubmit={this.handleSubmitOptionsForm.bind(this)}>
          <h4 className='ui dividing header'>Renderer Options</h4>
          <div className='field'>
            <label>Group Layout</label>
            <select ref='group' className='ui selection dropdown' defaultValue='circle-pack'>
              <option value='treemap'>Treemap</option>
              <option value='circle-pack'>Circle Packing</option>
              <option value='cell-groups'>Cell Groups</option>
            </select>
          </div>
          <div className='field'>
            <label>Node Color</label>
            <select ref='nodeColor' className='ui selection dropdown' defaultValue='type'>
              <option value='type'>Type</option>
              <option value='timeGroup'>Time Group</option>
              <option value='timeGroupDetail'>Time Group Detail</option>
              <option value='unit'>Unit</option>
            </select>
          </div>
          <div className='field'>
            <label>Node Group</label>
            <select ref='nodeGroup' className='ui selection dropdown' defaultValue='timeGroup'>
              <option value='$none'>None</option>
              <option value='type'>Type</option>
              <option value='timeGroup'>Time Group</option>
              <option value='timeGroupDetail'>Time Group Detail</option>
              <option value='cell'>Cell</option>
              <option value='unit'>Unit</option>
            </select>
          </div>
          <div className='field'>
            <label>Edge Bundling Cycles</label>
            <input ref='cycles' type='number' min='0' defaultValue='3' />
          </div>
          <div className='field'>
            <label>Edge Concentration Min Count</label>
            <input ref='minCount' type='number' min='1' defaultValue='6' />
          </div>
          <div className='field'>
            <label>Group Many Body Force</label>
            <input ref='manyBodyForce' type='number' min='0' step='0.01' defaultValue='0.5' />
          </div>
          <div className='field'>
            <label>Group Link Force</label>
            <input ref='linkForce' type='number' min='0' step='0.01' defaultValue='0.5' />
          </div>
          <div className='field'>
            <label>Intra Group Strength</label>
            <input ref='intraGroup' type='number' min='0' step='0.01' defaultValue='0.5' />
          </div>
          <div className='field'>
            <label>Inter Group Strength</label>
            <input ref='interGroup' type='number' min='0' step='0.01' defaultValue='0.3' />
          </div>
          <div className='field'>
            <label>Group Center Force</label>
            <input ref='centerForce' type='number' min='0' step='0.01' defaultValue='0.2' />
          </div>
          <div className='field'>
            <label>Use Edge Concentration</label>
            <select ref='useEdgeConcentration' className='ui selection dropdown' defaultValue='yes'>
              <option value='yes'>Yes</option>
              <option value='no'>No</option>
            </select>
          </div>
          <div className='field'>
            <label>Show Single Edge</label>
            <select ref='showSingleEdge' className='ui selection dropdown' defaultValue='no'>
              <option value='yes'>Yes</option>
              <option value='no'>No</option>
            </select>
          </div>
          <button className='ui button' type='submit'>update</button>
        </form>
      </div>
    </div>
  }

  handleClickCenterButton () {
    this.refs.renderer.center()
  }

  handleClickFullscreenButton () {
    if (this.refs.renderer.webkitRequestFullscreen) {
      this.refs.renderer.webkitRequestFullscreen()
    }
  }

  handleSubmitQueryForm (event) {
    event.preventDefault()
    const query = this.refs.query.value
    const userId = this.refs.userId.value
    const password = this.refs.password.value
    const nodeColorProperty = this.refs.nodeColor.value
    fetchGraph(query, userId, password, nodeColorProperty).then((data) => {
      this.data = data
      this.layout().then(() => {
        this.refs.renderer.center()
      })
    })
  }

  handleSubmitOptionsForm (event) {
    event.preventDefault()
    this.layout()
  }

  layout () {
    const options = {
      type: this.refs.group.value,
      cycles: +this.refs.cycles.value,
      s0: 0.1,
      i0: 90,
      sStep: 0.5,
      iStep: 0.6,
      groupProperty: this.refs.nodeGroup.value,
      manyBodyForce: +this.refs.manyBodyForce.value,
      linkForce: +this.refs.linkForce.value,
      centerForce: +this.refs.centerForce.value,
      intraGroup: +this.refs.intraGroup.value,
      interGroup: +this.refs.interGroup.value,
      useEdgeConcentration: this.refs.useEdgeConcentration.value === 'yes',
      showSingleEdge: this.refs.showSingleEdge.value === 'yes',
      mu: 0.5,
      minCount: +this.refs.minCount.value
    }
    return layout(this.data, options).then((data) => {
      const linkWidthScale = d3.scaleLinear()
        .domain([0, 1])
        .range([1, 3])
      const linkColorScale = d3.scaleLinear()
        .domain([-1, 0, 1])
        .range(['#00f', '#888', '#f00'])
      for (const node of data.nodes) {
        node.fillColor = nodeColor(node.properties[this.refs.nodeColor.value])
      }
      for (const link of data.relationships) {
        link.type = 'line'
        link.strokeWidth = linkWidthScale(Math.abs(link.properties.value))
        link.strokeColor = linkColorScale(link.properties.value)
      }
      this.refs.renderer.load(data)
    })
  }

  update () {
    for (const node of this.refs.renderer.data.nodes) {
      node.fillColor = nodeColor(node.properties[this.refs.nodeColor.value])
    }
    this.refs.renderer.invalidate()
  }
}

render(<App />, document.getElementById('content'))
