---
sidebar_position: 1
slug: /building-sql/query-builder
---

# Query builder

All we know that it is often thing that query builders are sucks. Usually it happens because they need to support all SQL dialects, which are a lot.
But, with just one dialect, we managed to make a builder that will be flexible enough, and will support all the possible SQLite queries.

Also, it is fully immutable. When you make any object call, it returns a new object instance. It is especially helpful when you are building composable queries.

And if query builder functionality is not enough, you could always use [raw queries](raw) and even embed them into query builder. When you use
raw builder your queries still remain reactive (but you need to mark tables you use with `sql.table('tableName')`).

For now, it still misses some functionality like create table/create trigger. We plan to add support for them too.

## Installation

```bash
npm install @kikko-land/boono --save
```

Or

```bash
yarn add @kikko-land/boono
```

## Select statements usage examples

<iframe
  src="https://codesandbox.io/embed/trong-orm-query-builder-select-examples-xcvzn5?expanddevtools=1&fontsize=14&hidenavigation=1&theme=dark"
  style={{
    width: "100%",
    height: "500px",
    border: 0,
    "border-radius": "4px",
    overflow: "hidden",
  }}
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

## Insert statements usage examples

<iframe
  src="https://codesandbox.io/embed/trong-orm-query-builder-insert-examples-euh98c?expanddevtools=1&fontsize=14&hidenavigation=1&theme=dark"
  style={{
    width: "100%",
    height: "500px",
    border: 0,
    "border-radius": "4px",
    overflow: "hidden",
  }}
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

## Update statements usage examples

<iframe
  src="https://codesandbox.io/embed/trong-orm-query-builder-update-examples-rvo6ii?expanddevtools=1&fontsize=14&hidenavigation=1&theme=dark"
  style={{
    width: "100%",
    height: "500px",
    border: 0,
    "border-radius": "4px",
    overflow: "hidden",
  }}
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

## Delete statements usage examples

<iframe
  src="https://codesandbox.io/embed/trong-orm-query-builder-delete-examples-ezzpz0?expanddevtools=1&fontsize=14&hidenavigation=1&theme=dark"
  style={{
    width: "100%",
    height: "500px",
    border: 0,
    "border-radius": "4px",
    overflow: "hidden",
  }}
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
