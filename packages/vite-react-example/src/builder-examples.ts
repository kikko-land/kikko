import {
  alias,
  and,
  asc,
  deleteFrom,
  desc,
  eq$,
  gtEq,
  gtEq$,
  in$,
  insert,
  like$,
  ltEq$,
  naturalLeftOuterJoin,
  not,
  or,
  select,
  update,
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

// Delete statements

console.log(
  deleteFrom("notes")
    .with({
      table: "people_cte",
      columns: ["name", "id"],
      select: values(["Andrew", 1], ["Dima", 2], ["Sergey", 3]),
    })
    .where({ id: in$(select("id").from("people_cte")) })
    .returning("*")
    .toSql().raw
);

// Update statements

console.log(
  update("inventory")
    .orReplace()
    .with({
      table: "people_cte",
      columns: ["name", "id"],
      select: values(["Andrew", 1], ["Dima", 2], ["Sergey", 3]),
    })
    .set({ quantity: sql`quantity - daily.amt` })
    .from(
      alias(
        select({ amt: sql`SUM(quantity)` }, "itemId")
          .from("sales")
          .groupBy(sql`2`),
        "daily"
      )
    )
    .where({
      "inventory.itemId": sql`daily.itemId`,
    })
    .returning("*")
    .toSql().raw
);

// Insert statements

console.log(
  insert(
    select()
      .from("users")
      .where({ age: gtEq$(18) })
  )
    .into("adults")
    .toSql().raw
);

console.log(
  insert(select().from("people_cte"))
    .with({
      table: "people_cte",
      columns: ["name", "id"],
      select: values(["Andrew", 1], ["Dima", 2], ["Sergey", 3]),
    })
    .into("adults")
    .toSql().raw
);

console.log(
  insert(values(["Andrew", 1], ["Dima", 2], ["Sergey", 3]))
    .setColumnNames(["name", "age"])
    .into("adults")
    .toSql().raw
);

console.log(
  insert([
    { id: 1, name: "Dima" },
    { id: 2, name: "Andrew" },
  ])
    .orReplace()
    .into("adults")
    .returning("*")
    .toSql().raw
);

// TODO: add alias support to join({alias: select().from('notes')})
console.log(naturalLeftOuterJoin("notes").on({ a: "b" }).toSql().raw);
