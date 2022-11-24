import {
  DbProvider,
  DbsHolder,
  EnsureDbLoaded,
  IInitDbClientConfig,
  migrationsPlugin,
  reactiveQueriesPlugin,
} from "@kikko-land/react";
import { tauriBackend } from "@kikko-land/tauri-backend";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const config: IInitDbClientConfig = {
  dbName: "helloWorld",
  dbBackend: tauriBackend((dbName) => `${dbName}.db`),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
};

export const App = () => {
  return (
    <DbsHolder defaultDbConfig={config}>
      <EnsureDbLoaded fallback={<div>Loading db...</div>}>j
        <List />
      </EnsureDbLoaded>
    </DbsHolder>
  );
};
