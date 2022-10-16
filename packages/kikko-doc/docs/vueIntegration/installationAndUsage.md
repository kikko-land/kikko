---
sidebar_position: 1
slug: /vue-integration/installation
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Installation And Usage

Install core packages:

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/vue
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/vue
```

  </TabItem>
</Tabs>

You also need to install and configure SQLite backend you need. Please, checkout [backend section](/backends/web) in the doc for more info.

After create file `currentDb.ts` that will be storing the db state:

```ts
import { Ref, shallowRef } from "vue";
import { IDbInitState } from "@kikko-land/vue";

export const currentDb = shallowRef<IDbInitState>({
  type: "notInitialized",
}) as Ref<IDbInitState>;
```

And in the root component initialize the db:

```html
<script setup lang="ts">
  import {
    IMigration,
    migrationsPlugin,
    useInitDb,
    runQuery,
    sql,
    reactiveQueriesPlugin,
  } from "@kikko-land/vue";
  import { currentDb } from "./currentDb";

  const createNotesTableMigration: IMigration = {
    up: async (db) => {
      await db.runQuery(
        sql`CREATE TABLE notes (id varchar(20) PRIMARY KEY, title TEXT NOT NULL);`
      );
    },
    id: 18,
    name: "createNotesTable",
  };

  useInitDb(currentDb, {
    dbName: "helloWorld",
    dbBackend: /* Replace null with backend you need here. See the backend section guide */ null,
    plugins: [
      migrationsPlugin({ migrations: [createNotesTableMigration] }),
      reactiveQueriesPlugin(),
    ],
  });
</script>
```

And use it:

```html
<script setup lang="ts">
  import {
    useQuery,
    useQueryFirstRow,
    useRunQuery,
    makeId,
    runQuery,
  } from "@kikko-land/vue";
  import { currentDb } from "./currentDb";

  type Note = { id: string; title: string };

  const notesTable = sql.table`notes`;
  const notes = useQuery<Note>(currentDb, sql`SELECT * FROM ${notesTable}`);

  const notesCount = useQueryFirstRow<{ count: number }>(
    currentDb,
    sql`SELECT COUNT(*) FROM ${notesTable}`
  );

  const addNote = useRunQuery(currentDb, (db) => async () => {
    const id = makeId();

    await db.runQuery(
      sql`INSERT INTO ${notesTable}(id, title) VALUES(${id}, ${`Note#${id}`})`
    );
  });
</script>

<template>
  <button @click="addNote.run()">Add note</button>
  <div>Add note result: {{ addNote.state.value }}</div>
  <div>Query result (total notes count: {{ notesCount.data?.count }})</div>
  <pre :style="{ 'text-align': 'left' }">{{ notes }}</pre>
</template>
```
