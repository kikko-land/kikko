import { ISql, sql } from "@kikko-land/sql";

import { IBaseToken, TokenType } from "../types";
import { buildRawSql } from "./rawSql";
import { ISelectStatement } from "./statements/select";
import { IValuesStatement } from "./statements/values";

export interface ICTETerm extends IBaseToken<TokenType.CTE> {
  _recursive: boolean;
  _values: {
    table: string;
    columns: string[];
    select: ISelectStatement | IValuesStatement | IBaseToken<TokenType.RawSql>;
  }[];
}

export interface ICTEState {
  _cteValue?: ICTETerm;

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
    _recursive: args.recursive,
    _values: [
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
          this._recursive ? sql`RECURSIVE` : null,
          sql.join(
            this._values.map(
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
    select: ISelectStatement | IValuesStatement | ISql;
  }
): T => {
  if (state._cteValue?._recursive === true && args.recursive === false) {
    throw new Error("WITH is already recursive");
  }

  if (state._cteValue?._recursive === false && args.recursive === true) {
    throw new Error("WITH is not recursive");
  }

  return {
    ...state,
    _cteValue: state._cteValue
      ? {
          ...state._cteValue,
          values: [...state._cteValue._values, {}],
        }
      : cteTerm({
          table: args.table,
          columns: args.columns,
          recursive: args.recursive,
          select: sql.isSql(args.select)
            ? buildRawSql(args.select)
            : args.select,
        }),
  };
};

export function With<T extends ICTEState>(
  this: T,
  args: {
    table: string;
    columns: string[];
    select: ISelectStatement | IValuesStatement | ISql;
  }
): T {
  return cteTermState(this, { ...args, recursive: false });
}

export function withRecursive<T extends ICTEState>(
  this: T,
  args: {
    table: string;
    columns: string[];
    select: ISelectStatement | IValuesStatement | ISql;
  }
): T {
  return cteTermState(this, { ...args, recursive: true });
}

export function withoutWith<T extends ICTEState>(this: T): T {
  return { ...this, cteValue: undefined };
}
