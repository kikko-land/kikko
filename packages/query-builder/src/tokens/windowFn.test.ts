import { sql } from "@trong-orm/sql";
import { describe, expect, it } from "vitest";

import { gtEq$, or } from "./binary";
import { windowFn } from "./windowFn";

describe("windowFn", () => {
  it("works without specifying over", () => {
    expect(
      windowFn(sql`group_concat(b, '.')`)
        .filter({ q: gtEq$(5) })
        .filter(or({ q: gtEq$(5), a: 5 }))
        // .over(
        //   // windowBody()
        //   //   .fromBase("func")
        //   //   .partitionBy(sql``)
        //   //   .orderBy(desc("createdAt"))
        //   //   .withFrame(windowFrame("range"))
        // )
        .toSql().raw
    ).to.eq(
      `group_concat(b, '.') FILTER (WHERE  "q" >= 5 AND ("q" >= 5 OR "a" = 5) ) OVER ()`
    );
  });

  // it("works with select", () => {
  //   console.log(
  //     select().defineWindow(
  //       "name",
  //       windowBody()
  //         .fromBase("func")
  //         .partitionBy(sql``)
  //         .orderBy(desc("createdAt"))
  //         .withFrame(windowFrame("range"))
  //         .toSql()
  //     )
  //   );
  // });
});
