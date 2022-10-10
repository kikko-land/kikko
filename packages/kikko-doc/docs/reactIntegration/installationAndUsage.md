---
sidebar_position: 1
slug: /react-integration/installation
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Installation And Usage

Install core packages:

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/react @kikko-land/query-builder
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/react @kikko-land/query-builder
```

  </TabItem>
</Tabs>

You also need to install and configure SQLite backend you need. Please, checkout [backend section](/backends/web) in the doc for more info.

After wrap the whole app with this components(usage example for vite web):

```tsx
import { absurdWebBackend } from "@kikko-land/absurd-web-backend";
import { DbProvider, EnsureDbLoaded } from "@kikko-land/react";
import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm?url";

const createNotesTableMigration: IMigration = {
  up: async (db) => {
    await runQuery(
      db,
      sql`CREATE TABLE notes (id varchar(20) PRIMARY KEY, title TEXT NOT NULL);`
    );
  },
  id: 18,
  name: "createNotesTable",
};

const config: IInitDbClientConfig = {
  dbName: "db-name",
  dbBackend: absurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
};

export const App = () => (
  <DbProvider config={config}>
    <EnsureDbLoaded fallback={<Text>Loading db...</Text>}>
      <Notes />
    </EnsureDbLoaded>
  </DbProvider>
);
```

Then use it in your child components:

```tsx
import {
  useQuery,
  useQueryFirstRow,
  useRunQuery,
  makeId,
  runQuery,
} from "@kikko-land/react";
import { insert, select, sql } from "@kikko-land/query-builder";

type Note = { id: string; title: string };

export const Notes = () => {
  const notes = useQuery<Note>(select().from("notes"));
  const notesCount = useQueryFirstRow<{ count: number }>(
    select({ count: sql`COUNT(*)` }).from("notes")
  );

  const addNote = useRunQuery(currentDb, (db) => async () => {
    const id = makeId();

    await runQuery(
      db,
      insert({
        id,
        title: `Note#${id}`,
      }).into("notes")
    );
  });

  return (
    <>
      <button onClick={addNote}>Add note</button>
      <div>Add note result: {addNote.state.value}</div>
      <div>Query result (total notes count: {notesCount.data?.count})</div>
      <pre>{JSON.stringify(notes)}</pre>
    </>
  );
};
```
