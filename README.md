<p align="center">
  <h1 align="center">Trong ORM</h1>
</p>

<p align="center">
  <i>Build reactive interfaces on top of SQLite for any platform with any framework or lib.</i>
</p>

> ### Full documentation can be found on [the site](https://trong-orm.netlify.app/)

> **CAUTION: Right now multi-tab mode doesn't work correctly and crashes sometimes due to [this bug](https://github.com/jlongster/absurd-sql/issues/30) at absurd-sql repo.
> I am working to fix it.**

Trong ORM allows you to run reactive SQLite queries on any platforms with any framework/lib. For the web apps it uses absurd-sql, for electron/react-native/ionic — native sqlite calls(WIP). It supports React, Vue(WIP), Angular(WIP). It is actually framework/lib-agnostic, so you can integrate it to any framework/render libs you want.

## Core features

- Lib or framework agnostic — use with React, Angular, Vue or write adapter for your own lib
- Run on any platform — web, mobile(react-native/expo, cordova/ionic), desktop(electron, tauri)
- Full typescript support
- Out-of-the-box [query builder](https://trong-orm.netlify.app/building-sql/query-builder). We tried to add support of all possible SQLite queries could be. But you can still use [raw SQL queries](https://trong-orm.netlify.app/building-sql/raw).
- It is very modular. You can use `@trong-orm/sql`/`@trong-orm/query-builder`/`@trong-orm/core` without need to require the full lib. Use the only package you need
- Multi-tab support for web. Mutate DB in one tab, and your data will be updated in other
- [Plugin system](https://trong-orm.netlify.app/plugins/creating-your-own) allows you to integrate your own code on query/transaction run

https://user-images.githubusercontent.com/7958527/174773307-9be37e1f-0700-45b4-8d25-aa2c83df6cec.mp4

[Source code](https://github.com/trong-orm/trong-orm/tree/main/packages/vite-react-example)

## Currently supported

### SQLite Backends

**Expo**: full support (both web and native)<br>
**Web**: full support<br>
**Electron**: WIP<br>
**Tauri**: WIP<br>
**Cordova/Ionic**: WIP<br>

### Frameworks or render libs

**React**: full support<br>
**Angular**: WIP<br>
**Vue**: WIP<br>
**SolidJS**: WIP

## It's better than IndexedDB

Read performance: doing something like `SELECT SUM(value) FROM kv`:

<img width="610" src="https://user-images.githubusercontent.com/7958527/174833698-50083d30-2c2d-44a0-9f86-1e4ea644f4c4.png" />

Write performance: doing a bulk insert:

<img width="610" src="https://user-images.githubusercontent.com/7958527/174833809-0fe78929-1c01-4ad9-b39e-12baf3f196ce.png" />

The graphs are taken from [absurd-sql](https://github.com/jlongster/absurd-sql) repo.

Overall, it works more consistent than IndexedDB. It is very often the case when IndexedDB crashes, but due to absurd-sql makes simple blocks read and writes, SQLite works more consistently.

## Usage examples

With CRA:
https://github.com/trong-orm/trong-cra-example

With Vite + React:
https://github.com/trong-orm/trong-orm/tree/main/packages/vite-react-examples

With Expo(native+web): https://github.com/trong-orm/trong-expo-example
