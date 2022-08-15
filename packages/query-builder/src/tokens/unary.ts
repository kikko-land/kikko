import { IPrimitiveValue, ISqlAdapter, sql } from "@kikko-land/sql";

import { IBaseToken, TokenType } from "../types";

export interface IUnaryOperator extends IBaseToken<TokenType.Unary> {
  _operator: "NOT";
  _expr: IBaseToken | ISqlAdapter | IPrimitiveValue;
}

export const not = (
  expr: IBaseToken | ISqlAdapter | IPrimitiveValue
): IUnaryOperator => {
  return {
    _operator: "NOT",
    type: TokenType.Unary,
    _expr: expr,
    toSql() {
      return sql`NOT (${this._expr})`;
    },
  };
};
