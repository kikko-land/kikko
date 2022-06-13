// TODO: problem with column name duplication
// maybe do https://mikro-orm.io/docs/query-conditions ?
// Actually not poblem! Could be duplicated in next where
// RULE: if object key — then it is identifier

import { sql } from "@trong-orm/sql";

import { alias } from "./tokens/alias";
import { gt$, or } from "./tokens/binary";
import { select } from "./tokens/select";
import { values } from "./tokens/values";

// If just string — then this val will be replaced(except alias)
console.log(
  select(
    { kek: select(sql`1`) },
    { kek: select(sql`1`) },
    alias(select("3"), "rer.kek")
  )
    .select("53")
    .distinct(true)
    .from(select("1"), select("2"))
    .groupBy(sql`strftime(kek, "Y")`)
    .where({ "k.kk": gt$(5) })
    .where(or({ kek: gt$(5), pog: gt$(2000) }))
    .orWhere({ wow: gt$(2000) })
    .limit(10)
    .offset(5)
    .union(select(sql`1`).limit(5))
    .union(values([3, 4], [5, 6]))
    .with("kek", ["n1", "n2"], values([3, 5]))
    .toSql()
    .inspect()
);

// console.log(Object.entries({ a: 5, w: gtEq$(6) }));
// console.log(or(eq(1, 2), eq(3, 4)).toSql().inspect());
// console.log(
//   or({ k: eq$(2), f: eq$(4) })
//     .toSql()
//     .inspect()
// );

// console.log(binaryOperator("=", raw("kk"), 4).toSql().inspect());
// console.log(
//   and(
//     { a: 5, w: gtEq$(6), k: in$(5, 6), wow: sql`(SELECT 1)` },
//     not(or({ kek: 1, puk: 0 })),
//     // TODO: if string — just strip, don't use "sql`...`"
//     eq(sql`test`, 55)
//   )
//     .toSql()
//     .inspect()
// );

// console.log(and({ wow: 5 }, { kek: 6 }).toSql().inspect());

// interface IWhereClause {}
// interface ISelectClause {
//   __discriminator:
//   whereStatement?: IWhereStatement;
// }

// // TODO:

// // statement
// // Select уже задаёт структуру хммм...
// const select;
