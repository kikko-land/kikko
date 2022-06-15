import { IPrimitiveValue, ISqlAdapter, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";

export interface IUnaryOperator extends IBaseToken<TokenType.Unary> {
  operator: "NOT";
  expr: IBaseToken | ISqlAdapter | IPrimitiveValue;
}

export const not = (
  expr: IBaseToken | ISqlAdapter | IPrimitiveValue
): IUnaryOperator => {
  return {
    operator: "NOT",
    type: TokenType.Unary,
    expr,
    toSql() {
      return sql`NOT (${expr})`;
    },
  };
};
