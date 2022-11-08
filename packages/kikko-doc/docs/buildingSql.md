---
slug: /building-sql
---

# Building sql

The idea taken from [sql-template-tag](https://github.com/blakeembrey/sql-template-tag), big thanks to the author! It uses the power of ES2015 tagged template string for preparing SQL statements. Actually the whole query builder build on top of the `@kikko-land/sql`.

When you using raw queries, you need to follow one rule to keep your queries reactive:

:::info
Always use `sql.table('tableName')` or `` sql.table`tableName` `` when you reference to the table in the query. It allows to keep your queries reactive.

```typescript
import { sql } from "@kikko-land/boono-sql";

const booksTables = sql.table`books`;
sql`SELECT * FROM ${booksTables}`;
sql`INSERT INTO ${booksTables} VALUES (1, 2, 3)`;
```

:::

## Installation

```bash
npm install @kikko-land/boono-sql --save
```

Or

```bash
yarn add @kikko-land/boono-sql
```

## Usage examples

<iframe
  src="https://codesandbox.io/embed/spring-cloud-o3uke2?fontsize=14&hidenavigation=1&theme=dark&view=editor"
  style={{
    width: "100%",
    height: "500px",
    border: 0,
    "border-radius": "4px",
    overflow: "hidden",
  }}
  title="@kikko-land/sql example"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
