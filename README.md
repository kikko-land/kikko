<p align="center">
  <h1 align="center">Trong ORM</h1>
</p>

<p align="center">
  <i>Build reactive interfaces on top of SQLite for any platform with any framework/lib.</i>
</p>

> ### Full documentation can be found on [the site](https://trong-orm.netlify.app/)

## Introduction

Trong ORM allows you to run reactive SQLite queries on any platforms with any framework/lib. For the web apps it uses absurd-sql, for electron/react-native/ionic — native sqlite calls(WIP). It supports React, Vue(WIP), Angular(WIP). It is actually framework/lib-agnostic, so you can integrate it to any framework/render libs you want.

It provides out-of-the-box query builder, and we tried to add support of all possible SQLite queries could be. But you can still use raw SQL queries.

Overall, this lib is very modular and every package could be used separately. It could be adopted to any framework or SQLite backends. It also supports plugin system, so you can inject your own code on any query or transaction run.

https://user-images.githubusercontent.com/7958527/174773307-9be37e1f-0700-45b4-8d25-aa2c83df6cec.mp4

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
