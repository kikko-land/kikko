import { runInTransaction, withSuppressedLog } from "@kikko-land/kikko";
import { IDbState } from "@kikko-land/kikko";
import { listenQueries } from "@kikko-land/reactive-queries-plugin";
import { ISqlAdapter } from "@kikko-land/sql";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Falsy } from "rxjs";

import { useDbState } from "../DbProvider";
import {
  DistributiveOmit,
  IQueryHookResult,
  IRunQueryHookResult,
  ISingleQueryHookResult,
} from "./types";

export function useQueries<D extends Record<string, unknown>>(
  _queries: ISqlAdapter[] | Falsy,
  _opts?: { suppressLog?: boolean; mapToObject?: boolean } | undefined
): IQueryHookResult<D[]> {
  const dbState = useDbState();

  const { suppressLog } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
  };

  const [currentQueries, setCurrentQueries] = useState<ISqlAdapter[]>(
    _queries ? _queries : []
  );
  const [data, setData] = useState<D[][] | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryHookResult<D[][]>, "data">
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

    const subscription = listenQueries<D>(db, currentQueries).subscribe(
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
      currentQueries.map((q) => q.toSql().hash).join() !==
      (_queries || []).map((q) => q.toSql().hash).join()
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

    return { ...response, data: data || [] };
  }, [data, response]);
}

export function useQuery<D extends Record<string, unknown>>(
  query: ISqlAdapter | Falsy,
  _opts?: { suppressLog?: boolean; mapToObject?: boolean } | undefined
): IQueryHookResult<D> {
  const queries = useMemo(() => (query ? [query] : []), [query]);

  const result = useQueries<D>(queries, _opts);

  return useMemo(() => {
    if (result.type === "loaded") {
      if (!result.data) {
        throw new Error(
          "Internal error: response state is loaded, but there is not data!"
        );
      }

      return { ...result, data: result.data[0] || [] };
    }

    return {
      ...result,
      data: result.data?.[0] || [],
    };
  }, [result]);
}

export function useQueryFirstRow<D extends Record<string, unknown>>(
  query: ISqlAdapter | Falsy,
  _opts?: { suppressLog?: boolean; mapToObject?: boolean } | undefined
): ISingleQueryHookResult<D> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  D extends (db: IDbState) => (...args: any[]) => Promise<R>,
  R
>(
  cb: D,
  _opts?: { suppressLog?: boolean; inTransaction?: boolean } | undefined
): readonly [
  (...args: Parameters<ReturnType<D>>) => Promise<R>,
  IRunQueryHookResult<R>
] {
  const { suppressLog, inTransaction } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
    inTransaction:
      _opts?.inTransaction !== undefined ? _opts.inTransaction : true,
  };

  const dbState = useDbState();
  const isMounted = useIsMounted();

  const [data, setData] = useState<R>();
  const [runStateType, setRunStateType] = useState<
    IRunQueryHookResult<R>["type"]
  >(dbState.type === "initialized" ? "idle" : "waitingDb");

  useEffect(() => {
    if (dbState.type === "initialized") {
      setRunStateType("idle");
    } else {
      setRunStateType("waitingDb");
    }
  }, [dbState.type]);

  const toCall = useCallback(
    async (...args: Parameters<ReturnType<D>>) => {
      if (dbState.type !== "initialized") {
        // TODO: maybe wait db init as opts?

        throw new Error("Db not initialized!");
      }

      setRunStateType("running");

      const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;
      const res = await (inTransaction
        ? runInTransaction(db, (db) => cb(db)(...args))
        : cb(db)(...args));

      if (isMounted()) {
        setData(res);
        setRunStateType("done");
      }

      return res;
    },
    [cb, dbState, inTransaction, isMounted, suppressLog]
  );

  // Simulation of useEvent
  const toCallRef = useRef<(...args: Parameters<ReturnType<D>>) => Promise<R>>(
    toCall
  );
  useEffect(() => {
    toCallRef.current = toCall;
  }, [toCall]);

  const run = useCallback((...args: Parameters<ReturnType<D>>) => {
    return toCallRef.current(...args);
  }, []);

  const result = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return { type: runStateType, data: data! };
  }, [data, runStateType]);

  return [run, result];
}

export function useCacheQuery<T extends ISqlAdapter>(_query: T): T {
  const [query, setQuery] = useState(_query);

  useEffect(() => {
    if (query.toSql().hash !== _query.toSql().hash) {
      setQuery(_query);
    }
  }, [_query, query]);

  return query;
}
