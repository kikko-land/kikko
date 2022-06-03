import ReactDOM from "react-dom/client";

import { App } from "./App";

const el = document.getElementById("root");
if (!el) {
  throw new Error("Failed to find root el #root");
}

ReactDOM.createRoot(el).render(<App />);
