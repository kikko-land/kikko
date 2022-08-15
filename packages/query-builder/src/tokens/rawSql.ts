import {
  IContainsTable,
  IPrimitiveValue,
  ISqlAdapter,
  sql,
} from "@kikko-land/sql";

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

  if (sql.isSql(t)) {
    return buildRawSql(t);
  }

  return buildRawSql(t);
};
