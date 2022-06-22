import {
  alias,
  and,
  asc,
  desc,
  eq$,
  gtEq,
  gtEq$,
  like$,
  ltEq$,
  not,
  or,
  select,
  values,
} from "@trong-orm/query-builder";
import { sql } from "@trong-orm/sql";

// Queries below has correct syntax, but the logic of selecting is
// absurd. The code just shows the use cases.

// Select
console.log(
  select(
    { col1: select(sql`1`) },
    { col2: select(sql`1`) },
    alias(select("3"), "other_column")
  )
    .distinct(true)
    .from(select().from("books").limit(10))
    .where(not(and({ title: eq$("Harry Potter") }, { pages: gtEq$(5) })))
    .where(or({ title: eq$("Little Prince"), otherCol: like$("Little") }))
    // Or you can use the full version, like gtEq(col, val)
    .where(gtEq("pages", 10))
    // You can also use raw sql in where
    .orWhere(sql`books.type1 = "type1"`, sql`books.type2 = "type2"`)
    .orderBy(desc("createdAt"), asc("updatedAt"))
    .orderBy(asc("pages", "NULLS FIRST"))
    .groupBy("books.author")
    .having(gtEq(sql`COUNT(pages)`, 5))
    // support union
    .union(select(sql`1`).limit(5))
    .toSql().raw
);

// CTE
console.log(
  select()
    .with({
      table: "people_cte",
      columns: ["name", "age"],
      select: values(["Andrew", 1], ["Dima", 2], ["Sergey", 3]),
    })
    .from("people_cte")
    .toSql().raw
);

// Values statements
console.log(values([1], [2], [3], [4], [5]).toSql().raw);

// It is especially helpful when you build filters
const maxAge: number | undefined = 5;
let query = select().from("people");
if (maxAge !== undefined) {
  query = query.where({ age: ltEq$(5) });
}
console.log(query.toSql().raw);
