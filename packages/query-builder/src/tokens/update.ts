import { IContainsTable, ISqlAdapter, IPrimitiveValue } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { ICompoundState } from "./compounds";
import { ICTEState } from "./cte";
import { IFromState } from "./from";
import { IReturningState } from "./returning";
import { ISelectStatement } from "./select";
import { IValuesStatement } from "./values";
import { IWhereState } from "./where";

export interface IUpdateStatement
  extends IBaseToken<TokenType.Update>,
    ICompoundState,
    ICTEState,
    IWhereState,
    IFromState,
    IReturningState {
  updateTable: IContainsTable;
  updateOr: "ABORT" | "FAIL" | "IGNORE" | "REPLACE" | "ROLLBACK";
  setValues: (
    | IBaseToken
    | {
        [key: string]:
          | IBaseToken<TokenType.RawSql>
          | IPrimitiveValue
          | ISelectStatement
          | IValuesStatement;
      }
  )[];

  orAbort(): IUpdateStatement;
  orFail(): IUpdateStatement;
  orIgnore(): IUpdateStatement;
  orReplace(): IUpdateStatement;
  orRollback(): IUpdateStatement;

  set(...args: ISetArgType[]): IUpdateStatement;
}

type ISetArgType =
  | ISqlAdapter
  | {
      [key: string]:
        | ISqlAdapter
        | IPrimitiveValue
        | ISelectStatement
        | IValuesStatement;
    }
  | IBaseToken;
