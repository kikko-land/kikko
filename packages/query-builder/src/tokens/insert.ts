import {
  IContainsTable,
  ISqlAdapter,
  PrimitiveValue,
  sql,
} from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import {
  except,
  ICompoundState,
  intersect,
  union,
  unionAll,
  withoutCompound,
} from "./compounds";
import { ICTEState, With, withoutWith, withRecursive } from "./cte";
import {
  IOrReplaceState,
  orAbort,
  orFail,
  orIgnore,
  orReplace,
  orRollback,
} from "./orReplace";
import { toToken } from "./rawSql";
import { IReturningState } from "./returning";
import { ISelectStatement, isSelect } from "./statements/select";
import { isValues, IValuesStatement } from "./statements/values";
import { IWhereState, orWhere, where } from "./where";

type IInsertArg =
  | IValuesStatement
  | ISelectStatement
  | IBaseToken
  | Record<string, PrimitiveValue | ISqlAdapter | IBaseToken>;

// TODO: on conflict support
export interface IInsertStatement
  extends IBaseToken<TokenType.Insert>,
    ICompoundState,
    ICTEState,
    IWhereState,
    IReturningState,
    IOrReplaceState {
  intoTable?: IContainsTable;
  columns?: string[];

  insert(...insertArgs: IInsertArg[]): IInsertStatement;

  toInsert:
    | IValuesStatement
    | ISelectStatement
    | IBaseToken
    | Record<string, PrimitiveValue | IBaseToken>[];
}

const unboxInsertArgs = (insertArgs: IInsertArg[]) => {
  return insertArgs.map((arg) => {
    if (isValues(arg) || isSelect(arg)) {
      return arg;
    } else {
      return Object.entries(arg).map(([k, v]) => {
        return [k, toToken(v)];
      });
    }
  });
};

export const insert = (...insertArgs: IInsertArg[]): IInsertStatement => {
  return {
    type: TokenType.Insert,
    compoundValues: [],
    toInsert: [],
    where,
    orWhere,
    with: With,
    withoutWith,
    withRecursive,

    orAbort,
    orFail,
    orIgnore,
    orReplace,
    orRollback,

    union,
    unionAll,
    intersect,
    except,
    withoutCompound,

    insert(...insertArgs: IInsertArg[]) {
      return this;
    },

    toSql() {
      return sql``;
    },
  };
};

// insert({}).into('table')
