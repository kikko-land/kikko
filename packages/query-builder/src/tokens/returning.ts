import { ISqlAdapter, sql } from "@kikko-land/sql";

import { IBaseToken, isToken, TokenType } from "../types";
import { alias } from "./alias";
import { toToken } from "./rawSql";
import { ISelectStatement } from "./statements/select";

type IReturnValue = {
  _toSelect: "*" | string | ISelectStatement | IBaseToken;
  _alias?: string;
};
export interface IReturningClause extends IBaseToken<TokenType.Returning> {
  _values: IReturnValue[];
}

type IReturningArg =
  | "*"
  | string
  | ISqlAdapter
  | IBaseToken
  | { [key: string]: ISqlAdapter | string | ISelectStatement };

export interface IReturningState {
  _returningValue: IReturningClause;

  returning: typeof returningForState;
  withoutReturning: typeof withoutReturningForState;
}

export const returning = (...args: IReturningArg[]): IReturningClause => {
  return {
    type: TokenType.Returning,
    _values: args.flatMap((arg): IReturnValue | IReturnValue[] => {
      if (sql.isSql(arg) || isToken(arg)) {
        return { _toSelect: toToken(arg) };
      } else if (typeof arg === "string") {
        return { _toSelect: arg };
      } else {
        return Object.entries(arg).map(([columnOrAs, aliasOrQuery]) => {
          return typeof aliasOrQuery === "string"
            ? { _toSelect: columnOrAs, _alias: aliasOrQuery }
            : { _toSelect: toToken(aliasOrQuery), _alias: columnOrAs };
        });
      }
    }),
    toSql() {
      return this._values.length > 0
        ? sql`RETURNING ${sql.join(
            this._values.map((val) => {
              if (val._toSelect === "*") {
                return sql`*`;
              } else {
                return val._alias
                  ? alias(val._toSelect, val._alias)
                  : val._toSelect;
              }
            })
          )}`
        : sql.empty;
    },
  };
};

export function returningForState<T extends IReturningState>(
  this: T,
  ...args: IReturningArg[]
): T {
  return {
    ...this,
    _returningValue: {
      ...this._returningValue,
      _values: [...this._returningValue._values, ...returning(...args)._values],
    },
  };
}

export function withoutReturningForState<T extends IReturningState>(
  this: T
): T {
  return {
    ...this,
    _returningValue: returning(),
  };
}
