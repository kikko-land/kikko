import { IPrimitiveValue } from "@kikko-land/boono-sql";

import { getTime } from "./measurePerformance";
import { ReactiveVar } from "./reactiveVar";
import {
  acquireWithTrJobOrWait,
  ITransactionsJobsState,
  releaseTrJobIfPossible,
} from "./transactionJobs";
import { IExecQueriesResult, IQuery, ITransactionOpts } from "./types";

export type IDbBackendInstance = {
  isUsualTransactionDisabled?: true;
  isAtomicRollbackCommitDisabled?: true;

  initialize(): Promise<void>;
  execQueries(
    q:
      | { type: "usual"; values: IQuery[] }
      | {
          type: "prepared";
          query: IQuery;
          preparedValues: IPrimitiveValue[][];
        },
    transactionOpts?: ITransactionOpts
  ): Promise<IExecQueriesResult>;
  stop(): Promise<void>;
};

export type IDbBackend = (db: { dbName: string }) => IDbBackendInstance;

export type IRunRes = {
  rows: Record<string, number | string | Uint8Array | null>[];
  performance: {
    prepareTime?: number;
    execTime: number;
  };
};

export type IRunQuery = {
  run: (
    jobsState: ReactiveVar<ITransactionsJobsState>,
    q:
      | { type: "usual"; values: IQuery[] }
      | {
          type: "prepared";
          query: IQuery;
          preparedValues: IPrimitiveValue[][];
        },
    transactionOpts?: ITransactionOpts
  ) => Promise<{ result: IRunRes[]; performance: { blockTime: number } }>;
};

export const buildAsyncQueryRunner = (
  args: {
    execPrepared: (
      query: IQuery,
      preparedValues: IPrimitiveValue[][]
    ) => Promise<IRunRes[]>;
    rollback: () => Promise<void>;
  } & (
    | {
        execUsual: (q: IQuery) => Promise<IRunRes>;
      }
    | {
        execUsualBatch: (q: IQuery[]) => Promise<IRunRes[]>;
      }
  )
): IRunQuery => {
  return {
    async run(
      jobsState: ReactiveVar<ITransactionsJobsState>,
      queries:
        | { type: "usual"; values: IQuery[] }
        | {
            type: "prepared";
            query: IQuery;
            preparedValues: IPrimitiveValue[][];
          },
      transactionOpts?: ITransactionOpts
    ) {
      const startBlockAt = getTime();
      const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
      const endBlockAt = getTime();
      const blockTime = endBlockAt - startBlockAt;

      try {
        const queriesResult = await (async () => {
          if (queries.type === "usual") {
            if ("execUsual" in args) {
              const res: IRunRes[] = [];

              for (const q of queries.values) {
                try {
                  res.push(await args.execUsual(q));
                } catch (e) {
                  if (e instanceof Error) {
                    e.message = `Error while executing query: ${q.text} - ${e.message}`;
                  }
                  throw e;
                }
              }

              return res;
            } else {
              return args.execUsualBatch(queries.values);
            }
          } else {
            try {
              return await args.execPrepared(
                queries.query,
                queries.preparedValues
              );
            } catch (e) {
              if (e instanceof Error) {
                e.message = `Error while executing query: ${queries.query.text} - ${e.message}`;
              }
              throw e;
            }
          }
        })();

        return {
          result: queriesResult,
          performance: {
            blockTime,
          },
        };
      } catch (e) {
        if (transactionOpts?.rollbackOnFail) {
          try {
            await args.rollback();
          } catch (rollbackError) {
            console.error(`Failed to rollback`, e, rollbackError);
          }
        }

        throw e;
      } finally {
        releaseTrJobIfPossible(jobsState, job, transactionOpts);
      }
    },
  };
};

export const buildSyncQueryRunner = (
  args: {
    execPrepared: (
      query: IQuery,
      preparedValues: IPrimitiveValue[][]
    ) => IRunRes[];
    rollback: () => void;
  } & (
    | {
        execUsual: (q: IQuery) => IRunRes;
      }
    | {
        execUsualBatch: (q: IQuery[]) => IRunRes[];
      }
  )
): IRunQuery => {
  return {
    async run(
      jobsState: ReactiveVar<ITransactionsJobsState>,
      queries:
        | { type: "usual"; values: IQuery[] }
        | {
            type: "prepared";
            query: IQuery;
            preparedValues: IPrimitiveValue[][];
          },
      transactionOpts?: ITransactionOpts
    ) {
      const startBlockAt = getTime();
      const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
      const endBlockAt = getTime();
      const blockTime = endBlockAt - startBlockAt;

      try {
        const queriesResult = (() => {
          if (queries.type === "usual") {
            if ("execUsual" in args) {
              return queries.values.map((q) => {
                try {
                  return args.execUsual(q);
                } catch (e) {
                  if (e instanceof Error) {
                    e.message = `Error while executing query: ${q.text} - ${e.message}`;
                  }
                  throw e;
                }
              });
            } else {
              return args.execUsualBatch(queries.values);
            }
          } else {
            try {
              return args.execPrepared(queries.query, queries.preparedValues);
            } catch (e) {
              if (e instanceof Error) {
                e.message = `Error while executing query: ${queries.query.text} - ${e.message}`;
              }
              throw e;
            }
          }
        })();

        return {
          result: queriesResult,
          performance: {
            blockTime,
          },
        };
      } catch (e) {
        if (transactionOpts?.rollbackOnFail) {
          try {
            args.rollback();
          } catch (rollbackError) {
            console.error(`Failed to rollback`, e, rollbackError);
          }
        }

        throw e;
      } finally {
        releaseTrJobIfPossible(jobsState, job, transactionOpts);
      }
    },
  };
};
