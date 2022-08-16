import { IQuery, makeId } from "@kikko-land/kikko";

type IBaseCommand = {
  commandId: string;
  suppressLog?: boolean;
};

export type IExecQueriesCommand = IBaseCommand & {
  type: "runQueries";
  queries: IQuery[];
  logOpts: {
    suppress: boolean;
    transactionId?: string;
  };
};

export type ICommand = IExecQueriesCommand;

export const buildRunQueriesCommand = (
  queries: IQuery[],
  opts: { log: { suppress: boolean; transactionId?: string } }
): IExecQueriesCommand => {
  return {
    commandId: makeId(),
    type: "runQueries",
    queries: queries,
    logOpts: opts.log,
  };
};
