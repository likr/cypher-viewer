import React from "react";
import { createRoot } from "react-dom/client";
import egRenderer from "eg-renderer/umd/eg-renderer";
import egRendererWasm from "eg-renderer/umd/eg-renderer.wasm?url";
import egraph from "egraph/dist/web/egraph_wasm";
import egraphWasm from "egraph/dist/web/egraph_wasm_bg.wasm?wasm";
import App from "./App";

(async () => {
  await egRenderer(egRendererWasm);
  await egraph(egraphWasm);
  createRoot(document.querySelector("#content")).render(<App />);
})();
