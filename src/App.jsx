import React from "react";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { layout } from "./layout";

const nodeColor = d3.scaleOrdinal(d3.schemeCategory10);
const query = ``;

async function fetchGraph(query, server, userId, password) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (userId && password) {
    headers["Authorization"] = `Basic ${window.btoa(`${userId}:${password}`)}`;
  }
  const response = await fetch(`${server}/db/data/transaction/commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      statements: [
        {
          statement: query,
          resultDataContents: ["graph"],
        },
      ],
    }),
  });
  const { results } = await response.json();
  const graph = results[0].data[0].graph;
  return graph;
}

export default function App() {
  const rendererRef = useRef();
  const wrapperRef = useRef();
  const [{ width, height }, setSize] = useState({
    width: 300,
    height: 150,
  });
  const [data, setData] = useState();

  useEffect(() => {
    setSize({
      width: wrapperRef.current.clientWidth,
      height: wrapperRef.current.clientHeight,
    });
    window.addEventListener("resize", () => {
      if (document.fullscreenElement == null) {
        setSize({
          width: wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight,
        });
      } else {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    });
  }, []);

  useEffect(() => {
    (async () => {
      if (data) {
        await layout(data);
        for (const node of data.nodes) {
          node.label = node.properties["漢字商号"];
          node.fillColor = nodeColor(node.properties["大分類"]);
        }
        rendererRef.current.load(data);
      }
    })();
  }, [data]);

  return (
    <div className="ui container">
      <h1>Cypher Viewer</h1>
      <div className="ui vertical segment">
        <form
          className="ui form"
          onSubmit={async (event) => {
            event.preventDefault();
            const query = event.target.elements.query.value;
            const server = event.target.elements.server.value;
            const userId = event.target.elements.userId.value;
            const password = event.target.elements.password.value;
            const data = await fetchGraph(query, server, userId, password);
            setData(data);
          }}
        >
          <h4 className="ui dividing header">Query</h4>
          <div className="field">
            <label>Server</label>
            <input name="server" defaultValue="http://192.168.1.52:7474" />
          </div>
          <div className="field">
            <div className="two fields">
              <div className="field">
                <label>User ID</label>
                <input name="userId" defaultValue="neo4j" />
              </div>
              <div className="field">
                <label>Password</label>
                <input name="password" type="password" />
              </div>
            </div>
          </div>
          <div className="field">
            <label>Query</label>
            <textarea name="query" defaultValue={query} />
          </div>
          <button className="ui button" type="submit">
            load
          </button>
        </form>
      </div>
      <div className="ui vertical segment">
        <div
          ref={wrapperRef}
          style={{ height: "600px", backgroundColor: "white" }}
        >
          <eg-renderer
            ref={rendererRef}
            style={{
              border: "solid 1px #ccc",
              display: "block",
            }}
            width={width}
            height={height}
            transition-duration="1000"
            graph-nodes-property="nodes"
            graph-links-property="relationships"
            node-id-property="id"
            node-label-property="label"
            link-source-property="startNode"
            link-target-property="endNode"
            default-node-width="10"
            default-node-height="10"
            default-node-stroke-width="0"
            default-link-stroke-width="1"
            default-link-stroke-color="#888"
            default-link-target-marker-shape="triangle"
            no-auto-centering
          />
        </div>
        <div className="ui menu">
          <div className="item">
            <button
              className="ui button"
              onClick={() => {
                rendererRef.current.center();
              }}
            >
              Center
            </button>
          </div>
          <div className="item">
            <button
              className="ui button"
              onClick={() => {
                wrapperRef.current.requestFullscreen();
              }}
            >
              Fullscreen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
