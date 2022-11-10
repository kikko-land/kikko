import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AppRoutes } from "./AppRoutes";

const el = document.getElementById("root");
if (!el) {
  throw new Error("Failed to find root el #root");
}

ReactDOM.createRoot(el).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);
