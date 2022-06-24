import { IPrimitiveValue, ISqlAdapter, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

export type IAlias = IBaseToken<TokenType.Alias> & {
  _left: IBaseToken;
  _right: string;
};

export const alias = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: string
): IAlias => {
  return {
    type: TokenType.Alias,
    _left: toToken(left),
    _right: right,
    toSql() {
      return sql`${wrapParentheses(this._left)} AS ${sql.liter(this._right)}`;
    },
  };
};
