import {
  IContainsTable,
  ISqlAdapter,
  isSql,
  join,
  liter,
  raw,
  Sql,
  sql,
  table,
} from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../types";
import { alias } from "./alias";
import { and, conditionValuesToToken, IConditionValue, or } from "./binary";
import {
  except,
  ICompoundState,
  intersect,
  union,
  unionAll,
} from "./compounds";
import { ICTEState, With, withoutWith, withRecursive } from "./cte";
import { from, IFromState } from "./from";
import {
  buildInitialLimitOffsetState,
  ILimitOffsetState,
  limit,
  offset,
  withoutLimit,
  withoutOffset,
} from "./limitOffset";
import { IOrderState, orderBy, withoutOrder } from "./order";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";
import { IValuesStatement } from "./values";
import { IWhereState, orWhere, where } from "./where";

export const isSelect = (val: unknown): val is ISelectStatement => {
  return (
    val !== null &&
    typeof val === "object" &&
    (val as ISelectStatement).type === TokenType.Select
  );
};

export interface ISelectStatement
  extends IBaseToken<TokenType.Select>,
    IOrderState,
    ICompoundState,
    ILimitOffsetState,
    ICTEState,
    IWhereState,
    IFromState {
  distinctValue: boolean;

  selectValues: IBaseToken[];
  fromValues: IBaseToken[];
  groupByValues: IBaseToken[];
  whereValue?: IBaseToken;
  havingValue?: IBaseToken;

  distinct(val: boolean): ISelectStatement;
  select(...args: ISelectArgType[]): ISelectStatement;

  groupBy(...values: (IBaseToken | ISqlAdapter)[]): ISelectStatement;
  having(val: IBaseToken | ISqlAdapter): ISelectStatement;
}

// TODO: refactor to keep values
type ISelectArgType =
  | string
  | ISqlAdapter
  | ISelectStatement
  | IValuesStatement
  | { [key: string]: ISqlAdapter | string | ISelectStatement }
  | IBaseToken;
const selectArgsToValues = (args: ISelectArgType[]) => {
  if (args === null || args === undefined) return [toToken(sql`*`)];

  return args
    .flatMap((arg) => {
      if (typeof arg === "string") return raw(arg);
      if (isToken(arg) || isSql(arg)) return arg;

      return Object.entries(arg).map(([columnOrAs, aliasOrQuery]) =>
        typeof aliasOrQuery === "string"
          ? alias(liter(columnOrAs), aliasOrQuery)
          : alias(aliasOrQuery, columnOrAs)
      );
    })
    .map((t) => toToken(wrapParentheses(t)));
};

export const select = (...selectArgs: ISelectArgType[]): ISelectStatement => {
  return {
    type: TokenType.Select,
    fromValues: [],
    selectValues: selectArgsToValues(selectArgs),
    distinctValue: false,
    groupByValues: [],
    compoundValues: [],
    limitOffsetValue: buildInitialLimitOffsetState(),
    select(...selectArgs: ISelectArgType[]) {
      return {
        ...this,
        selectValues: [...this.selectValues, ...selectArgsToValues(selectArgs)],
      };
    },
    distinct(val: boolean) {
      return {
        ...this,
        distinctValue: val,
      };
    },
    from,
    where,
    orWhere,
    limit,
    offset,
    withoutLimit,
    withoutOffset,
    groupBy(...values: (IBaseToken | Sql)[]): ISelectStatement {
      return { ...this, groupByValues: values.map(toToken) };
    },
    having(val: IBaseToken | Sql) {
      return { ...this, havingValue: toToken(val) };
    },
    orderBy,
    withoutOrder,
    withoutWith,
    withRecursive,
    with: With,
    union,
    unionAll,
    intersect,
    except,
    toSql() {
      return join(
        [
          this.cteValue ? this.cteValue : null,
          sql`SELECT`,
          this.distinctValue ? sql`DISTINCT` : null,
          this.selectValues.length > 0 ? join(this.selectValues) : sql`*`,
          this.fromValues.length === 0
            ? null
            : sql`FROM ${join(this.fromValues)}`,
          this.whereValue ? sql`WHERE ${this.whereValue}` : null,
          this.groupByValues.length > 0
            ? sql`GROUP BY ${join(this.groupByValues)}`
            : null,
          this.groupByValues.length > 0 && this.havingValue
            ? sql`HAVING ${this.havingValue}`
            : null,
          this.compoundValues.length > 0
            ? join(this.compoundValues, " ")
            : null,
          this.orderByValue ? this.orderByValue : null,
          this.limitOffsetValue.toSql().isEmpty ? null : this.limitOffsetValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};
