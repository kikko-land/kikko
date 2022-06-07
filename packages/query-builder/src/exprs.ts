import { ContainsTable, Sql, sql } from "@trong-orm/sql";

import { $in } from "./statements/conditionOperators";
import {
  IAndOrConditionValue,
  IConditionValue,
} from "./statements/logicalStmts";
import { internalWhere, IWhereFunc, where } from "./statements/whereStmt";
import { hasDiscriminator } from "./types";

type IFromValue = string | Sql | ContainsTable | ISelectQueryState;

type IGroupByValue = string | Sql | ContainsTable;
type ISelectValue =
  | string
  | Sql
  | ISelectQueryState
  | { column: string; as: string }
  | { select: Sql | ISelectQueryState; as: string };

export type ISelectQueryState = {
  readonly type: "select";
  readonly distinct: boolean;

  readonly alias?: string;

  readonly selectValues: ISelectValue[];
  readonly fromValues: IFromValue[];
  readonly whereValue?: IAndOrConditionValue | IConditionValue;
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

type FromArg = string | Sql | ContainsTable | ISelectQueryBuilder;
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
};

export type ISelectQueryBuilder = IBaseQueryBuilder & {
  builderType: "select";
  builderState: ISelectQueryState;

  where: IWhereFunc<ISelectQueryBuilder>;
  from: FromFunc<ISelectQueryBuilder>;
  select: SelectFunc<ISelectQueryBuilder>;
  merge: MergeFunc<ISelectQueryBuilder>;
};

export type IQueryBuilder = IUnknownQueryBuilder | ISelectQueryBuilder;

export function isQueryBuilder(t: {
  __discriminator: string;
}): t is IQueryBuilder {
  return t["__discriminator"] === "queryBuilder";
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
  };
};

export function select<T extends IQueryBuilder = ISelectQueryBuilder>(
  this: T | unknown,
  arg?: SelectArg
): T {
  const toSelectValues = ((): ISelectValue[] => {
    if (arg === undefined) return ["*"];

    if (hasDiscriminator(arg) && isQueryBuilder(arg)) {
      return [arg.builderState];
    } else {
      return arg instanceof Sql || typeof arg === "string"
        ? [arg]
        : Object.entries(arg).map(([columnOrAs, aliasOrQuery]) =>
            typeof aliasOrQuery === "string"
              ? { column: columnOrAs, as: aliasOrQuery }
              : {
                  select:
                    hasDiscriminator(aliasOrQuery) &&
                    isQueryBuilder(aliasOrQuery)
                      ? aliasOrQuery.builderState
                      : aliasOrQuery,
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
      return [arg.builderState];
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

select();
select("oneField, anotherField");
select({ oneField: "alisedField" }).select("puk");

console.log(
  select({ oneField: select("id").from("table") })
    .from("kek")
    .where(sql`kek.id = 1`)
);

// pipe(select(), from("table"), where());

// query(
//   select("*"),
//   from("table"),
//   where({ table: "test", test: gtEq(10), other: in(query(select('id').from('tableName'))) })
// );
