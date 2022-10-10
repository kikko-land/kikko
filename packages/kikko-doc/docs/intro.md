---
sidebar_position: 1
slug: /
---

# Intro

Kikko allows you to run reactive SQLite queries on any platforms with any framework/lib. For the web apps it uses absurd-sql, for electron/react-native/ionic — native sqlite calls. It is actually lib-agnostic, so you can integrate it to any framework/render libs you want.

## Features

|                                     | Kikko                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚡️ **Fast on big datasets**        | And even for web! It even faster then IndexedDB. You can easily store 100k+ records at table, and everything will work smoothly. The SQLite project exists for 22+ years, and team made a great job to bring an excellent performance. And you can also use the whole power of SQL DBs — like indexes, triggers or views. |
| ⚖️ **Tiny size**                    | < 10kb size in gzip [for `@kikko-land/react`](https://bundlephobia.com/package/@kikko-land/react)!                                                                                                                                                                                                                        |
| 🚀 **Fast startup time**            | You don't need to load the whole DB into memory, and it guarantees the fast startup time for you app.                                                                                                                                                                                                                     |
| 📱 **Wide platforms support**       | Web, mobile(react-native, expo, cordova, ionic), desktop(electron, tauri).                                                                                                                                                                                                                                                |
| 🧰 **Lib-agnostic**                 | Use with React, Vue, Svelte (WIP), Angular (WIP) or any other lib/framework you want.                                                                                                                                                                                                                                     |
| 📦 **Out-of-the-box query builder** | We tried to add support of all possible SQLite queries could be. But you can still use raw SQL queries.                                                                                                                                                                                                                   |
| 🧩 **Good modularity**              | You can use `@kikko-land/sql`/`@kikko-land/query-builder`/`@kikko-land/kikko` without need to require the full lib. Use the only package you need.                                                                                                                                                                        |
| 🛠 **Plugin system**                 | Allows you to integrate your own code on query/transaction run.                                                                                                                                                                                                                                                           |
| 👯 **Multi-tab support for web**    | Mutate DB in one tab, and your data will be updated in other.                                                                                                                                                                                                                                                             |
| 🥹 **Full typescript support**       | Yes!                                                                                                                                                                                                                                                                                                                      |

<br />
<br />

<video controls style={{ maxWidth: "100%" }}>

  <source src="https://user-images.githubusercontent.com/7958527/174773307-9be37e1f-0700-45b4-8d25-aa2c83df6cec.mp4" />
</video>

[Source code of example](https://github.com/kikko-land/kikko/tree/main/packages/vite-react-example) <br/>
[CodeSandbox example](https://codesandbox.io/s/react-trong-example-q0e9iu)

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

## It's better than IndexedDB

Read performance: doing something like `SELECT SUM(value) FROM kv`:

<img
  width="610"
  src="https://user-images.githubusercontent.com/7958527/174833698-50083d30-2c2d-44a0-9f86-1e4ea644f4c4.png"
/>

Write performance: doing a bulk insert:

<img
  width="610"
  src="https://user-images.githubusercontent.com/7958527/174833809-0fe78929-1c01-4ad9-b39e-12baf3f196ce.png"
/>

The graphs are taken from [absurd-sql](https://github.com/jlongster/absurd-sql) repo.

Overall, it works more consistent than IndexedDB. It is very often the case when IndexedDB crashes, but due to absurd-sql makes simple blocks read and writes, SQLite works more consistently.
