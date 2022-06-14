import { IContainsTable, ISqlAdapter } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { ICompoundState } from "./compounds";
import { ICTEState } from "./cte";
import { IFromState } from "./from";
import { ISelectStatement } from "./select";
import { IValuesStatement } from "./values";
import { IWhereState } from "./where";

export interface IUpdateStatement
  extends IBaseToken<TokenType.Update>,
    ICompoundState,
    ICTEState,
    IWhereState,
    IFromState {
  updateTable: IContainsTable;
  updateOr: "ABORT" | "FAIL" | "IGNORE" | "REPLACE" | "ROLLBACK";

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
      [key: string]: ISqlAdapter | string | ISelectStatement | IValuesStatement;
    }
  | IBaseToken;
