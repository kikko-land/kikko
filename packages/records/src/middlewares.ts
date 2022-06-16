import { IDbState } from "@trong-orm/core";
import { ISql } from "@trong-orm/sql";

import { IRecordConfig } from "./defineRecord";

export type ICreateRecordAction<Rec extends object & { id: string }> = {
  records: Rec[];
  replace: boolean;
};
export type IUpdateRecordAction<Rec extends object & { id: string }> = {
  partialRecords: (Partial<Rec> & { id: string })[];
};
export type IDeleteRecordAction = { whereStatement: ISql };
export type IGetAction = { query: ISql };

export type IRecAction<Rec extends object & { id: string }> =
  | ICreateRecordAction<Rec>
  | IUpdateRecordAction<Rec>
  | IDeleteRecordAction
  | IGetAction;

type ISharedMiddlewaresState<
  Row extends object & { id: string },
  Rec extends object & { id: string },
  Action extends IRecAction<Rec>
> = {
  dbState: IDbState;
  recordConfig: IRecordConfig<Row, Rec>;
  action: Action;
};

export type INextGenericMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string },
  Action extends IRecAction<Rec>,
  Result extends object = object
> = (
  args: ISharedMiddlewaresState<Row, Rec, Action> & { result: Result }
) => Promise<ISharedMiddlewaresState<Row, Rec, Action> & { result: Result }>;
export type IGenericMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string },
  Action extends IRecAction<Rec>,
  Result extends object = object
> = (
  args: ISharedMiddlewaresState<Row, Rec, Action> & { result: Result } & {
    next: INextGenericMiddleware<Row, Rec, Action, Result>;
  }
) => Promise<ISharedMiddlewaresState<Row, Rec, Action> & { result: Result }>;

export type INextCreateMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = INextGenericMiddleware<
  Row,
  Rec,
  ICreateRecordAction<Rec>,
  { createdRecords: Rec[] }
>;
export type ICreateMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = IGenericMiddleware<
  Row,
  Rec,
  ICreateRecordAction<Rec>,
  { createdRecords: Rec[] }
>;

export type INextUpdateMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = INextGenericMiddleware<
  Row,
  Rec,
  IUpdateRecordAction<Rec>,
  { updatedRecords: Rec[] }
>;
export type IUpdateMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = IGenericMiddleware<
  Row,
  Rec,
  IUpdateRecordAction<Rec>,
  { updatedRecords: Rec[] }
>;

export type INextDeleteMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = INextGenericMiddleware<
  Row,
  Rec,
  IDeleteRecordAction,
  { result: { deletedRecords: Rec[] } }
>;
export type IDeleteMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = IGenericMiddleware<
  Row,
  Rec,
  IDeleteRecordAction,
  { deletedRecords: Rec[] }
>;

export type INextGetMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = INextGenericMiddleware<Row, Rec, IGetAction, { records: Rec[] }>;
export type IGetMiddleware<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = IGenericMiddleware<Row, Rec, IGetAction, { records: Rec[] }>;

export type IMiddlewareSlice<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> = {
  create?: ICreateMiddleware<Row, Rec>;
  update?: IUpdateMiddleware<Row, Rec>;
  delete?: IDeleteMiddleware<Row, Rec>;
  get?: IGetMiddleware<Row, Rec>;
};

export const applyAction = async <
  Row extends object & { id: string },
  Rec extends object & { id: string },
  Action extends IRecAction<Rec>,
  Result extends object = object
>(
  dbState: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  middlewares: IGenericMiddleware<Row, Rec, Action, Result>[],
  initialResult: Result,
  action: Action
) => {
  middlewares = middlewares.slice();
  middlewares.reverse();

  let toCall: INextGenericMiddleware<Row, Rec, Action, Result> = async (args) =>
    args;

  for (const middleware of middlewares) {
    const currentCall = toCall;

    toCall = (
      args: ISharedMiddlewaresState<Row, Rec, Action> & { result: Result }
    ) => middleware({ ...args, next: currentCall });
  }

  return await toCall({
    dbState,
    recordConfig,
    action: action,
    result: initialResult,
  });
};
