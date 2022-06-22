import { ISql, ISqlAdapter, isSql, sql } from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../../types";
import { alias } from "../alias";
import {
  except,
  ICompoundState,
  intersect,
  union,
  unionAll,
  withoutCompound,
} from "../compounds";
import { ICTEState, With, withoutWith, withRecursive } from "../cte";
import { from, IFromState } from "../from";
import {
  buildInitialLimitOffsetState,
  ILimitOffsetState,
  limit,
  offset,
  withoutLimit,
  withoutOffset,
} from "../limitOffset";
import { IOrderState, orderBy, withoutOrder } from "../order";
import { toToken } from "../rawSql";
import { IWhereState, orWhere, where } from "../where";
import { IValuesStatement } from "./values";

export const isSelect = (val: unknown): val is ISelectStatement => {
  return (
    val !== null &&
    typeof val === "object" &&
    (val as ISelectStatement).type === TokenType.Select
  );
};

// TODO: add filter, window support
export interface ISelectStatement
  extends IBaseToken<TokenType.Select>,
    IOrderState,
    ICompoundState,
    ILimitOffsetState,
    ICTEState,
    IWhereState,
    IFromState {
  distinctValue: boolean;

  selectValues: {
    toSelect: "*" | string | ISelectStatement | IBaseToken;
    alias?: string;
  }[];

  groupByValues: IBaseToken[];
  havingValue?: IBaseToken;

  distinct(val: boolean): ISelectStatement;
  select(...args: ISelectArgType[]): ISelectStatement;

  groupBy(...values: (IBaseToken | ISqlAdapter)[]): ISelectStatement;
  having(val: IBaseToken | ISqlAdapter): ISelectStatement;
}

type ISelectArgType =
  | "*"
  | string
  | ISqlAdapter
  | ISelectStatement
  | IValuesStatement
  | { [key: string]: ISqlAdapter | string | ISelectStatement }
  | IBaseToken;

const selectArgsToValues = (
  args: ISelectArgType[]
): ISelectStatement["selectValues"] => {
  if (args === null || args === undefined || args.length === 0)
    return [{ toSelect: "*" }];

  return args.flatMap((arg, i) => {
    if (arg === "*" && i === 0) return { toSelect: "*" };
    if (typeof arg === "string") return { toSelect: arg };
    if (isToken(arg) || isSql(arg)) return { toSelect: toToken(arg) };

    return Object.entries(arg).map(([columnOrAs, aliasOrQuery]) =>
      typeof aliasOrQuery === "string"
        ? { toSelect: columnOrAs, alias: aliasOrQuery }
        : { toSelect: toToken(aliasOrQuery), alias: columnOrAs }
    );
  });
};

export const select = (...selectArgs: ISelectArgType[]): ISelectStatement => {
  return {
    type: TokenType.Select,
    fromValues: [],
    selectValues: selectArgsToValues(selectArgs),
    distinctValue: false,
    groupByValues: [],
    compoundValues: [],
    orderByValues: [],
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
    groupBy(...values: (IBaseToken | ISql)[]): ISelectStatement {
      return { ...this, groupByValues: values.map(toToken) };
    },
    having(val: IBaseToken | ISql) {
      return { ...this, havingValue: toToken(val) };
    },
    orderBy,
    withoutOrder,

    with: With,
    withoutWith,
    withRecursive,

    union,
    unionAll,
    intersect,
    except,
    withoutCompound,

    toSql() {
      return sql.join(
        [
          this.cteValue ? this.cteValue : null,
          sql`SELECT`,
          this.distinctValue ? sql`DISTINCT` : null,
          sql.join(
            this.selectValues.map((val) => {
              if (val.toSelect === "*") {
                return sql`*`;
              } else {
                return val.alias
                  ? alias(val.toSelect, val.alias)
                  : val.toSelect;
              }
            })
          ),
          this.fromValues.length === 0
            ? null
            : sql`FROM ${sql.join(this.fromValues)}`,
          this.whereValue ? sql`WHERE ${this.whereValue}` : null,
          this.groupByValues.length > 0
            ? sql`GROUP BY ${sql.join(this.groupByValues)}`
            : null,
          this.groupByValues.length > 0 && this.havingValue
            ? sql`HAVING ${this.havingValue}`
            : null,
          this.compoundValues.length > 0
            ? sql.join(this.compoundValues, " ")
            : null,
          this.orderByValues ? sql.join(this.orderByValues) : null,
          this.limitOffsetValue.toSql().isEmpty ? null : this.limitOffsetValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};
