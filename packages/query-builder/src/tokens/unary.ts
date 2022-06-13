import { ISqlAdapter, PrimitiveValue, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";

interface IUnaryOperator extends IBaseToken<TokenType.Unary> {
  operator: "NOT";
  expr: IBaseToken | ISqlAdapter | PrimitiveValue;
}

export const not = (
  expr: IBaseToken | ISqlAdapter | PrimitiveValue
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
