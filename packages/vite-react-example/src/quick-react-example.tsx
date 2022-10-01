import { absurdWebBackend } from "@kikko-land/absurd-web-backend";
import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  IMigration,
  migrationsPlugin,
  reactiveQueriesPlugin,
  sql,
} from "@kikko-land/react";
// For Vite:
import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm?url";

import { List } from "./list/List";

const createNotesTable: IMigration = {
  up: async (db) => {
    await db.runQuery(
      sql`
      CREATE TABLE IF NOT EXISTS notes (
        id varchar(20) PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
      );
    `
    );

    await db.runQuery(
      sql`
      CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);
    `
    );
  },
  id: 1653668686076,
  name: "createNotesTable",
};

const config: IInitDbClientConfig = {
  dbName: "quick-example-db",
  dbBackend: absurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    reactiveQueriesPlugin(),
    migrationsPlugin({ migrations: [createNotesTable] }),
  ],
};

export const App = () => {
  return (
    <DbProvider config={config}>
      <EnsureDbLoaded fallback={<div>Loading db...</div>}>
        <List />
      </EnsureDbLoaded>
    </DbProvider>
  );
};
