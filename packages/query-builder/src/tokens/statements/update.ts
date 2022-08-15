import {
  IContainsTable,
  IPrimitiveValue,
  ISqlAdapter,
  sql,
} from "@kikko-land/sql";

import { IBaseToken, isToken, TokenType } from "../../types";
import { ICTEState, With, withoutWith, withRecursive } from "../cte";
import { from, fromToSql, IFromState } from "../from";
import {
  IJoinState,
  join,
  joinCross,
  joinFull,
  joinFullNatural,
  joinFullNaturalOuter,
  joinFullOuter,
  joinInner,
  joinInnerNatural,
  joinLeft,
  joinLeftNatural,
  joinLeftNaturalOuter,
  joinLeftOuter,
  joinNatural,
  joinRight,
  joinRightNatural,
  joinRightNaturalOuter,
  joinRightOuter,
  withoutJoin,
} from "../join";
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
        | IPrimitiveValue
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
    IOrReplaceState,
    IJoinState {
  _updateTable: IContainsTable;
  _setValues: ISetValue[];

  set(...args: ISetArgType[]): IUpdateStatement;
}

type ISetArgType =
  | ISqlAdapter
  | {
      [key: string]:
        | ISqlAdapter
        | IBaseToken<TokenType.RawSql>
        | IPrimitiveValue
        | ISelectStatement
        | IValuesStatement;
    }
  | IBaseToken<TokenType.RawSql>;

export const update = (tbl: string | IContainsTable): IUpdateStatement => {
  return {
    type: TokenType.Update,
    _updateTable: typeof tbl === "string" ? sql.table(tbl) : tbl,
    _setValues: [],
    _fromValues: [],
    _joinValues: [],
    _returningValue: returning(),

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

    withoutJoin,

    join,
    joinCross,

    joinNatural,

    joinLeft,
    joinLeftOuter,
    joinLeftNatural: joinLeftNatural,
    joinLeftNaturalOuter: joinLeftNaturalOuter,

    joinRight,
    joinRightOuter,
    joinRightNatural: joinRightNatural,
    joinRightNaturalOuter: joinRightNaturalOuter,

    joinFull,
    joinFullOuter,
    joinFullNatural: joinFullNatural,
    joinFullNaturalOuter: joinFullNaturalOuter,

    joinInner,
    joinInnerNatural: joinInnerNatural,

    set(...args: ISetArgType[]): IUpdateStatement {
      const vals = args.flatMap((m): ISetValue | ISetValue[] => {
        if (isToken(m)) {
          return m;
        } else if (sql.isSql(m)) {
          return buildRawSql(m);
        } else {
          return Object.entries(m).map(([key, val]) => {
            return {
              columnName: key,
              toSet: !isToken(val) && sql.isSql(val) ? buildRawSql(val) : val,
            };
          });
        }
      });

      return { ...this, _setValues: [...this._setValues, ...vals] };
    },

    toSql() {
      return sql.join(
        [
          this._cteValue ? this._cteValue : null,
          sql`UPDATE`,
          this._orReplaceValue
            ? sql`OR ${sql.raw(this._orReplaceValue)}`
            : null,
          this._updateTable,
          sql`SET`,
          sql.join(
            this._setValues.map((val) =>
              isToken(val)
                ? val
                : sql`${sql.liter(val.columnName)} = ${wrapParentheses(
                    val.toSet
                  )}`
            )
          ),
          this._fromValues.length > 0 || this._joinValues.length > 0
            ? sql`FROM`
            : null,
          fromToSql(this),
          this._joinValues.length > 0
            ? sql.join(
                this._joinValues.map((expr) => expr.toSql()),
                " "
              )
            : null,
          this._whereValue ? sql`WHERE ${this._whereValue}` : null,
          this._returningValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};
