import { IPrimitiveValue, ISqlAdapter, sql } from "@kikko-land/sql";

import { IBaseToken, TokenType } from "../../types";
import {
  except,
  ICompoundState,
  intersect,
  union,
  unionAll,
  withoutCompound,
} from "../compounds";
import { ICTEState, With, withoutWith, withRecursive } from "../cte";
import {
  buildInitialLimitOffsetState,
  ILimitOffsetState,
  limit,
  offset,
  withoutLimit,
  withoutOffset,
} from "../limitOffset";
import { IOrderState, orderBy, withoutOrder } from "../order";

export interface IValuesStatement
  extends IBaseToken<TokenType.Values>,
    IOrderState,
    ICompoundState,
    ILimitOffsetState,
    ICTEState {
  _values: (IBaseToken | ISqlAdapter | IPrimitiveValue)[][];
}

export const values = (
  ...vals: (IBaseToken | ISqlAdapter | IPrimitiveValue)[][]
): IValuesStatement => {
  return {
    type: TokenType.Values,
    _values: vals,
    _compoundValues: [],
    _orderByValues: [],
    _limitOffsetValue: buildInitialLimitOffsetState(),

    orderBy,
    withoutOrder,

    union,
    unionAll,
    intersect,
    except,
    withoutCompound,

    limit,
    withoutLimit,
    offset,
    withoutOffset,

    withoutWith,
    withRecursive,
    with: With,
    toSql() {
      return sql.join(
        [
          this._cteValue ? this._cteValue : null,
          sql`VALUES ${sql.join(
            this._values.map((val) => sql`(${sql.join(val)})`)
          )}`,
          this._compoundValues.length > 0
            ? sql.join(this._compoundValues, " ")
            : null,
          this._orderByValues.length > 0
            ? sql.join([sql`ORDER BY`, sql.join(this._orderByValues)], " ")
            : null,
          this._limitOffsetValue.toSql().isEmpty
            ? null
            : this._limitOffsetValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};

export const isValues = (val: unknown): val is IValuesStatement => {
  return (
    val !== null &&
    typeof val === "object" &&
    (val as IValuesStatement).type === TokenType.Values
  );
};
