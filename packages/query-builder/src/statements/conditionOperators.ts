import { RawValue } from "@trong-orm/sql";

import {
  ISelectQueryBuilder,
  ISelectQueryState,
  isQueryBuilder,
} from "../exprs";
import { hasDiscriminator } from "../types";
import {
  conditionRightDiscriminator,
  IRightConditionValue,
} from "./logicalStmts";

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

const unwrapValue = (
  value: RawValue | ISelectQueryState | ISelectQueryBuilder
) =>
  hasDiscriminator(value) && isQueryBuilder(value) ? value.builderState : value;

export const eq = (
  value: RawValue | ISelectQueryState | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "eq",
  value: unwrapValue(value),
  __discriminator: conditionRightDiscriminator,
});

export const notEq = (
  value: RawValue | ISelectQueryState | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "notEq",
  value: unwrapValue(value),
  __discriminator: conditionRightDiscriminator,
});

export const lt = (
  value: RawValue | ISelectQueryState | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "lt",
  value: unwrapValue(value),
  __discriminator: conditionRightDiscriminator,
});

export const ltEq = (
  value: RawValue | ISelectQueryState | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "ltEq",
  value: unwrapValue(value),
  __discriminator: conditionRightDiscriminator,
});

export const gt = (
  value: RawValue | ISelectQueryState | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "gtEq",
  value: unwrapValue(value),
  __discriminator: conditionRightDiscriminator,
});

export const $in = (
  value: RawValue | ISelectQueryState | ISelectQueryBuilder
): IRightConditionValue => ({
  columnOperator: "in",
  value: unwrapValue(value),
  __discriminator: conditionRightDiscriminator,
});
