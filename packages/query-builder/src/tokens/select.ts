import {
  IContainsTable,
  ISqlAdapter,
  isSql,
  join,
  liter,
  PrimitiveValue,
  raw,
  Sql,
  sql,
  TableDef,
} from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../types";
import { alias } from "./alias";
import { and, conditionValuesToToken, IConditionValue, or } from "./binary";
import { buildRawSql, toToken } from "./rawSql";
import { wrapParentheses } from "./utils";
import { IValueStatement } from "./values";

const isSelect = (val: unknown): val is ISelectStatement => {
  return (
    val !== null &&
    typeof val === "object" &&
    (val as ISelectStatement).type === TokenType.Select
  );
};

type IUnionArg = ISelectStatement | IValueStatement | Sql;
export interface ISelectStatement extends IBaseToken<TokenType.Select> {
  distinctValue: boolean;

  withValue?: {
    recursive: boolean;
    values: {
      name: string;
      columns: string[];
      select: ISelectStatement | IValueStatement | IBaseToken<TokenType.RawSql>;
    }[];
  };
  selectValues: IBaseToken[];
  fromValues: IBaseToken[];
  groupByValues: IBaseToken[];
  whereValue?: IBaseToken;
  limitValue?: IBaseToken;
  offsetValue?: IBaseToken;
  havingValue?: IBaseToken;
  compoundValues: {
    compoundType: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT";
    value: ISelectStatement | IValueStatement | IBaseToken<TokenType.RawSql>;
  }[];

  distinct(val: boolean): ISelectStatement;
  select(...args: ISelectArgType[]): ISelectStatement;
  from(
    ...values: (IBaseToken | ISqlAdapter | IContainsTable)[]
  ): ISelectStatement;
  where(...values: IConditionValue[]): ISelectStatement;
  orWhere(...values: IConditionValue[]): ISelectStatement;
  groupBy(...values: (IBaseToken | ISqlAdapter)[]): ISelectStatement;
  having(val: IBaseToken | ISqlAdapter): ISelectStatement;
  with(
    tableName: string,
    columns: string[],
    toSelect: ISelectStatement | IValueStatement | ISqlAdapter
  ): ISelectStatement;
  withRecursive(
    tableName: string,
    columns: string[],
    toSelect: ISelectStatement | IValueStatement | ISqlAdapter
  ): ISelectStatement;

  withoutOrder(): ISelectStatement;
  withoutLimit(): ISelectStatement;
  withoutOffset(): ISelectStatement;
  withoutWith(): ISelectStatement;

  limit(val: IBaseToken | ISqlAdapter | PrimitiveValue): ISelectStatement;
  offset(val: IBaseToken | ISqlAdapter | PrimitiveValue): ISelectStatement;

  union(...values: IUnionArg[]): ISelectStatement;
  unionAll(...values: IUnionArg[]): ISelectStatement;
  intersect(...values: IUnionArg[]): ISelectStatement;
  except(...values: IUnionArg[]): ISelectStatement;
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

const makeCompounds = (
  type: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT",
  values: IUnionArg[]
) => {
  return values.map((val) => {
    const token = toToken(val);

    return {
      compoundType: type,
      value: isSelect(token)
        ? token.withoutWith().withoutLimit().withoutOrder().withoutOffset()
        : (token as IValueStatement | IBaseToken<TokenType.RawSql>),
    };
  });
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
    limit(val: IBaseToken | Sql | PrimitiveValue) {
      return { ...this, limitValue: toToken(val) };
    },
    offset(val: IBaseToken | Sql | PrimitiveValue) {
      return { ...this, offsetValue: toToken(val) };
    },
    groupBy(...values: (IBaseToken | Sql)[]): ISelectStatement {
      return { ...this, groupByValues: values.map(toToken) };
    },
    having(val: IBaseToken | Sql) {
      return { ...this, havingValue: toToken(val) };
    },
    withoutLimit() {
      return { ...this, limitValue: undefined };
    },
    withoutOffset() {
      return { ...this, offsetValue: undefined };
    },
    withoutOrder() {
      return { ...this };
    },
    withoutWith() {
      return { ...this, withValue: undefined };
    },
    withRecursive(
      tableName: string,
      columns: string[],
      toSelect: ISelectStatement | IValueStatement | Sql
    ): ISelectStatement {
      if (this.withValue?.recursive === false) {
        throw new Error("WITH is already not recursive");
      }

      return {
        ...this,
        withValue: {
          recursive: true,
          values: [
            ...(this.withValue?.values || []),
            {
              name: tableName,
              columns,
              select:
                toSelect instanceof Sql ? buildRawSql(toSelect) : toSelect,
            },
          ],
        },
      };
    },
    with(
      tableName: string,
      columns: string[],
      toSelect: ISelectStatement | IValueStatement | Sql
    ) {
      if (this.withValue?.recursive === true) {
        throw new Error("WITH is already recursive");
      }

      return {
        ...this,
        withValue: {
          recursive: true,
          values: [
            ...(this.withValue?.values || []),
            {
              name: tableName,
              columns,
              select:
                toSelect instanceof Sql ? buildRawSql(toSelect) : toSelect,
            },
          ],
        },
      };
    },
    union(...values: ISelectStatement[]): ISelectStatement {
      return {
        ...this,
        compoundValues: [
          ...this.compoundValues,
          ...makeCompounds("UNION", values),
        ],
      };
    },
    unionAll(...values: ISelectStatement[]): ISelectStatement {
      return {
        ...this,
        compoundValues: [
          ...this.compoundValues,
          ...makeCompounds("UNION ALL", values),
        ],
      };
    },
    intersect(...values: ISelectStatement[]): ISelectStatement {
      return {
        ...this,
        compoundValues: [
          ...this.compoundValues,
          ...makeCompounds("INTERSECT", values),
        ],
      };
    },
    except(...values: ISelectStatement[]): ISelectStatement {
      return {
        ...this,
        compoundValues: [
          ...this.compoundValues,
          ...makeCompounds("EXCEPT", values),
        ],
      };
    },
    toSql() {
      return join(
        [
          ...(this.withValue
            ? [
                sql`WITH`,
                this.withValue.recursive ? sql`RECURSIVE` : null,
                join(
                  this.withValue.values.map(
                    (v) =>
                      sql`${liter(v.name)}(${join(v.columns.map(liter))}) AS (${
                        v.select
                      })`
                  )
                ),
              ]
            : []),
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
            ? join(
                this.compoundValues.map(
                  (val) => sql`${raw(val.compoundType)} ${val.value.toSql()}`
                ),
                " "
              )
            : null,
          this.limitValue
            ? sql`LIMIT ${wrapParentheses(this.limitValue)}`
            : null,
          this.offsetValue && this.limitValue
            ? sql`OFFSET ${wrapParentheses(this.offsetValue)}`
            : null,
        ].filter((v) => v),
        " "
      );
    },
  };
};
