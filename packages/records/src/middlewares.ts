import { IDbState } from "@trong/core";
import { Sql } from "@trong/sql";

import { IRecordConfig } from "./defineRecord";

export type ICreateRecordAction<
  Rec extends Record<string, any> & { id: string }
> = { records: Rec[]; replace: boolean };
export type IUpdateRecordAction<
  Rec extends Record<string, any> & { id: string }
> = { partialRecords: (Partial<Rec> & { id: string })[] };
export type IDeleteRecordAction = { ids: string[] };
export type IGetAction = { query: Sql };

export type IRecAction<Rec extends Record<string, any> & { id: string }> =
  | ICreateRecordAction<Rec>
  | IUpdateRecordAction<Rec>
  | IDeleteRecordAction
  | IGetAction;

type ISharedMiddlewaresState<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string },
  Action extends IRecAction<Rec>
> = {
  dbState: IDbState;
  recordConfig: IRecordConfig<Row, Rec>;
  action: Action;
};

export type INextGenericMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string },
  Action extends IRecAction<Rec>,
  AddableState extends Record<string, any> = {}
> = (
  args: ISharedMiddlewaresState<Row, Rec, Action> & AddableState
) => Promise<ISharedMiddlewaresState<Row, Rec, Action> & AddableState>;
export type IGenericMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string },
  Action extends IRecAction<Rec>,
  AddableState extends Record<string, any> = {}
> = (
  args: ISharedMiddlewaresState<Row, Rec, Action> &
    AddableState & {
      next: INextGenericMiddleware<Row, Rec, Action, AddableState>;
    }
) => Promise<ISharedMiddlewaresState<Row, Rec, Action> & AddableState>;

export type INextCreateMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = INextGenericMiddleware<Row, Rec, ICreateRecordAction<Rec>>;
export type ICreateMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = IGenericMiddleware<Row, Rec, ICreateRecordAction<Rec>>;

export type INextUpdateMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = INextGenericMiddleware<Row, Rec, IUpdateRecordAction<Rec>>;
export type IUpdateMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = IGenericMiddleware<Row, Rec, IUpdateRecordAction<Rec>>;

export type INextDeleteMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = INextGenericMiddleware<Row, Rec, IDeleteRecordAction>;
export type IDeleteMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = IGenericMiddleware<Row, Rec, IDeleteRecordAction>;

export type INextGetMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = INextGenericMiddleware<Row, Rec, IGetAction, { result: Rec[] }>;
export type IGetMiddleware<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = IGenericMiddleware<Row, Rec, IGetAction, { result: Rec[] }>;

export type IMiddlewareSlice<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> = {
  create?: ICreateMiddleware<Row, Rec>;
  update?: IUpdateMiddleware<Row, Rec>;
  delete?: IDeleteMiddleware<Row, Rec>;
  get?: IGetMiddleware<Row, Rec>;
};

export const applyAction = async <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string },
  Action extends IRecAction<Rec>,
  AddableState extends Record<string, any> = {}
>(
  dbState: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  middlewares: IGenericMiddleware<Row, Rec, Action, AddableState>[],
  initialState: AddableState,
  action: Action
) => {
  middlewares = middlewares.slice();
  middlewares.reverse();

  let toCall: INextGenericMiddleware<Row, Rec, Action, AddableState> = async (
    args
  ) => args;

  for (const middleware of middlewares) {
    const currentCall = toCall;

    toCall = (args: ISharedMiddlewaresState<Row, Rec, Action> & AddableState) =>
      middleware({ ...args, next: currentCall });
  }

  return await toCall({
    dbState,
    recordConfig,
    action: action,
    ...initialState,
  });
};
