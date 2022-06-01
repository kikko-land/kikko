import { empty, join, raw, sql, table } from "./Sql";

export const generateInsert = (
  tableName: string,
  objs: Record<string, unknown>[],
  replace: boolean = false
) => {
  if (objs.length === 0) throw new Error("Can't insert empty objects");

  const keys = Object.keys(objs[0]);

  const values = join(
    objs.map((obj) => sql`(${join(keys.map((k) => obj[k] as string))})`)
  );

  return sql`INSERT ${replace ? sql`OR REPLACE` : empty} INTO ${table(
    tableName
  )} (${join(keys.map((k) => raw(k)))}) VALUES ${values}`;
};

export const generateUpdate = (
  tableName: string,
  obj: Record<string, unknown>
) => {
  const values = join(
    Object.entries(obj).map(([k, v]) => sql`${raw(k)} = ${v as string}`)
  );

  return sql`UPDATE ${table(tableName)} SET ${values}`;
};
