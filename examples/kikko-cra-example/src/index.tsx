import React from "react";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  migrationsPlugin,
  reactiveQueriesPlugin,
} from "@kikko-land/react";
import { createNotesTableMigration } from "./migrations/createNotesTable";
import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm";
import { List } from "./List";
import { absurdWebBackend } from "@kikko-land/absurd-web-backend";
import ReactDOM from "react-dom/client";

const config: IInitDbClientConfig = {
  dbName: "helloWorld",
  dbBackend: absurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
};

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <DbProvider config={config}>
      <EnsureDbLoaded fallback={<div>Loading db...</div>}>
        <List />
      </EnsureDbLoaded>
    </DbProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
