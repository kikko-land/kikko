import {
  buildAsyncQueryRunner,
  getTime,
  IDbBackend,
  initJobsState,
  IPrimitiveValue,
  IQuery,
  IQueryResult,
  ITransactionOpts,
} from "@kikko-land/kikko";

export const d1Backend =
  (config: { db: D1Database }): IDbBackend =>
  () => {
    const jobsState = initJobsState();

    const queryRunner = buildAsyncQueryRunner({
      async execPrepared(query: IQuery, preparedValues: IPrimitiveValue[][]) {
        const times: number[] = [];

        const prepareStartedAt = getTime();
        const stmt = config.db.prepare(query.text);
        const prepareFinishedAt = getTime();

        const res = await config.db.batch(
          preparedValues.map((a) => stmt.bind(...a))
        );

        const result = res.map((r, i) => ({
          rows: r.results as IQueryResult,
          performance: {
            execTime: r.duration,
            prepareTime: times[i],
          },
        }));

        if (result[0]) {
          result[0].performance["prepareTime"] =
            prepareFinishedAt - prepareStartedAt;
        }

        return result;
      },
      async execUsualBatch(queries: IQuery[]) {
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

        return res.map((r, i) => ({
          rows: r.results as IQueryResult,
          performance: {
            execTime: r.duration,
            prepareTime: times[i],
          },
        }));
      },
      rollback() {
        throw new Error("Rollback not supported");
        // we don't need rollback for d1 cause it support only atomic commits
      },
    });

    return {
      isUsualTransactionDisabled: true,
      isAtomicRollbackCommitDisabled: true,
      initialize() {
        return Promise.resolve();
      },
      async execQueries(
        q:
          | { type: "usual"; values: IQuery[] }
          | {
              type: "prepared";
              query: IQuery;
              preparedValues: IPrimitiveValue[][];
            },
        transactionOpts?: ITransactionOpts
      ) {
        if (transactionOpts && !transactionOpts.isAtomic) {
          throw new Error("d1Backend does not support non-atomic transactions");
        }

        const startedAt = getTime();
        const res = await queryRunner.run(jobsState, q, transactionOpts);
        const finishedAt = getTime();

        return {
          result: res.result,
          performance: {
            ...res.performance,
            totalTime: finishedAt - startedAt,
          },
        };
      },
      stop() {
        return Promise.resolve();
      },
    };
  };
