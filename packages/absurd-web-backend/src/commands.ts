import { IQuery, makeId } from "@kikko-land/kikko";

type IBaseCommand = {
  commandId: string;
};

export type IExecQueriesCommand = IBaseCommand & {
  type: "runQueries";
  queries: IQuery[];
};

export type ICommand = IExecQueriesCommand;

export const buildRunQueriesCommand = (
  queries: IQuery[]
): IExecQueriesCommand => {
  return {
    commandId: makeId(),
    type: "runQueries",
    queries: queries,
  };
};
