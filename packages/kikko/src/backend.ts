import { IPrimitiveValue } from "@kikko-land/boono-sql";

import { getTime } from "./measurePerformance";
import { ReactiveVar } from "./reactiveVar";
import {
  acquireWithTrJobOrWait,
  ITransactionsJobsState,
  releaseTrJobIfPossible,
} from "./transactionJobs";
import { IExecQueriesResult, IQuery, ITransactionOpts } from "./types";

type IDbInstance = {
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

export type IDbBackend = (db: { dbName: string }) => IDbInstance;

export type IRunRes = {
  rows: Record<string, number | string | Uint8Array | null>[];
  performance: {
    prepareTime?: number;
    execTime: number;
  };
};

export type IRunQuery = {
  run: (
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
  jobsState: ReactiveVar<ITransactionsJobsState>,
  args: {
    execPrepared: (
      query: IQuery,
      preparedValues: IPrimitiveValue[][]
    ) => Promise<IRunRes[]>;
    execUsual: (q: IQuery) => Promise<IRunRes>;
    rollback: () => Promise<void>;
  }
): IRunQuery => {
  return {
    async run(
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
  jobsState: ReactiveVar<ITransactionsJobsState>,
  args: {
    execPrepared: (
      query: IQuery,
      preparedValues: IPrimitiveValue[][]
    ) => IRunRes[];
    execUsual: (q: IQuery) => IRunRes;
    rollback: () => void;
  }
): IRunQuery => {
  return {
    async run(
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
