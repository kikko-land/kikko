import { runInTransaction, runQueries, withSuppressedLog } from "@trong/core";
import { IDbState } from "@trong/core";
import { subscribeToQueries$ } from "@trong/reactive-queries";
import { Sql } from "@trong/sql";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Falsy, startWith, switchMap } from "rxjs";

import { useDbState } from "../DbProvider";
import { DistributiveOmit, IQueryResult, IQueryResultWithIdle } from "./types";

function runQueries$<D extends Record<string, unknown>>(
  state: IDbState,
  queries: Sql[]
) {
  return subscribeToQueries$(state, queries).pipe(
    startWith(undefined),
    switchMap(async () => {
      return runQueries<D>(state, queries);
    })
  );
}

export function useQueries<D extends Record<string, unknown>>(
  _queries: Sql[] | Falsy,
  _opts?: { suppressLog?: boolean; mapToObject?: boolean } | undefined
): IQueryResult<D[][]> {
  const dbState = useDbState();

  const { suppressLog } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
  };

  const [currentQueries, setCurrentQueries] = useState<Sql[]>(
    _queries ? _queries : []
  );
  const [data, setData] = useState<D[][] | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryResult<D[][]>, "data">
  >(
    _queries
      ? dbState.type === "initialized"
        ? { type: "loading" }
        : { type: "waitingDb" }
      : { type: "noSqlPresent" }
  );

  useEffect(() => {
    if (currentQueries.length === 0) {
      setResponse({ type: "noSqlPresent" });

      return;
    }

    if (dbState.type !== "initialized") {
      setResponse({ type: "waitingDb" });

      return;
    }

    const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;

    const subscription = runQueries$<D>(db, currentQueries).subscribe(
      (result) => {
        setData(result);
        setResponse({ type: "loaded" });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [dbState, currentQueries, suppressLog]);

  useEffect(() => {
    if (
      currentQueries.map((q) => q.hash).join() !==
      (_queries || []).map((q) => q.hash).join()
    ) {
      setCurrentQueries(_queries || []);
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

export function useQuery<D extends Record<string, unknown>>(
  query: Sql | Falsy,
  _opts?: { suppressLog?: boolean; mapToObject?: boolean } | undefined
): IQueryResult<D[]> {
  const queries = useMemo(() => (query ? [query] : []), [query]);

  const result = useQueries<D>(queries, _opts);

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

export function useQueryFirstRow<D extends Record<string, unknown>>(
  query: Sql | Falsy,
  _opts?: { suppressLog?: boolean; mapToObject?: boolean } | undefined
): IQueryResult<D> {
  const res = useQuery<D>(query, _opts);

  return useMemo(() => {
    if (res.type === "loaded") {
      return { ...res, data: res.data[0] };
    }

    return { ...res, data: res.data?.[0] };
  }, [res]);
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

export function useRunQuery<
  D extends (...args: any[]) => (db: IDbState) => Promise<R>,
  R extends any
>(
  cb: D,
  _opts?: { suppressLog?: boolean; inTransaction?: boolean } | undefined
): readonly [
  (...args: Parameters<D>) => Promise<R>,
  DistributiveOmit<IQueryResultWithIdle<R>, "data"> & { data?: R | undefined }
] {
  const { suppressLog, inTransaction } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
    inTransaction:
      _opts?.inTransaction !== undefined ? _opts.inTransaction : true,
  };

  const dbState = useDbState();
  const isMounted = useIsMounted();

  const [data, setData] = useState<R | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryResultWithIdle<D>, "data">
  >(dbState.type === "initialized" ? { type: "idle" } : { type: "waitingDb" });

  const toCall = useCallback(
    async (...args: Parameters<D>) => {
      if (dbState.type !== "initialized") {
        // TODO: maybe wait db init as opts?

        throw new Error("Db not initialized!");
      }

      setResponse({ type: "loading" });

      const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;
      const res = await (inTransaction
        ? runInTransaction(db, cb(...args))
        : cb(...args)(db));

      if (isMounted()) {
        setData(res);
        setResponse({ type: "loaded" });
      }

      return res;
    },
    [cb, dbState, inTransaction, isMounted, suppressLog]
  );

  // Simulation of useEvent
  const toCallRef = useRef<(...args: Parameters<D>) => Promise<R>>(toCall);
  useEffect(() => {
    toCallRef.current = toCall;
  }, [toCall]);

  const run = useCallback((...args: Parameters<D>) => {
    return toCallRef.current(...args);
  }, []);

  const result = useMemo(() => {
    return { ...response, data };
  }, [data, response]);

  return [run, result];
}

export function useSql(_query: Sql) {
  const [query, setQuery] = useState(_query);

  useEffect(() => {
    if (query.hash !== _query.hash) {
      setQuery(_query);
    }
  }, [_query, query]);

  return query;
}
