<p align="center">
  
![Dark-mix](https://user-images.githubusercontent.com/7958527/184724299-1ca49493-c35d-4ad7-82e7-c4375e07086f.svg)

<p align="center">
  <i>Kikko is a wrapper around SQLite interfaces. It brings transaction support, middlewares for queries, and SQLite adapters for the most popular platforms. <br> <br> Build data heavy reactive interfaces on top of SQLite for any platform with any framework or lib.</i>
</p>
</p>

> ### Full documentation can be found on [the site](https://kikko-doc.netlify.app/).
>
> ### Also you can check [React example at CodeSanbox](https://codesandbox.io/s/react-trong-example-q0e9iu) (multi-tab is not supported due to CORS).

<br/>
<br/>

|                                     | Kikko                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚖️ **Tiny size**                    | < 10kb size in gzip [for `@kikko-land/react`](https://bundlephobia.com/package/@kikko-land/react)!                                                                                                                                                                                                                      |
| 📱 **Wide platforms support**       | Web, mobile(react-native, expo, cordova, ionic), desktop(electron, tauri).                                                                                                                                                                                                                                              |
| 🧰 **Lib-agnostic**                 | Use with **React**, **Vue**, Svelte (WIP), Angular (WIP) or any other lib/framework you want.                                                                                                                                                                                                                           |
| 🐛 **Easy to debug**              | Kikko colorize queries, so, for example, you can easily understand to which transaction query belongs. He also meausures preparation, transfer and execution time. |
| 🔐 **Secured by default** | With template literals, all vars that are used will be automatically marked as prepared statement variable that reduce chances of SQL injections a lot. |
| 🛠 **Plugin system**                 | Allows you to integrate your own code on query/transaction run.                                                                                                                                                                                                                                                         |
| 👯 **Multi-tab support for web**    | Insert row in one tab, and your data will be updated in the other.                                                                                                                                                                                                                                                           |
| 🥹 **Full typescript support**       | Yes!                                                                                                                                                                                                                                                                                                                    |

<br/>
<br/>

https://user-images.githubusercontent.com/7958527/174773307-9be37e1f-0700-45b4-8d25-aa2c83df6cec.mp4

[Source code](https://github.com/kikko-land/kikko/tree/main/packages/vite-react-example) <br/>
[CodeSandbox example](https://codesandbox.io/s/react-trong-example-q0e9iu)

> **CAUTION: Right now multi-tab mode doesn't work correctly and crashes sometimes due to [this bug](https://github.com/jlongster/absurd-sql/issues/30) at absurd-sql repo.**

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

## WASM SQLite is better than IndexedDB

Read performance: doing something like `SELECT SUM(value) FROM kv`:

<img width="610" src="https://user-images.githubusercontent.com/7958527/174833698-50083d30-2c2d-44a0-9f86-1e4ea644f4c4.png" />

Write performance: doing a bulk insert:

<img width="610" src="https://user-images.githubusercontent.com/7958527/174833809-0fe78929-1c01-4ad9-b39e-12baf3f196ce.png" />

The graphs are taken from [absurd-sql](https://github.com/jlongster/absurd-sql) repo.

Overall, it works more consistent than IndexedDB. It is very often the case when IndexedDB crashes, but due to absurd-sql makes simple blocks read and writes, SQLite works more consistently.
