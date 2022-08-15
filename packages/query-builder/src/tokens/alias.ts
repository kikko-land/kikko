import {
  IContainsTable,
  IPrimitiveValue,
  ISqlAdapter,
  sql,
} from "@kikko-land/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

export type IAlias = IBaseToken<TokenType.Alias> & {
  _left: IBaseToken;
  _right: string;
};

export const alias = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue | IContainsTable,
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
