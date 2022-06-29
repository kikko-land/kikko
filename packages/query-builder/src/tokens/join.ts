import { IContainsTable, ISqlAdapter, sql } from "@trong-orm/sql";
import { isTable } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { conditionValuesToToken, IConditionValue } from "./binary";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

type IJoinOperator =
  | {
      joinType: "CROSS";
    }
  | ({
      isNatural: boolean;
    } & (
      | {
          joinType: "LEFT" | "RIGHT" | "FULL";
          isOuter: boolean;
        }
      | {
          joinType: "INNER";
        }
      // eslint-disable-next-line @typescript-eslint/ban-types
      | {}
    ));

type IJoinConstraint =
  | {
      on: IBaseToken;
    }
  | {
      using: string[];
    };

export interface IJoinExpr extends IBaseToken<TokenType.Join> {
  _operator?: IJoinOperator;
  _toJoin: IContainsTable | IBaseToken;
  _joinConstraint?: IJoinConstraint;

  on: (val: IConditionValue) => IJoinExpr;
  using: (columns: string[]) => IJoinExpr;
}

const baseJoin = (
  operator: IJoinOperator | undefined,
  toJoin: IBaseToken | ISqlAdapter | IContainsTable | string
): IJoinExpr => {
  return {
    type: TokenType.Join,
    _operator: operator,
    _toJoin:
      typeof toJoin === "string"
        ? sql.table(toJoin)
        : isTable(toJoin)
        ? toJoin
        : toToken(wrapParentheses(toJoin)),
    on(val: IConditionValue) {
      return {
        ...this,
        _joinConstraint: { on: conditionValuesToToken([val])[0] },
      };
    },
    using(columns: string[]) {
      return {
        ...this,
        _joinConstraint: {
          using: columns,
        },
      };
    },

    toSql() {
      const operatorSql = (() => {
        if (!this._operator) return [];

        if ("joinType" in this._operator) {
          if (this._operator.joinType === "CROSS") {
            return [sql`CROSS JOIN`] as const;
          } else {
            return [
              this._operator.isNatural ? sql`NATURAL` : undefined,
              sql.raw(this._operator.joinType),
              "isOuter" in this._operator && this._operator.isOuter
                ? sql`OUTER`
                : undefined,
              sql`JOIN`,
            ] as const;
          }
        } else {
          return [
            this._operator.isNatural ? sql`NATURAL` : undefined,
            sql`JOIN`,
          ] as const;
        }
      })().flatMap((v) => (v === undefined ? [] : v));

      return sql.join(
        [
          ...operatorSql,
          wrapParentheses(this._toJoin),
          ...(this._joinConstraint
            ? "on" in this._joinConstraint
              ? [sql`ON`, wrapParentheses(this._joinConstraint.on)]
              : [
                  sql`USING (`,
                  sql.join(this._joinConstraint.using.map((v) => sql.liter(v))),
                  sql`)`,
                ]
            : []),
        ],
        " "
      );
    },
  };
};

type IToJoinArg = IBaseToken | ISqlAdapter | IContainsTable | string;

export const join = (toJoin: IToJoinArg) => {
  return baseJoin(undefined, toJoin);
};

export const crossJoin = (toJoin: IToJoinArg) => {
  return baseJoin({ joinType: "CROSS" }, toJoin);
};

export const naturalJoin = (toJoin: IToJoinArg) => {
  return baseJoin({ isNatural: true }, toJoin);
};
export const naturalLeftJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: true, isOuter: false, joinType: "LEFT" as const },
    toJoin
  );
};
export const naturalRightJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: true, isOuter: false, joinType: "RIGHT" as const },
    toJoin
  );
};
export const naturalFullJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: true, isOuter: false, joinType: "FULL" as const },
    toJoin
  );
};

export const naturalLeftOuterJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: true, isOuter: true, joinType: "LEFT" as const },
    toJoin
  );
};
export const naturalRightOuterJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: true, isOuter: true, joinType: "RIGHT" as const },
    toJoin
  );
};
export const naturalFullOuterJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: true, isOuter: true, joinType: "FULL" as const },
    toJoin
  );
};

export const naturalInnerJoin = (toJoin: IToJoinArg) => {
  return baseJoin({ isNatural: true, joinType: "INNER" as const }, toJoin);
};

export const leftJoin = (toJoin: IToJoinArg) => {
  return baseJoin({ isNatural: false, joinType: "LEFT" as const }, toJoin);
};
export const rightJoin = (toJoin: IToJoinArg) => {
  return baseJoin({ isNatural: false, joinType: "RIGHT" as const }, toJoin);
};
export const fullJoin = (toJoin: IToJoinArg) => {
  return baseJoin({ isNatural: false, joinType: "FULL" as const }, toJoin);
};

export const leftOuterJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: false, isOuter: true, joinType: "LEFT" as const },
    toJoin
  );
};
export const rightOuterJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: false, isOuter: true, joinType: "RIGHT" as const },
    toJoin
  );
};
export const fullOuterJoin = (toJoin: IToJoinArg) => {
  return baseJoin(
    { isNatural: false, isOuter: true, joinType: "FULL" as const },
    toJoin
  );
};

export const innerJoin = (toJoin: IToJoinArg) => {
  return baseJoin({ isNatural: false, joinType: "INNER" as const }, toJoin);
};
