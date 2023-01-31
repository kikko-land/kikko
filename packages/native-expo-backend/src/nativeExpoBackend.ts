import {
  buildAsyncQueryRunner,
  getTime,
  IDbBackend,
  initJobsState,
  IPrimitiveValue,
  IQuery,
  IRunRes,
  ITransactionOpts,
} from "@kikko-land/kikko";
import { openDatabase, ResultSet, ResultSetError } from "expo-sqlite";

export const nativeExpoBackend =
  (): IDbBackend =>
  ({ dbName }) => {
    const jobsState = initJobsState();
    const db = openDatabase(dbName + ".db");

    const runQueries = async (
      queries:
        | { type: "usual"; values: IQuery[] }
        | {
            type: "prepared";
            query: IQuery;
            preparedValues: IPrimitiveValue[][];
          }
    ): Promise<IRunRes[]> => {
      const queriesToRun =
        queries.type === "usual"
          ? queries.values
          : queries.preparedValues.map(
              (v): IQuery => ({
                text: queries.query.text,
                values: v,
              })
            );

      return await new Promise<IRunRes[]>((resolve, reject) => {
        db.exec(
          queriesToRun.map((q) => ({ sql: q.text, args: q.values })),
          false,
          (_, results) => {
            if (!results) {
              resolve([]);

              return;
            }

            const errors = (
              results.filter((res) => "error" in res) as ResultSetError[]
            ).map((er) => er.error);

            if (errors.length > 0) {
              reject(`Failed execute queries: ${errors.join(" ")}`);
              return;
            }

            const goodResults = results as ResultSet[];

            resolve(
              goodResults.map(({ rows }) => ({
                rows,
                performance: {},
              }))
            );
          }
        );
      });
    };

    const queryRunner = buildAsyncQueryRunner({
      async execPrepared(query: IQuery, preparedValues: IPrimitiveValue[][]) {
        return await runQueries({ type: "prepared", query, preparedValues });
      },
      async execUsualBatch(queriesToRun: IQuery[]): Promise<IRunRes[]> {
        return await runQueries({ type: "usual", values: queriesToRun });
      },
      async rollback() {
        await new Promise<void>((resolve) => {
          db.exec([{ sql: "ROLLBACK", args: [] }], false, () => {
            resolve();
          });
        });
      },
    });

    return {
      async initialize() {},
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
        const startedAt = getTime();
        const res = await queryRunner.run(jobsState, q, transactionOpts);
        const endAt = getTime();

        return {
          ...res,
          performance: {
            ...res.performance,
            totalTime: endAt - startedAt,
          },
        };
      },
      async stop() {
        if (db) {
          db.closeAsync();
        }

        return Promise.resolve();
      },
    };
  };
