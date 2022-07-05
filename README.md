<p align="center">
  <h1 align="center">Trong ORM</h1>
</p>

<p align="center">
  <i>Build data heavy reactive interfaces on top of SQLite for any platform with any framework or lib.</i>
</p>

> ### Full documentation can be found on [the site](https://trong-orm.netlify.app/).
>
> ### Also you can check [example at CodeSanbox](https://codesandbox.io/s/react-trong-example-q0e9iu) (multi-tab is not supported due to CORS).

<br/>
<br/>

|   | Trong ORM |
| - | ------------ |
| ⚡️ **Fast on big datasets** | And even for web! It even faster then IndexedDB. You can easily store 1m+ records at table, and everything will work smoothly. The SQLite project exists for 22+ years, and team made a great job to bring an excellent performance. And you can also use the whole power of SQL DBs — like indexes, triggers or views. |
| 🚀 **Fast startup time** | You don't need to load the whole DB into memory, and it guarantees the fast startup time for you app. |
| 📱 **Wide platforms support** | Web, mobile(react-native, expo, cordova, ionic), desktop(electron, tauri). |
| 🧰 **Lib-agnostic** | Use with React or write adapter for your own lib. |
| 📦 **Out-of-the-box query builder** | We tried to add support of all possible SQLite queries could be. But you can still use raw SQL queries. |
| 🧩 **Good modularity** | You can use `@trong-orm/sql`/`@trong-orm/query-builder`/`@trong-orm/core` without need to require the full lib. Use the only package you need. |
| 🛠 **Plugin system** | Allows you to integrate your own code on query/transaction run. |
| 👯 **Multi-tab support for web** | Mutate DB in one tab, and your data will be updated in other. |
| 🥹 **Full typescript support** | Yes! |

<br/>
<br/>

https://user-images.githubusercontent.com/7958527/174773307-9be37e1f-0700-45b4-8d25-aa2c83df6cec.mp4

> **CAUTION: Right now multi-tab mode doesn't work correctly and crashes sometimes due to [this bug](https://github.com/jlongster/absurd-sql/issues/30) at absurd-sql repo.
> I am working to fix it.**

<br/>

## Supported platforms

| Platform         | Uses                                                                                                                                       | Package                                                               | Example                                                                              | Doc                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Vite             | [absurd-sql](https://github.com/jlongster/absurd-sql)                                                                                      | `@trong-orm/absurd-web-backend`                                       | [Link](https://github.com/trong-orm/trong-orm/tree/main/packages/vite-react-example) | [Link](https://trong-orm.netlify.app/backends/web#configuration-and-usage-with-vite)             |
| Create-react-app | [absurd-sql](https://github.com/jlongster/absurd-sql)                                                                                      | `@trong-orm/absurd-web-backend`                                       | [Link](https://github.com/trong-orm/trong-cra-example)                               | [Link](https://trong-orm.netlify.app/backends/web#configuration-and-usage-with-create-react-app) |
| Tauri + Vite     | [tauri-plugin-sqlite](https://github.com/lzdyes/tauri-plugin-sqlite)                                                                       | `@trong-orm/tauri-backend`                                            | [Link](https://github.com/trong-orm/trong-tauri-example)                             | [Link](https://trong-orm.netlify.app/backends/tauri)                                             |
| Expo             | [absurd-sql](https://github.com/jlongster/absurd-sql) for web, [expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for native | `@trong-orm/absurd-web-backend`<br/>`@trong-orm/native-expo-backend`  | [Link](https://github.com/trong-orm/trong-expo-example)                              | [Link](https://trong-orm.netlify.app/backends/expo)                                              |
| Electron         | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)                                                                               | `@trong-orm/electron-better-sqlite3-backend`                          | [Link](https://github.com/trong-orm/trong-electron-better-sqlite3-example)           | [Link](https://trong-orm.netlify.app/backends/electron)                                          |
| Ionic            | [@awesome-cordova-plugins/sqlite](https://www.npmjs.com/package/@awesome-cordova-plugins/sqlite)                                           | `@trong-orm/absurd-web-backend`<br/>`@trong-orm/native-ionic-backend` | [Link](https://github.com/trong-orm/trong-ionic-example)                             | [Link](https://trong-orm.netlify.app/backends/ionic)                                             |
| React Native     | [react-native-sqlite-storage](https://github.com/andpor/react-native-sqlite-storage)                                                       | WIP                                                                   | WIP                                                                                  | WIP                                                                                              |

## React quick example

```tsx
import { desc, like$, select } from "@trong-orm/query-builder";
import { makeId, sql, useQuery, useRunQuery } from "@trong-orm/react";
import { useState } from "react";

const notesTable = sql.table("notes");

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const { data: recordsData } = useQuery<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>(
    select()
      .from(notesTable)
      .where(
        textToSearch ? { content: like$("%" + textToSearch + "%") } : sql.empty
      )
      .orderBy(desc("createdAt"))
  );

  return (
    <>
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
