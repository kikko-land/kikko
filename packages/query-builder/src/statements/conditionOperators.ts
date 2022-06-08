import { RawValue } from "@trong-orm/sql";

import { ISelectQueryBuilder } from "../exprs";
import {
  conditionRightDiscriminator,
  IRightConditionValue,
} from "./logicalStmts";

// TODO: add between, NOT, custom IN
export const operators = [
  "eq",
  "notEq",
  "lt",
  "ltEq",
  "gt",
  "gtEq",
  "in",
  "is",
  "isNot",
  "match",
  "like",
  "regexp",
  "glob",
] as const;
export type ICompOperator = typeof operators[number];

export const eq = (
  value: RawValue | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "eq",
  value: value,
  __discriminator: conditionRightDiscriminator,
});

export const notEq = (
  value: RawValue | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "notEq",
  value: value,
  __discriminator: conditionRightDiscriminator,
});

export const lt = (
  value: RawValue | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "lt",
  value: value,
  __discriminator: conditionRightDiscriminator,
});

export const ltEq = (
  value: RawValue | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "ltEq",
  value: value,
  __discriminator: conditionRightDiscriminator,
});

export const gt = (
  value: RawValue | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "gtEq",
  value: value,
  __discriminator: conditionRightDiscriminator,
});

export const $in = (
  value: RawValue | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "in",
  value: value,
  __discriminator: conditionRightDiscriminator,
});

export const like = (
  value: RawValue | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "like",
  value: value,
  __discriminator: conditionRightDiscriminator,
});
