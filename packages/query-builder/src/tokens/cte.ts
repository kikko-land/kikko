import { Sql, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { buildRawSql } from "./rawSql";
import { ISelectStatement } from "./statements/select";
import { IValuesStatement } from "./statements/values";

export interface ICTETerm extends IBaseToken<TokenType.CTE> {
  recursive: boolean;
  values: {
    table: string;
    columns: string[];
    select: ISelectStatement | IValuesStatement | IBaseToken<TokenType.RawSql>;
  }[];
}

export interface ICTEState {
  cteValue?: ICTETerm;

  with: typeof With;
  withRecursive: typeof withRecursive;
  withoutWith: typeof withoutWith;
}

const cteTerm = (args: {
  table: string;
  columns: string[];
  recursive: boolean;
  select: ISelectStatement | IValuesStatement | IBaseToken<TokenType.RawSql>;
}): ICTETerm => {
  return {
    type: TokenType.CTE,
    recursive: args.recursive,
    values: [
      {
        table: args.table,
        columns: args.columns,
        select: args.select,
      },
    ],
    toSql() {
      return sql.join(
        [
          sql`WITH`,
          this.recursive ? sql`RECURSIVE` : null,
          sql.join(
            this.values.map(
              (v) =>
                sql`${sql.liter(v.table)}(${sql.join(
                  v.columns.map(sql.liter)
                )}) AS (${v.select})`
            )
          ),
        ].filter((b) => b),
        " "
      );
    },
  };
};

const cteTermState = <T extends ICTEState>(
  state: T,
  args: {
    table: string;
    columns: string[];
    recursive: boolean;
    select: ISelectStatement | IValuesStatement | Sql;
  }
): T => {
  if (state.cteValue?.recursive === true && args.recursive === false) {
    throw new Error("WITH is already recursive");
  }

  if (state.cteValue?.recursive === false && args.recursive === true) {
    throw new Error("WITH is not recursive");
  }

  return {
    ...state,
    cteValue: state.cteValue
      ? {
          ...state.cteValue,
          values: [...state.cteValue.values, {}],
        }
      : cteTerm({
          table: args.table,
          columns: args.columns,
          recursive: args.recursive,
          select:
            args.select instanceof Sql ? buildRawSql(args.select) : args.select,
        }),
  };
};

export function With<T extends ICTEState>(
  this: T,
  args: {
    table: string;
    columns: string[];
    select: ISelectStatement | IValuesStatement | Sql;
  }
): T {
  return cteTermState(this, { ...args, recursive: false });
}

export function withRecursive<T extends ICTEState>(
  this: T,
  args: {
    table: string;
    columns: string[];
    select: ISelectStatement | IValuesStatement | Sql;
  }
): T {
  return cteTermState(this, { ...args, recursive: true });
}

export function withoutWith<T extends ICTEState>(this: T) {
  return { ...this, cteValue: undefined };
}
