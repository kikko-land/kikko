import { ISqlAdapter, join, PrimitiveValue, Sql, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";

export interface IValueStatement extends IBaseToken<TokenType.Values> {
  values: IBaseToken[][];
}

export const values = (
  ...vals: (IBaseToken | ISqlAdapter | PrimitiveValue)[][]
): IValueStatement => {
  return {
    type: TokenType.Values,
    values: vals.map((val) => val.map(toToken)),
    toSql() {
      return sql`VALUES ${join(this.values.map((val) => sql`(${join(val)})`))}`;
    },
  };
};
