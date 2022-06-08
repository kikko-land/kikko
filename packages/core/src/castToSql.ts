import { IQueryBuilder, isQueryBuilder } from "@trong-orm/query-builder";
import { Sql } from "@trong-orm/sql";

export const castToSql = (q: Sql | IQueryBuilder): Sql => {
  return isQueryBuilder(q) ? q.toSql() : q;
};
