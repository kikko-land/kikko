import {
  getTime,
  IDbBackend,
  IQuery,
  IQueryResult,
  ITransactionOpts,
} from "@kikko-land/kikko";

export const d1Backend =
  (config: { db: D1Database }): IDbBackend =>
  ({}: { dbName: string }) => {
    return {
      isUsualTransactionDisabled: true,
      isAtomicRollbackCommitDisabled: true,
      initialize() {
        return Promise.resolve();
      },
      async execQueries(queries: IQuery[], transactionOpts?: ITransactionOpts) {
        if (transactionOpts && !transactionOpts.isAtomic) {
          throw new Error("d1Backend does not support non-atomic transactions");
        }

        const startedAt = getTime();
        const times: number[] = [];

        const res = await config.db.batch(
          queries.map((q, i) => {
            const startPreparedAt = getTime();
            const prepared = config.db.prepare(q.text).bind(...q.values);
            const endPreparedAt = getTime();

            times[i] = endPreparedAt - startPreparedAt;

            return prepared;
          })
        );
        const finishedAt = getTime();

        return {
          result: res.map((r, i) => ({
            rows: r.results as IQueryResult,
            performance: {
              execTime: r.duration,
              prepareTime: times[i],
            },
          })),
          performance: {
            totalTime: finishedAt - startedAt,
          },
        };
      },
      stop() {
        return Promise.resolve();
      },
    };
  };
