import {
  IContainsTable,
  ISqlAdapter,
  isSql,
  join,
  liter,
  raw,
  Sql,
  sql,
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
    ICTEState {
  distinctValue: boolean;

  selectValues: IBaseToken[];
  fromValues: IBaseToken[];
  groupByValues: IBaseToken[];
  whereValue?: IBaseToken;
  havingValue?: IBaseToken;

  distinct(val: boolean): ISelectStatement;
  select(...args: ISelectArgType[]): ISelectStatement;
  from(
    ...values: (IBaseToken | ISqlAdapter | IContainsTable)[]
  ): ISelectStatement;
  where(...values: IConditionValue[]): ISelectStatement;
  orWhere(...values: IConditionValue[]): ISelectStatement;
  groupBy(...values: (IBaseToken | ISqlAdapter)[]): ISelectStatement;
  having(val: IBaseToken | ISqlAdapter): ISelectStatement;

  with: typeof With<ISelectStatement>;
  withRecursive: typeof withRecursive<ISelectStatement>;
  withoutWith: typeof withoutWith<ISelectStatement>;

  limit: typeof limit<ISelectStatement>;
  offset: typeof offset<ISelectStatement>;
  withoutLimit: typeof withoutLimit<ISelectStatement>;
  withoutOffset: typeof withoutOffset<ISelectStatement>;

  orderBy: typeof orderBy<ISelectStatement>;
  withoutOrder: typeof withoutOrder<ISelectStatement>;

  union: typeof union<ISelectStatement>;
  unionAll: typeof unionAll<ISelectStatement>;
  intersect: typeof intersect<ISelectStatement>;
  except: typeof except<ISelectStatement>;
}

type ISelectArgType =
  | string
  | ISqlAdapter
  | ISelectStatement
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
  const constructWhere = function (
    this: ISelectStatement,
    andOrOr: "and" | "or",
    ...values: IConditionValue[]
  ): ISelectStatement {
    const finalValues = this.whereValue
      ? [this.whereValue, ...conditionValuesToToken(values)]
      : conditionValuesToToken(values);

    if (finalValues.length > 1) {
      return {
        ...this,
        whereValue:
          andOrOr === "and" ? and(...finalValues) : or(...finalValues),
      };
    } else {
      return { ...this, whereValue: finalValues[0] };
    }
  };

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
    from(
      ...values: (IBaseToken | ISqlAdapter | string | IContainsTable)[]
    ): ISelectStatement {
      return {
        ...this,
        fromValues: [
          ...this.fromValues,
          ...values.map((v) =>
            toToken(wrapParentheses(typeof v === "string" ? liter(v) : v))
          ),
        ],
      };
    },
    where(...values: IConditionValue[]): ISelectStatement {
      return constructWhere.bind(this)("and", ...values);
    },
    orWhere(...values: IConditionValue[]): ISelectStatement {
      return constructWhere.bind(this)("or", ...values);
    },
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
    withoutWith,
    orderBy,
    withoutOrder,
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
