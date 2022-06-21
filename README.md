# Trong

Trong ORM is a JavaScript library for building reactive SQLite queries.

## Installation for React

```
yarn add @trong-orm/react @trong-orm/query-builder @trong-orm/sql.js
```

Or

```
npm i -S @trong-orm/react @trong-orm/query-builder @trong-orm/sql.js
```

## Code example with React

Searching text:

```typescript
import { useQuery, useQueryFirstRow, useSql } from "@trong-orm/react-hooks";
import { empty, sql, table } from "@trong-orm/sql";
import { useState } from "react";

const notesTable = table("notes");

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const baseSql = useSql(
    sql`SELECT * FROM ${notesTable} ${
      textToSearch ? sql`WHERE content LIKE ${"%" + textToSearch + "%"}` : empty
    }`
  );

  const { data: recordsData } = useQuery<{
    id: string;
    title: string;
    content: string;
  }>(
    sql`SELECT * FROM ${notesTable} ${
      textToSearch ? sql`WHERE content LIKE ${"%" + textToSearch + "%"}` : empty
    }`
  );

  const countResult = useQueryFirstRow<{ count: number }>(
    sql`SELECT count(*) as count FROM (${baseSql})`
  );

  return (
    <>
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
      {recordsData.map(({ title, content, id }) => (
        <div key={id}>
          <h1>{title}</h1>
          <div>{content}</div>
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
