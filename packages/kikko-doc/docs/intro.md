---
sidebar_position: 1
slug: /
---

# Intro

Kikko allows you to run reactive SQLite queries on any platforms with any framework/lib. For the web apps it uses absurd-sql, for electron/react-native/ionic — native sqlite calls. It is actually lib-agnostic, so you can integrate it to any framework/render libs you want.

Actually, what kikko is:

1. Correct transaction handling, with transaction and queries queue
2. Middlewares api, to intercept all running queries
3. Built-in profiler

And it also require db backend that should implement required interface. Other things, like reactivePlugin or migrationPlugin, are optional.

## Features

|                                  | Kikko                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⚖️ **Tiny size**                 | < 15kb size in gzip [for `@kikko-land/react`](https://bundlephobia.com/package/@kikko-land/react)!                                                                 |
| 📱 **Wide platforms support**    | Web, mobile(react-native, expo, cordova, ionic), desktop(electron, tauri).                                                                                         |
| 🧰 **Lib-agnostic**              | Use with **React**, **Vue**, Svelte (WIP), Angular (WIP) or any other lib/framework you want.                                                                      |
| 🐛 **Easy to debug**             | Kikko colorize queries, so, for example, you can easily understand to which transaction query belongs. He also meausures preparation, transfer and execution time. |
| 🔐 **Secured by default**        | With template literals, all vars that are used will be automatically marked as prepared statement variable that reduce chances of SQL injections a lot.            |
| 🛠 **Plugin system**              | Allows you to integrate your own code on query/transaction run.                                                                                                    |
| 👯 **Multi-tab support for web** | Insert row in one tab, and your data will be updated in the other.                                                                                                 |

## Simple React component example

```tsx
import {
  makeId,
  sql,
  useDbQuery,
  useFirstRowDbQuery,
  useRunDbQuery,
} from "@kikko-land/react";

type Note = { id: string; title: string };
const notesTable = sql.table`notes`;

export const Notes = () => {
  const notes = useDbQuery<Note>(sql`SELECT * FROM ${notesTable}`);
  const notesCount = useFirstRowDbQuery<{ count: number }>(
    sql`SELECT COUNT(*) FROM ${notesTable}`
  );

  const [addNote, addNoteState] = useRunDbQuery((db) => async () => {
    const id = makeId();

    await db.runQuery(
      sql`INSERT INTO ${notesTable}(id, title) VALUES(${id}, ${`Note#${id}`})`
    );
  });

  return (
    <>
      <button
        onClick={addNote}
        disabled={
          addNoteState.type === "running" || addNoteState.type === "waitingDb"
        }
      >
        Add note
      </button>
      <div>Add note result: {JSON.stringify(addNoteState)}</div>
      <div>Query result (total notes count: {notesCount.data?.count})</div>
      <pre>{JSON.stringify(notes)}</pre>
    </>
  );
};
```

<br/>

## Supported platforms

| Platform           | Uses                                                                                                                                                                  | Package                                                                 | Example                                                                           | Doc                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Vite + React       | [@kikko-land/better-absurd-sql](https://github.com/kikko-land/better-absurd-sql)                                                                                      | `@kikko-land/absurd-web-backend`                                        | [Link](https://github.com/kikko-land/kikko/tree/main/packages/vite-react-example) | [Link](https://kikko-doc.netlify.app/backends/web#configuration-and-usage-with-vite)             |
| Tauri + Vite + Vue | [tauri-plugin-sqlite](https://github.com/lzdyes/tauri-plugin-sqlite)                                                                                                  | `@kikko-land/tauri-backend`                                             | [Link](https://github.com/kikko-land/kikko-tauri-vue)                             | [Link](https://kikko-doc.netlify.app/backends/tauri)                                             |
| Create-react-app   | [@kikko-land/better-absurd-sql](https://github.com/kikko-land/better-absurd-sql)                                                                                      | `@kikko-land/absurd-web-backend`                                        | [Link](https://github.com/kikko-land/kikko-cra-example)                           | [Link](https://kikko-doc.netlify.app/backends/web#configuration-and-usage-with-create-react-app) |
| Expo               | [@kikko-land/better-absurd-sql](https://github.com/kikko-land/better-absurd-sql) for web, [expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for native | `@kikko-land/absurd-web-backend`<br/>`@kikko-land/native-expo-backend`  | [Link](https://github.com/kikko-land/kikko-expo-example)                          | [Link](https://kikko-doc.netlify.app/backends/expo)                                              |
| Electron           | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)                                                                                                          | `@kikko-land/electron-better-sqlite3-backend`                           | [Link](https://github.com/kikko-land/kikko-electron-better-sqlite3-example)       | [Link](https://kikko-doc.netlify.app/backends/electron)                                          |
| Ionic              | [@awesome-cordova-plugins/sqlite](https://www.npmjs.com/package/@awesome-cordova-plugins/sqlite)                                                                      | `@kikko-land/absurd-web-backend`<br/>`@kikko-land/native-ionic-backend` | [Link](https://github.com/kikko-land/kikko-ionic-example)                         | [Link](https://kikko-doc.netlify.app/backends/ionic)                                             |
| React Native       | [react-native-sqlite-storage](https://github.com/andpor/react-native-sqlite-storage)                                                                                  | `@kikko-land/react-native-backend`                                      | [Link](https://github.com/kikko-land/kikko-react-native-example)                  | [Link](https://kikko-doc.netlify.app/backends/react-native/)                                     |
| Cloudflare D1      | Cloudflare D1                                                                                                                                                         | `@kikko-land/d1-backend`                                                | [Link](https://github.com/kikko-land/kikko/tree/main/packages/d1-example)         | [Link](https://kikko-doc.netlify.app/backends/d1)                                                |
