import { IContainsTable, ISqlAdapter, sql } from "@kikko-land/sql";
import { isTable } from "@kikko-land/sql";

import { IBaseToken, isToken, TokenType } from "../types";
import { alias } from "./alias";
import { conditionValuesToToken, IConditionValue } from "./binary";
import { toToken } from "./rawSql";
import { ISelectStatement } from "./statements/select";
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

export interface IJoinExpr extends IBaseToken<TokenType.Join> {
  _operator?: IJoinOperator;
  _toJoin:
    | IContainsTable
    | IBaseToken
    | { toSelect: IBaseToken; alias: string };
  _on?: IConditionValue;
}

const baseJoin = (
  operator: IJoinOperator | undefined,
  toJoin: IToJoinArg,
  on?: IConditionValue
): IJoinExpr => {
  return {
    type: TokenType.Join,
    _operator: operator,
    _toJoin: (() => {
      if (typeof toJoin === "string") {
        return sql.table(toJoin);
      } else if (isTable(toJoin)) {
        return toJoin;
      } else if (isToken(toJoin) || sql.isSql(toJoin)) {
        return toToken(toJoin);
      } else {
        const entries = Object.entries(toJoin);
        if (entries.length === 0) {
          throw new Error("No alias select present for join");
        }
        if (entries.length > 1) {
          throw new Error("Only one select could be specified at join");
        }
        return { toSelect: toToken(entries[0][1]), alias: entries[0][0] };
      }
    })(),
    _on: on,

    toSql() {
      const operatorSql = (() => {
        if (!this._operator) return [sql`JOIN`];

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
          "toSelect" in this._toJoin
            ? alias(this._toJoin.toSelect, this._toJoin.alias)
            : wrapParentheses(this._toJoin),
          ...(this._on ? [sql`ON`, ...conditionValuesToToken([this._on])] : []),
        ],
        " "
      );
    },
  };
};

type IToJoinArg =
  | IBaseToken
  | ISqlAdapter
  | IContainsTable
  | string
  | { [key: string]: ISqlAdapter | ISelectStatement | string };

export interface IJoinState {
  _joinValues: IJoinExpr[];

  withoutJoin: typeof withoutJoin;

  join: typeof join;
  joinCross: typeof joinCross;

  joinNatural: typeof joinNatural;

  joinLeft: typeof joinLeft;
  joinLeftOuter: typeof joinLeftOuter;
  joinLeftNatural: typeof joinLeftNatural;
  joinLeftNaturalOuter: typeof joinLeftNaturalOuter;

  joinRight: typeof joinRight;
  joinRightOuter: typeof joinRightOuter;
  joinRightNatural: typeof joinRightNatural;
  joinRightNaturalOuter: typeof joinRightNaturalOuter;

  joinFull: typeof joinFull;
  joinFullOuter: typeof joinFullOuter;
  joinFullNatural: typeof joinFullNatural;
  joinFullNaturalOuter: typeof joinFullNaturalOuter;

  joinInner: typeof joinInner;
  joinInnerNatural: typeof joinInnerNatural;
}

export function join<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [...this._joinValues, baseJoin(undefined, toJoin, on)],
  };
}

export function joinCross<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin({ joinType: "CROSS" }, toJoin, on),
    ],
  };
}

export function joinNatural<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin({ isNatural: true }, toJoin, on),
    ],
  };
}

export function joinLeftNatural<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: true, isOuter: false, joinType: "LEFT" as const },
        toJoin,
        on
      ),
    ],
  };
}

export function joinRightNatural<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: true, isOuter: false, joinType: "RIGHT" as const },
        toJoin,
        on
      ),
    ],
  };
}

export function joinFullNatural<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: true, isOuter: false, joinType: "FULL" as const },
        toJoin,
        on
      ),
    ],
  };
}

export function joinLeftNaturalOuter<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: true, isOuter: true, joinType: "LEFT" as const },
        toJoin,
        on
      ),
    ],
  };
}
export function joinRightNaturalOuter<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: true, isOuter: true, joinType: "RIGHT" as const },
        toJoin,
        on
      ),
    ],
  };
}
export function joinFullNaturalOuter<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: true, isOuter: true, joinType: "FULL" as const },
        toJoin,
        on
      ),
    ],
  };
}

export function joinInnerNatural<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin({ isNatural: true, joinType: "INNER" as const }, toJoin, on),
    ],
  };
}

export function joinLeft<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin({ isNatural: false, joinType: "LEFT" as const }, toJoin, on),
    ],
  };
}
export function joinRight<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin({ isNatural: false, joinType: "RIGHT" as const }, toJoin, on),
    ],
  };
}
export function joinFull<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin({ isNatural: false, joinType: "FULL" as const }, toJoin, on),
    ],
  };
}

export function joinLeftOuter<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: false, isOuter: true, joinType: "LEFT" as const },
        toJoin,
        on
      ),
    ],
  };
}
export function joinRightOuter<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: false, isOuter: true, joinType: "RIGHT" as const },
        toJoin,
        on
      ),
    ],
  };
}
export function joinFullOuter<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin(
        { isNatural: false, isOuter: true, joinType: "FULL" as const },
        toJoin,
        on
      ),
    ],
  };
}

export function joinInner<T extends IJoinState>(
  this: T,
  toJoin: IToJoinArg,
  on?: IConditionValue
): T {
  return {
    ...this,
    _joinValues: [
      ...this._joinValues,
      baseJoin({ isNatural: false, joinType: "INNER" as const }, toJoin),
      on,
    ],
  };
}

export function withoutJoin<T extends IJoinState>(this: T): T {
  return {
    ...this,
    _joinValues: [],
  };
}
