import { runInTransaction, runQueries, withSuppressedLog } from "@trong/core";
import { IDbState } from "@trong/core";
import { subscribeToQueries$ } from "@trong/reactive-queries";
import { Sql } from "@trong/sql";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startWith, switchMap } from "rxjs";

import { useDbState } from "../DbProvider";
import { DistributiveOmit, IQueryResult, IQueryResultWithIdle } from "./types";

const runQueries$ = (state: IDbState, queries: Sql[]) => {
  return subscribeToQueries$(state, queries).pipe(
    startWith(undefined),
    switchMap(async () => {
      return runQueries(state, queries);
    })
  );
};

export function useQueries<D>(
  _queries: Sql[],
  _opts?: { suppressLog?: boolean; mapToObject?: boolean } | undefined
): IQueryResult<D[][]> {
  const dbState = useDbState();

  const { suppressLog } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
  };

  const [currentQueries, setCurrentQueries] = useState<Sql[]>(_queries);
  const [data, setData] = useState<D[][] | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryResult<D[][]>, "data">
  >(
    dbState.type === "initialized" ? { type: "loading" } : { type: "waitingDb" }
  );

  useEffect(() => {
    if (dbState.type !== "initialized") {
      setResponse({ type: "waitingDb" });

      return;
    }

    const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;

    const subscription = runQueries$(db, currentQueries).subscribe((result) => {
      setData(result as unknown as D[][]);
      setResponse({ type: "loaded" });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dbState, currentQueries, suppressLog]);

  useEffect(() => {
    if (
      currentQueries.map((q) => q.hash).join() !==
      _queries.map((q) => q.hash).join()
    ) {
      setCurrentQueries(_queries);
    }
  }, [currentQueries, _queries]);

  return useMemo(() => {
    if (response.type === "loaded") {
      if (!data) {
        throw new Error(
          "Internal error: response state is loaded, but there is not data!"
        );
      }

      return { ...response, data };
    }

    return { ...response, data };
  }, [data, response]);
}

export function useQuery<D>(
  query: Sql,
  _opts?: { suppressLog?: boolean; mapToObject?: boolean } | undefined
): IQueryResult<D[]> {
  const result = useQueries<D>([query], _opts);

  return useMemo(() => {
    if (result.type === "loaded") {
      if (!result.data) {
        throw new Error(
          "Internal error: response state is loaded, but there is not data!"
        );
      }

      return { ...result, data: result.data[0] };
    }

    return {
      ...result,
      data: result.data?.[0],
    };
  }, [result]);
}

function useIsMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}

export function useRunQuery<D>(
  cb: (db: IDbState) => Promise<D>,
  _opts?: { suppressLog?: boolean; inTransaction?: boolean } | undefined
): readonly [
  () => Promise<D>,
  DistributiveOmit<IQueryResultWithIdle<D>, "data"> & { data?: D | undefined }
] {
  const { suppressLog, inTransaction } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
    inTransaction:
      _opts?.inTransaction !== undefined ? _opts.inTransaction : true,
  };

  const dbState = useDbState();
  const isMounted = useIsMounted();

  const [data, setData] = useState<D | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryResultWithIdle<D>, "data">
  >(dbState.type === "initialized" ? { type: "idle" } : { type: "waitingDb" });

  const run = useCallback(async () => {
    if (dbState.type !== "initialized") {
      // TODO: maybe wait db init as opts?

      throw new Error("Db not initialized!");
    }

    setResponse({ type: "loading" });

    const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;
    const res = await (inTransaction ? runInTransaction(db, cb) : cb(db));

    if (isMounted()) {
      setData(res);
      setResponse({ type: "loaded" });
    }

    return res;
  }, [dbState, suppressLog, inTransaction, cb, isMounted]);

  const result = useMemo(() => {
    return { ...response, data };
  }, [data, response]);

  return [run, result];
}
