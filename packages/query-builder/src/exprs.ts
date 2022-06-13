import {
  ContainsTable,
  containsTable,
  empty,
  join,
  raw,
  RawValue,
  Sql,
  sql,
  table,
} from "@trong-orm/sql";

import {
  IAndOrConditionValue,
  IConditionValue,
  isAndOrConditionValue,
  isConditionValue,
} from "./statements/logicalStmts";
import { internalWhere, IWhereFunc } from "./statements/whereStmt";
import { assertUnreachable, hasDiscriminator } from "./types";

type IFromValue = Sql | ContainsTable | ISelectQueryBuilder;

type IGroupByValue = string | Sql | ContainsTable;
type ISelectValue =
  | string
  | Sql
  | ISelectQueryBuilder
  | { column: string; as: string }
  | { select: Sql | ISelectQueryBuilder; as: string };

export type ISelectQueryState = {
  readonly type: "select";
  readonly distinct: boolean;

  readonly alias?: string;

  readonly selectValues: ISelectValue[];
  readonly fromValues: IFromValue[];
  readonly whereValue?: IAndOrConditionValue | IConditionValue | Sql;
  readonly groupByValues: IGroupByValue[];
};

export type IUnknownQueryState = {
  readonly type: "unknown";

  readonly distinct?: boolean;
  readonly alias?: string;

  readonly selectValues: ISelectValue[];
  readonly fromValues: IFromValue[];
  readonly whereValue?: IAndOrConditionValue | IConditionValue;
  readonly groupByValues: IGroupByValue[];
};

export type IQueryBuilderState = ISelectQueryState | IUnknownQueryState;

type FromArg = Sql | ContainsTable | ISelectQueryBuilder;
type FromFunc<T extends IQueryBuilder> = (arg: FromArg) => T;

type SelectArg =
  | string
  | Sql
  | ISelectQueryBuilder
  | { [key: string]: Sql | string | ISelectQueryBuilder };
type SelectFunc<T extends IQueryBuilder> = (arg: SelectArg) => T;

type MergeArg = IQueryBuilder;
type MergeFunc<T extends IQueryBuilder> = (arg: MergeArg) => T;

type IBaseQueryBuilder = {
  __discriminator: "queryBuilder";
};
export type IUnknownQueryBuilder = IBaseQueryBuilder & {
  builderType: "unknown";
  builderState: IUnknownQueryState;

  where: IWhereFunc<IUnknownQueryBuilder>;
  from: FromFunc<IUnknownQueryBuilder>;
  select: SelectFunc<IUnknownQueryBuilder>;
  merge: MergeFunc<IUnknownQueryBuilder>;

  toSql: () => Sql;
};

export type ISelectQueryBuilder = IBaseQueryBuilder & {
  builderType: "select";
  builderState: ISelectQueryState;

  where: IWhereFunc<ISelectQueryBuilder>;
  from: FromFunc<ISelectQueryBuilder>;
  select: SelectFunc<ISelectQueryBuilder>;
  merge: MergeFunc<ISelectQueryBuilder>;
  toSql: () => Sql;
  hash: () => string;
};

export type IExportableQueryBuilder = ISelectQueryBuilder;
export type IQueryBuilder = IUnknownQueryBuilder | ISelectQueryBuilder;

export function isQueryBuilder(t: unknown): t is IQueryBuilder {
  return hasDiscriminator(t) && t["__discriminator"] === "queryBuilder";
}

export function isSelectQueryBuilder(t: {
  __discriminator: string;
}): t is ISelectQueryBuilder {
  return isQueryBuilder(t) && t.builderType === "select";
}

const buildSelectQueryBuilder = (
  state: Partial<ISelectQueryState>
): ISelectQueryBuilder => {
  return {
    __discriminator: "queryBuilder",
    builderType: "select",
    builderState: {
      groupByValues: [],
      fromValues: [],
      selectValues: [],
      whereValue: undefined,
      distinct: false,
      ...state,
      type: "select",
    },
    select,
    where: internalWhere,
    from,
    toSql() {
      const { distinct, selectValues, fromValues, whereValue } =
        this.builderState;

      const toSelect = selectValues.map((v) => {
        if (v instanceof Sql) {
          return v;
        } else if (typeof v === "string") {
          return sql`${raw(v)}`;
        } else if (hasDiscriminator(v) && isSelectQueryBuilder(v)) {
          return v.toSql();
        } else if ("column" in v) {
          return sql`${raw(v.column)} AS ${raw(v.as)}`;
        } else if ("select" in v) {
          return sql`(${
            hasDiscriminator(v.select) && isSelectQueryBuilder(v.select)
              ? v.select.toSql()
              : v.select
          }) AS ${raw(v.as)}`;
        } else {
          assertUnreachable(v);
        }
      });

      const from = fromValues.map((v) => {
        if (v instanceof Sql) {
          return v;
        } else if (typeof v === "string") {
          return sql`${raw(v)}`;
        } else if (containsTable(v)) {
          return sql`${v}`;
        } else if (hasDiscriminator(v) && isSelectQueryBuilder(v)) {
          return v.toSql();
        } else {
          assertUnreachable(v);
        }
      });

      const where = (() => {
        if (!whereValue) return empty;
        if (whereValue instanceof Sql && whereValue.isEmpty) {
          return empty;
        }

        return sql` WHERE ${
          whereValue instanceof Sql ? whereValue : conditionToSql(whereValue)
        }`;
      })();

      const finalQuery = sql`SELECT${distinct ? sql` DISTINCT` : empty} ${join(
        toSelect
      )}${fromValues.length === 0 ? empty : sql` FROM ${join(from)}`}${where}`;

      return finalQuery;
    },
    hash() {
      return this.toSql().hash;
    },
    merge(arg: MergeArg) {
      return {
        ...this,
        builderState: {
          ...this.builderState,
          groupByValues: [
            ...this.builderState.groupByValues,
            ...arg.builderState.groupByValues,
          ],
          fromValues: [
            ...this.builderState.fromValues,
            ...arg.builderState.fromValues,
          ],
          selectValues: [
            ...this.builderState.selectValues,
            ...arg.builderState.selectValues,
          ],
          distinct: arg.builderState.distinct
            ? arg.builderState.distinct
            : this.builderState.distinct,
          // TODO: merge where values
        },
      };
    },
  };
};

const buildUnknownQueryBuilder = (
  state: Partial<IUnknownQueryState>
): IUnknownQueryBuilder => {
  return {
    __discriminator: "queryBuilder",
    builderType: "unknown",
    builderState: {
      groupByValues: [],
      fromValues: [],
      selectValues: [],
      ...state,
      type: "unknown",
    },
    select,
    where: internalWhere,
    from,
    merge(arg: MergeArg) {
      return this;
    },
    toSql() {
      return sql``;
    },
  };
};

function select<T extends IQueryBuilder = ISelectQueryBuilder>(
  this: T | unknown,
  arg?: SelectArg
): T {
  const toSelectValues = ((): ISelectValue[] => {
    if (arg === undefined) return ["*"];

    if (hasDiscriminator(arg) && isQueryBuilder(arg)) {
      return [arg];
    } else {
      return arg instanceof Sql || typeof arg === "string"
        ? [arg]
        : Object.entries(arg).map(([columnOrAs, aliasOrQuery]) =>
            typeof aliasOrQuery === "string"
              ? { column: columnOrAs, as: aliasOrQuery }
              : {
                  select: aliasOrQuery,
                  as: columnOrAs,
                }
          );
    }
  })();

  if (hasDiscriminator(this) && isQueryBuilder(this)) {
    return {
      ...this,
      builderState: {
        ...this.builderState,
        selectValues: [...this.builderState.selectValues, ...toSelectValues],
      },
    } as T;
  } else {
    return buildSelectQueryBuilder({
      selectValues: toSelectValues,
    }) as T;
  }
}
export function from<T extends IQueryBuilder = IUnknownQueryBuilder>(
  this: T | unknown,
  arg: FromArg
): T {
  const fromValues = ((): IFromValue[] => {
    if (hasDiscriminator(arg) && isQueryBuilder(arg)) {
      return [arg];
    } else {
      return [arg];
    }
  })();

  if (hasDiscriminator(this) && isQueryBuilder(this)) {
    return {
      ...this,
      builderState: {
        ...this.builderState,
        fromValues: [...this.builderState.fromValues, ...fromValues],
      },
    } as T;
  } else {
    return buildUnknownQueryBuilder({
      fromValues: fromValues,
    }) as T;
  }
}

const unwrapValue = (value: ISelectQueryBuilder | RawValue) => {
  return hasDiscriminator(value) && isQueryBuilder(value)
    ? value.toSql()
    : value;
};
const conditionToSql = (
  condition: IAndOrConditionValue | IConditionValue
): Sql => {
  if (isAndOrConditionValue(condition)) {
    return sql`${
      hasDiscriminator(condition.left)
        ? conditionToSql(condition.left)
        : condition.left
    } ${raw(condition.type)} ${
      hasDiscriminator(condition.right)
        ? conditionToSql(condition.right)
        : condition.right
    }`;
  } else if (isConditionValue(condition)) {
    switch (condition.columnOperator) {
      case "eq":
        return sql`${raw(condition.column)} = ${unwrapValue(condition.value)}`;
      case "notEq":
        return sql`${raw(condition.column)} = ${unwrapValue(condition.value)}`;
      case "lt":
        return sql`${raw(condition.column)} < ${unwrapValue(condition.value)}`;
      case "ltEq":
        return sql`${raw(condition.column)} <= ${unwrapValue(condition.value)}`;
      case "gt":
        return sql`${raw(condition.column)} > ${unwrapValue(condition.value)}`;
      case "gtEq":
        return sql`${raw(condition.column)} >= ${unwrapValue(condition.value)}`;
      case "in":
        return sql`${raw(condition.column)} IN (${unwrapValue(
          condition.value
        )})`;
      case "is":
        return sql`${raw(condition.column)} IS (${unwrapValue(
          condition.value
        )})`;
      case "isNot":
        return sql`${raw(condition.column)} IS NOT (${unwrapValue(
          condition.value
        )})`;
      case "match":
        return sql`${raw(condition.column)} MATCH (${unwrapValue(
          condition.value
        )})`;
      case "like":
        return sql`${raw(condition.column)} LIKE (${unwrapValue(
          condition.value
        )})`;
      case "regexp":
        return sql`${raw(condition.column)} REGEXP (${unwrapValue(
          condition.value
        )})`;
      case "glob":
        return sql`${raw(condition.column)} GLOB (${unwrapValue(
          condition.value
        )})`;
      default:
        assertUnreachable(condition.columnOperator);
    }
  } else {
    assertUnreachable(condition);
  }
};

select();
select("oneField, anotherField");
select({ oneField: "alisedField" }).select("puk");

console.log(
  select({ oneField: select("id").from(table("table")) })
    .from(table("kek"))
    .where(sql`kek.id = 1`)
    .where({ key: 0 })
    .toSql()
    .inspect()
);

// pipe(select(), from("table"), where());

// query(
//   select("*"),
//   from("table"),
//   where({ table: "test", test: gtEq(10), other: in(query(select('id').from('tableName'))) })
// );
