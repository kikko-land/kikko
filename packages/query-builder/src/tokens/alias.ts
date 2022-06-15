import { IPrimitiveValue, ISqlAdapter, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

export type IAlias = IBaseToken<TokenType.Alias> & {
  left: IBaseToken;
  right: string;
};

export const alias = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: string
): IAlias => {
  return {
    type: TokenType.Alias,
    left: toToken(left),
    right,
    toSql() {
      return sql`${wrapParentheses(this.left)} AS ${sql.liter(this.right)}`;
    },
  };
};
