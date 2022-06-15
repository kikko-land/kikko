import { ISqlAdapter, isSql, sql } from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../types";
import { alias } from "./alias";
import { toToken } from "./rawSql";
import { ISelectStatement } from "./statements/select";

type IReturnValue = {
  toSelect: "*" | string | ISelectStatement | IBaseToken;
  alias?: string;
};
export interface IReturningClause extends IBaseToken<TokenType.Returning> {
  values: IReturnValue[];
}

type IReturningArg =
  | "*"
  | string
  | ISqlAdapter
  | IBaseToken
  | { [key: string]: ISqlAdapter | string | ISelectStatement };

export interface IReturningState {
  returningValue: IReturningClause;

  returning: typeof returningForState;
  withoutReturning: typeof withoutReturningForState;
}

export const returning = (...args: IReturningArg[]): IReturningClause => {
  return {
    type: TokenType.Returning,
    values: args.flatMap((arg): IReturnValue | IReturnValue[] => {
      if (isSql(arg) || isToken(arg)) {
        return { toSelect: toToken(arg) };
      } else if (typeof arg === "string") {
        return { toSelect: arg };
      } else {
        return Object.entries(arg).map(([columnOrAs, aliasOrQuery]) => {
          return typeof aliasOrQuery === "string"
            ? { toSelect: columnOrAs, alias: aliasOrQuery }
            : { toSelect: toToken(aliasOrQuery), alias: columnOrAs };
        });
      }
    }),
    toSql() {
      return this.values.length > 0
        ? sql`RETURNING ${sql.join(
            this.values.map((val) => {
              if (val.toSelect === "*") {
                return sql`*`;
              } else {
                return val.alias
                  ? alias(val.toSelect, val.alias)
                  : val.toSelect;
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
    returningValue: {
      ...this.returningValue,
      values: [...this.returningValue.values, ...returning(...args).values],
    },
  };
}

export function withoutReturningForState<T extends IReturningState>(
  this: T
): T {
  return {
    ...this,
    returningValue: returning(),
  };
}
