# Trong ORM

Trong ORM is a library for building reactive SQLite queries to run on any platforms. For the web apps it uses [absurd-sql](https://github.com/jlongster/absurd-sql), for electron/react-native/ionic — native sqlite calls. It supports React, Vue(WIP), Angular(WIP). It is actually framework/lib-agnostic, so you can integrate it to any framework/render libs.

https://user-images.githubusercontent.com/7958527/174773307-9be37e1f-0700-45b4-8d25-aa2c83df6cec.mp4

It provides out-of-the-box query builder(it is smart enough, we tried to build it to support all possible SQLite queries), but you can still use raw SQL queries (and it supports safe SQL statements, the syntax is almost the same as [sql-template-tag](https://github.com/blakeembrey/sql-template-tag) has).

It also supply abstraction layer called `records`.

Overall, this lib is very modular, every package could be used separately. It could be adopted for any framework or SQLite backends. At also supports middlewares on query run, so you can inject your own logic (like queries cache).

## Up to 10x faster than IndexedDB

TODO: paste screenshots

The graphs are taken from [absurd-sql](https://github.com/jlongster/absurd-sql) repo.

https://user-images.githubusercontent.com/7958527/174773307-9be37e1f-0700-45b4-8d25-aa2c83df6cec.mp4

## Installation for React

```
yarn add @trong-orm/react @trong-orm/query-builder @trong-orm/sql.js
```

Or

```
npm i -S @trong-orm/react @trong-orm/query-builder @trong-orm/sql.js
```

If you are using absurd-backend web version make sure that right CORS are set, otherwise sql.js could be used only in one tab. See https://github.com/jlongster/absurd-sql#requirements for more info.

For CRA dev mode use proxy: https://github.com/facebook/create-react-app/issues/10210#issuecomment-873286336

For vite dev mode edit config:

```typescript
export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});
```

Then configure trong:

```typescript
import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  initAbsurdWebBackend,
  migrationPlugin,
  reactiveQueriesPlugin,
} from "@trong-orm/react";
import sqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm?url";
import React from "react";

const config: IInitDbClientConfig = {
  dbName: "db-name",
  dbBackend: initAbsurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    migrationPlugin([
      {
        up: async (db) => {
          const query = sql`
            CREATE TABLE IF NOT EXISTS notes (
              id varchar(20) PRIMARY KEY NOT NULL,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              updatedAt INTEGER NOT NULL,
              createdAt INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);
          `;

          await runQuery(db, query);
        },
        id: 1653668686076, // id should be unie
        name: "createNotesTable",
      },
    ]),
    reactiveQueriesPlugin,
  ],
};

export const App = () => {
  return (
    <React.StrictMode>
      <DbProvider config={config}>
        <EnsureDbLoaded fallback={<div>Loading db...</div>}>
          <List />
        </EnsureDbLoaded>
      </DbProvider>
    </React.StrictMode>
  );
};
```

And use:

```typescript
import {
  deleteFrom,
  desc,
  insert,
  like$,
  select,
} from "@trong-orm/query-builder";
import {
  runAfterTransactionCommitted,
  runQuery,
  sql,
  table,
  useQuery,
  useQueryFirstRow,
  useRunQuery,
} from "@trong-orm/react";
import { nanoid } from "nanoid";
import { useState } from "react";

const notesTable = table("notes");

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
    ({ title, content }: { title: string; content: string }) =>
      async (db) => {
        const time = new Date().getTime();
        await runQuery(
          db,
          insert({
            id: nanoid(),
            title,
            content,
            updatedAt: time,
            createdAt: time,
          }).into(notesTable)
        );
      }
  );

  const [deleteAll, deleteAllState] = useRunQuery(() => async (db) => {
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
            createNoteState.type === "loading" ||
            createNoteState.type === "waitingDb"
          }
        >
          {createNoteState.type === "loading" ? "Loading..." : "Submit"}
        </button>
      </form>
      <br />
      <button
        type="submit"
        disabled={
          deleteAllState.type === "loading" ||
          deleteAllState.type === "waitingDb"
        }
        onClick={deleteAll}
      >
        {deleteAllState.type === "loading" ? "Loading..." : "Delete all"}
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

## Usage example repositories

With CRA:
https://github.com/trong-orm/trong-cra-example

With Vite + React:
https://github.com/trong-orm/trong-orm/tree/main/packages/vite-react-examples
