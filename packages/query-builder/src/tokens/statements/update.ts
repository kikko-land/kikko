import { IContainsTable, ISqlAdapter, PrimitiveValue } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../../types";
import { ICompoundState } from "../compounds";
import { ICTEState } from "../cte";
import { IFromState } from "../from";
import { IOrReplaceState } from "../orReplace";
import { IReturningState } from "../returning";
import { IWhereState } from "../where";
import { ISelectStatement } from "./select";
import { IValuesStatement } from "./values";

export interface IUpdateStatement
  extends IBaseToken<TokenType.Update>,
    ICompoundState,
    ICTEState,
    IWhereState,
    IFromState,
    IReturningState,
    IOrReplaceState {
  updateTable: IContainsTable;
  setValues: (
    | IBaseToken
    | {
        [key: string]:
          | IBaseToken<TokenType.RawSql>
          | PrimitiveValue
          | ISelectStatement
          | IValuesStatement;
      }
  )[];

  set(...args: ISetArgType[]): IUpdateStatement;
}

type ISetArgType =
  | ISqlAdapter
  | {
      [key: string]:
        | ISqlAdapter
        | PrimitiveValue
        | ISelectStatement
        | IValuesStatement;
    }
  | IBaseToken;
