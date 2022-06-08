import { RawValue, Sql } from "@trong-orm/sql";

import {
  IQueryBuilder,
  ISelectQueryBuilder,
  isQueryBuilder,
  IUnknownQueryBuilder,
} from "../exprs";
import { hasDiscriminator } from "../types";
import {
  buildAndOrConditionValue,
  buildConditionValue,
  IAndOrConditionValue,
  IConditionValue,
  IRightConditionValue,
  isAndOrConditionValue,
  isConditionValue,
  isRightConditionValue,
} from "./logicalStmts";

export type IWhereArgVal =
  | RawValue
  | ISelectQueryBuilder
  | IConditionValue
  | IRightConditionValue;
export type IWhereArg =
  | IQueryBuilder
  | Sql
  | {
      [key: string]: IWhereArgVal;
    }
  | IConditionValue
  | IAndOrConditionValue;
export type IWhereFunc<T extends IQueryBuilder> = (arg: IWhereArg) => T;

const toConditionValue = (
  column: string,
  val: IWhereArgVal
): IConditionValue => {
  if (hasDiscriminator(val)) {
    if (isConditionValue(val) || isRightConditionValue(val)) {
      return buildConditionValue({
        column,
        columnOperator: val.columnOperator,
        value: val.value,
      });
    } else if (isQueryBuilder(val)) {
      return buildConditionValue({
        column,
        columnOperator: "eq",
        value: val,
      });
    } else {
      throw new Error("Unknown input" + val);
    }
  } else {
    return buildConditionValue({
      column,
      columnOperator: "eq",
      value: val,
    });
  }
};

export function where(
  arg: IWhereArg
): IConditionValue | IAndOrConditionValue | Sql {
  if (hasDiscriminator(arg) && isQueryBuilder(arg)) {
    if (arg.builderState.whereValue === undefined) {
      throw new Error("Where not present");
    }

    return arg.builderState.whereValue;
  } else if (arg instanceof Sql) {
    return arg;
  } else {
    const entries = Object.entries(arg);

    if (entries.length === 0) {
      throw new Error("No args present");
    }

    let toReturn: IConditionValue | IAndOrConditionValue =
      entries.length === 1
        ? toConditionValue(entries[0][0], entries[0][1])
        : buildAndOrConditionValue({
            type: "AND",
            left: toConditionValue(entries[0][0], entries[0][1]),
            right: toConditionValue(entries[1][0], entries[1][1]),
          });

    for (const [table, con] of entries.slice(2)) {
      toReturn = buildAndOrConditionValue({
        type: "AND",
        left: toReturn,
        right: toConditionValue(table, con),
      });
    }

    return toReturn;
  }
}

export function internalWhere<T extends IQueryBuilder = IUnknownQueryBuilder>(
  this: T,
  arg: IWhereArg
): T {
  if (
    hasDiscriminator(arg) &&
    (isConditionValue(arg) || isAndOrConditionValue(arg))
  ) {
    return {
      ...this,
      builderState: {
        ...this.builderState,
        whereValue: this.builderState.whereValue
          ? buildAndOrConditionValue({
              type: "AND",
              left: this.builderState.whereValue,
              right: arg,
            })
          : arg,
      },
    };
  } else {
    const condition = where(arg);

    return {
      ...this,
      builderState: {
        ...this.builderState,
        whereValue: this.builderState.whereValue
          ? buildAndOrConditionValue({
              type: "AND",
              left: this.builderState.whereValue,
              right: condition,
            })
          : condition,
      },
    };
  }
}
