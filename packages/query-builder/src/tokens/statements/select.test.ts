import { sql } from "@trong-orm/sql";
import { describe, expect, it } from "vitest";

import { select } from "./select";

describe("select", () => {
  it("works", () => {
    expect(
      select()
        .from("notes")
        .toSql().raw
    ).to.eq('SELECT * FROM "notes"');

    expect(
      select({ a: sql`LOWER(X)` })
        .from("notes")
        .toSql().raw
    ).to.eq('SELECT LOWER(X) AS "a" FROM "notes"');
  });
});
