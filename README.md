<p align="center">
  <h1 align="center">Kikko(Trong ORM in past)</h1>
</p>

<p align="center">
  <i>Kikko is a wrapper around SQLite interfaces. It brings transaction support, middlewares for queries, and SQLite adapters for the most popular platforms (checkout supported platforms). <br> <br> Build data heavy reactive interfaces on top of SQLite for any platform with any framework or lib.</i>
</p>

> ### Full documentation can be found on [the site](https://trong-orm.netlify.app/).
>
> ### Also you can check [example at CodeSanbox](https://codesandbox.io/s/react-trong-example-q0e9iu) (multi-tab is not supported due to CORS).

<br/>
<br/>

|                                     | Kikko                                                                                                                                                                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚡️ **Fast on big datasets**        | And even for web! It even faster then IndexedDB. You can easily store 1m+ records at table, and everything will work smoothly. The SQLite project exists for 22+ years, and team made a great job to bring an excellent performance. And you can also use the whole power of SQL DBs — like indexes, triggers or views. |
| 🚀 **Fast startup time**            | You don't need to load the whole DB into memory, and it guarantees the fast startup time for you app.                                                                                                                                                                                                                   |
| 📱 **Wide platforms support**       | Web, mobile(react-native, expo, cordova, ionic), desktop(electron, tauri).                                                                                                                                                                                                                                              |
| 🧰 **Lib-agnostic**                 | Use with React or write adapter for your own lib.                                                                                                                                                                                                                                                                       |
| 📦 **Out-of-the-box query builder** | We tried to add support of all possible SQLite queries could be. But you can still use raw SQL queries.                                                                                                                                                                                                                 |
| 🧩 **Good modularity**              | You can use `@kikko-land/sql`/`@kikko-land/query-builder`/`@kikko-land/core` without need to require the full lib. Use the only package you need.                                                                                                                                                                          |
| 🛠 **Plugin system**                 | Allows you to integrate your own code on query/transaction run.                                                                                                                                                                                                                                                         |
| 👯 **Multi-tab support for web**    | Mutate DB in one tab, and your data will be updated in other.                                                                                                                                                                                                                                                           |
| 🥹 **Full typescript support**       | Yes!                                                                                                                                                                                                                                                                                                                    |

<br/>
<br/>

https://user-images.githubusercontent.com/7958527/174773307-9be37e1f-0700-45b4-8d25-aa2c83df6cec.mp4

[Source code](https://github.com/kikko-land/kikko/tree/main/packages/vite-react-example) <br/>
[CodeSandbox example](https://codesandbox.io/s/react-trong-example-q0e9iu)

> **CAUTION: Right now multi-tab mode doesn't work correctly and crashes sometimes due to [this bug](https://github.com/jlongster/absurd-sql/issues/30) at absurd-sql repo.
> I am working to fix it.**

<br/>

## Supported platforms

| Platform         | Uses                                                                                                                                                                | Package                                                               | Example                                                                              | Doc                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Vite             | [@trong-orm/better-absurd-sql](https://github.com/trong-orm/better-absurd-sql)                                                                                      | `@trong-orm/absurd-web-backend`                                       | [Link](https://github.com/trong-orm/trong-orm/tree/main/packages/vite-react-example) | [Link](https://trong-orm.netlify.app/backends/web#configuration-and-usage-with-vite)             |
| Create-react-app | [@trong-orm/better-absurd-sql](https://github.com/trong-orm/better-absurd-sql)                                                                                      | `@trong-orm/absurd-web-backend`                                       | [Link](https://github.com/trong-orm/trong-cra-example)                               | [Link](https://trong-orm.netlify.app/backends/web#configuration-and-usage-with-create-react-app) |
| Tauri + Vite     | [tauri-plugin-sqlite](https://github.com/lzdyes/tauri-plugin-sqlite)                                                                                                | `@trong-orm/tauri-backend`                                            | [Link](https://github.com/trong-orm/trong-tauri-example)                             | [Link](https://trong-orm.netlify.app/backends/tauri)                                             |
| Expo             | [@trong-orm/better-absurd-sql](https://github.com/trong-orm/better-absurd-sql) for web, [expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for native | `@trong-orm/absurd-web-backend`<br/>`@trong-orm/native-expo-backend`  | [Link](https://github.com/trong-orm/trong-expo-example)                              | [Link](https://trong-orm.netlify.app/backends/expo)                                              |
| Electron         | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)                                                                                                        | `@trong-orm/electron-better-sqlite3-backend`                          | [Link](https://github.com/trong-orm/trong-electron-better-sqlite3-example)           | [Link](https://trong-orm.netlify.app/backends/electron)                                          |
| Ionic            | [@awesome-cordova-plugins/sqlite](https://www.npmjs.com/package/@awesome-cordova-plugins/sqlite)                                                                    | `@trong-orm/absurd-web-backend`<br/>`@trong-orm/native-ionic-backend` | [Link](https://github.com/trong-orm/trong-ionic-example)                             | [Link](https://trong-orm.netlify.app/backends/ionic)                                             |
| React Native     | [react-native-sqlite-storage](https://github.com/andpor/react-native-sqlite-storage)                                                                                | `@trong-orm/react-native-backend`                                     | [Link](https://github.com/trong-orm/trong-react-native-example)                      | [Link](https://trong-orm.netlify.app/backends/react-native/)                                     |

## React quick example for vite

For the other platforms installation, please, refer to [the doc](https://trong-orm.netlify.app/installation).

Install trong:

```bash
yarn add @trong-orm/react @trong-orm/query-builder @trong-orm/sql.js @trong-orm/absurd-web-backend

// Or

npm i -S @trong-orm/react @trong-orm/query-builder @trong-orm/sql.js @trong-orm/absurd-web-backend
```

Then configure trong at `App.tsx`:

```ts
import { absurdWebBackend } from "@trong-orm/absurd-web-backend";
import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  IMigration,
  migrationsPlugin,
  reactiveQueriesPlugin,
  runQuery,
  sql,
} from "@trong-orm/react";
import sqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm?url";

import { List } from "./List";

const createNotesTable: IMigration = {
  up: async (db) => {
    await runQuery(
      db,
      sql`
      CREATE TABLE IF NOT EXISTS notes (
        id varchar(20) PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `
    );

    await runQuery(
      db,
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
    migrationsPlugin({ migrations: [createNotesTable] }),
    reactiveQueriesPlugin(),
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
```

And create `List.tsx` file:

```tsx
import {
  deleteFrom,
  desc,
  insert,
  like$,
  select,
} from "@trong-orm/query-builder";
import {
  makeId,
  runAfterTransactionCommitted,
  runQuery,
  sql,
  useQuery,
  useQueryFirstRow,
  useRunQuery,
} from "@trong-orm/react";
import { useState } from "react";

const notesTable = sql.table("notes");

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const baseSql = select()
    .from(notesTable)
    .where(
      textToSearch ? { content: like$("%" + textToSearch + "%") } : sql.empty
    )
    .orderBy(desc("createdAt"));

  const { data: recordsData } = useQuery<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>(baseSql);

  const countResult = useQueryFirstRow<{ count: number }>(
    select({ count: sql`COUNT(*)` }).from(baseSql)
  );

  const [createNote, createNoteState] = useRunQuery(
    (db) =>
      async ({ title, content }: { title: string; content: string }) => {
        const time = new Date().getTime();
        await runQuery(
          db,
          insert({
            id: makeId(),
            title,
            content,
            updatedAt: time,
            createdAt: time,
          }).into(notesTable)
        );
      }
  );

  const [deleteAll, deleteAllState] = useRunQuery((db) => async () => {
    await runQuery(db, deleteFrom(notesTable));

    runAfterTransactionCommitted(db, () => {
      console.log("It runs after transaction committed!");
    });
  });

  return (
    <>
      <form
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSubmit={(e: any) => {
          e.preventDefault();
          const title = e.target.title.value;
          const content = e.target.content.value;

          createNote({ title, content });
        }}
      >
        <label>
          Title
          <input name="title" required />
        </label>
        <br />
        <br />
        <label>
          Content
          <textarea name="content" required />
        </label>

        <br />
        <br />

        <button
          type="submit"
          disabled={
            createNoteState.type === "running" ||
            createNoteState.type === "waitingDb"
          }
        >
          {createNoteState.type === "running" ? "Loading..." : "Submit"}
        </button>
      </form>
      <br />
      <button
        type="submit"
        disabled={
          deleteAllState.type === "running" ||
          deleteAllState.type === "waitingDb"
        }
        onClick={deleteAll}
      >
        {deleteAllState.type === "running" ? "Loading..." : "Delete all"}
      </button>
      <hr />
      Total found records:{" "}
      {countResult.data !== undefined ? countResult.data.count : "Loading..."}
      <br />
      <br />
      <input
        value={textToSearch}
        onChange={(e) => {
          setTextToSearch(e.target.value);
        }}
        placeholder="Search content"
      />
      <br />
      {recordsData.map(({ title, content, id, createdAt }) => (
        <div key={id}>
          <h1>{title}</h1>
          <div>Created at: {new Date(createdAt).toISOString()}</div>
          <br />
          <div>Content: {content}</div>
        </div>
      ))}
    </>
  );
};
```

Also checkout [example](https://codesandbox.io/s/react-trong-example-q0e9iu) at sandbox.

All components that subscribed to particular tables will rendered when tables will be mutated.
You can also check [how reactivity works](https://trong-orm.netlify.app/how-reactivity-works) in the doc.

## It's better than IndexedDB

Read performance: doing something like `SELECT SUM(value) FROM kv`:

<img width="610" src="https://user-images.githubusercontent.com/7958527/174833698-50083d30-2c2d-44a0-9f86-1e4ea644f4c4.png" />

Write performance: doing a bulk insert:

<img width="610" src="https://user-images.githubusercontent.com/7958527/174833809-0fe78929-1c01-4ad9-b39e-12baf3f196ce.png" />

The graphs are taken from [absurd-sql](https://github.com/jlongster/absurd-sql) repo.

Overall, it works more consistent than IndexedDB. It is very often the case when IndexedDB crashes, but due to absurd-sql makes simple blocks read and writes, SQLite works more consistently.
