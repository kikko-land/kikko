import {
  DbsHolder,
  EnsureDbLoaded,
  IInitDbClientConfig,
  migrationsPlugin,
  reactiveQueriesPlugin,
} from "@kikko-land/react";
import ReactDOM from "react-dom/client";
import { electronBetterSqlite3Backend } from "@kikko-land/electron-better-sqlite3-backend";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";
import React from "react";

console.log(React);

const config: IInitDbClientConfig = {
  dbName: "helloWorld",
  dbBackend: electronBetterSqlite3Backend((dbName) => `${dbName}.db`),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
};

export const App = () => {
  return <DbsHolder defaultDbConfig={config}></DbsHolder>;
};

const el = document.getElementById("root");
if (!el) {
  throw new Error("Failed to find root el #root");
}

ReactDOM.createRoot(el).render(<App />);
