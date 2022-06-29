import { sql } from "./sql";

export const generateInsert = (
  tableName: string,
  objs: Record<string, unknown>[],
  replace = false,
  returning = false
) => {
  if (objs.length === 0) throw new Error("Can't insert empty objects");

  const keys = Object.keys(objs[0]);

  const values = sql.join(
    objs.map((obj) => sql`(${sql.join(keys.map((k) => obj[k] as string))})`)
  );

  return sql`INSERT ${replace ? sql`OR REPLACE` : sql.empty} INTO ${sql.table(
    tableName
  )} (${sql.join(keys.map((k) => sql.raw(k)))}) VALUES ${values} ${
    returning ? sql`returning *` : sql.empty
  }`;
};

export const generateUpdate = (
  tableName: string,
  obj: Record<string, unknown>
) => {
  const values = sql.join(
    Object.entries(obj).map(([k, v]) => sql`${sql.raw(k)} = ${v as string}`)
  );

  return sql`UPDATE ${sql.table(tableName)} SET ${values}`;
};
