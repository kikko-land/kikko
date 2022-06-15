import {
  IContainsTable,
  IPrimitiveValue,
  ISqlAdapter,
  isSql,
  sql,
} from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../types";

export const buildRawSql = (
  t: ISqlAdapter | IContainsTable | IPrimitiveValue
): IBaseToken<TokenType.RawSql> => {
  return {
    type: TokenType.RawSql,
    toSql() {
      return sql`${t}`;
    },
  };
};

export const toToken = (
  t: IBaseToken | ISqlAdapter | IPrimitiveValue | IContainsTable
): IBaseToken => {
  if (isToken(t)) return t;

  if (isSql(t)) {
    return buildRawSql(t);
  }

  return buildRawSql(t);
};
