import {
  IContainsTable,
  ISqlAdapter,
  isSql,
  join,
  liter,
  PrimitiveValue,
  sql,
  table,
} from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../../types";
import { ICTEState, With, withoutWith, withRecursive } from "../cte";
import { from, IFromState } from "../from";
import {
  IOrReplaceState,
  orAbort,
  orFail,
  orIgnore,
  orReplace,
  orRollback,
} from "../orReplace";
import { buildRawSql } from "../rawSql";
import {
  IReturningState,
  returning,
  returningForState,
  withoutReturningForState,
} from "../returning";
import { wrapParentheses } from "../utils";
import { IWhereState, orWhere, where } from "../where";
import { ISelectStatement } from "./select";
import { IValuesStatement } from "./values";

type ISetValue =
  | {
      columnName: string;
      toSet:
        | IBaseToken<TokenType.RawSql>
        | PrimitiveValue
        | ISelectStatement
        | IValuesStatement;
    }
  | IBaseToken<TokenType.RawSql>;

export interface IUpdateStatement
  extends IBaseToken<TokenType.Update>,
    ICTEState,
    IWhereState,
    IFromState,
    IReturningState,
    IOrReplaceState {
  updateTable: IContainsTable;
  setValues: ISetValue[];

  set(...args: ISetArgType[]): IUpdateStatement;
}

type ISetArgType =
  | ISqlAdapter
  | {
      [key: string]:
        | ISqlAdapter
        | IBaseToken<TokenType.RawSql>
        | PrimitiveValue
        | ISelectStatement
        | IValuesStatement;
    }
  | IBaseToken<TokenType.RawSql>;

export const update = (tbl: string | IContainsTable): IUpdateStatement => {
  return {
    type: TokenType.Update,
    updateTable: typeof tbl === "string" ? table(tbl) : tbl,
    setValues: [],
    fromValues: [],
    returningValue: returning(),

    with: With,
    withoutWith,
    withRecursive,

    from,

    where,
    orWhere,

    returning: returningForState,
    withoutReturning: withoutReturningForState,

    orAbort,
    orFail,
    orIgnore,
    orReplace,
    orRollback,

    set(...args: ISetArgType[]) {
      const vals = args.flatMap((m): ISetValue | ISetValue[] => {
        if (isToken(m)) {
          return m;
        } else if (isSql(m)) {
          return buildRawSql(m);
        } else {
          return Object.entries(m).map(([key, val]) => {
            return {
              columnName: key,
              toSet: !isToken(val) && isSql(val) ? buildRawSql(val) : val,
            };
          });
        }
      });

      return { ...this, setValues: [...this.setValues, ...vals] };
    },

    toSql() {
      return join(
        [
          this.cteValue ? this.cteValue : null,
          sql`UPDATE`,
          this.orReplaceValue ? this.orReplaceValue : null,
          this.updateTable,
          sql`SET`,
          join(
            this.setValues.map((val) =>
              isToken(val)
                ? val
                : sql`${liter(val.columnName)} = ${wrapParentheses(val.toSet)}`
            )
          ),
          this.fromValues.length === 0
            ? null
            : sql`FROM ${join(this.fromValues)}`,
          this.whereValue ? sql`WHERE ${this.whereValue}` : null,
          this.returningValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};
