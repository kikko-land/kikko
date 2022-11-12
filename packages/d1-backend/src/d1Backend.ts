import {
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

        const startedAt = performance.now();
        const res = await config.db.batch(
          queries.map((q) => config.db.prepare(q.text).bind(...q.values))
        );
        const finishedAt = performance.now();

        return {
          result: res.map((r) => ({
            rows: r.results as IQueryResult,
            performance: {
              execTime: r.duration,
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
