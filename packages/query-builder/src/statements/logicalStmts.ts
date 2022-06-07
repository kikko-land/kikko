import { RawValue, Sql } from "@trong-orm/sql";

import { ISelectQueryState } from "../exprs";
import { ICompOperator } from "./conditionOperators";

export const conditionDiscriminator = "compConditionStmt" as const;

export interface IConditionValue {
  column: string;
  columnOperator: ICompOperator;
  value: RawValue | ISelectQueryState;
  __discriminator: typeof conditionDiscriminator;
}

export const buildConditionValue = (
  args: Omit<IConditionValue, "__discriminator">
): IConditionValue => {
  return {
    ...args,
    __discriminator: conditionDiscriminator,
  };
};

export const isConditionValue = (x: {
  __discriminator: string;
}): x is IConditionValue => {
  return x["__discriminator"] === conditionDiscriminator;
};

const andOrDiscriminator = "andOrConditionStmt" as const;
export interface IAndOrConditionValue {
  type: "and" | "or";
  left: IConditionValue | IAndOrConditionValue | Sql;
  right: IConditionValue | IAndOrConditionValue | Sql;
  __discriminator: typeof andOrDiscriminator;
}

export const buildAndOrConditionValue = (
  args: Omit<IAndOrConditionValue, "__discriminator">
): IAndOrConditionValue => {
  return {
    ...args,
    __discriminator: andOrDiscriminator,
  };
};
export const isAndOrConditionValue = (x: {
  __discriminator: string;
}): x is IConditionValue => {
  return x["__discriminator"] === andOrDiscriminator;
};

export const conditionRightDiscriminator = "compRightConditionStmt" as const;
export type IRightConditionValue = Omit<
  IConditionValue,
  "column" | "__discriminator"
> & { __discriminator: typeof conditionRightDiscriminator };
export const isRightConditionValue = (x: {
  __discriminator: string;
}): x is IRightConditionValue => {
  return x["__discriminator"] === conditionRightDiscriminator;
};
