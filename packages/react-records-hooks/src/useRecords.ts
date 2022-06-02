import { IDbState, withSuppressedLog } from "@trong-orm/core";
import {
  DistributiveOmit,
  Falsy,
  IQueryResult,
  useDbState,
} from "@trong-orm/react-queries-hooks";
import { subscribeToQueries } from "@trong-orm/reactive-queries";
import { getRecords, IRecordConfig } from "@trong-orm/records";
import { Sql } from "@trong-orm/sql";
import { useEffect, useMemo, useState } from "react";
import { startWith, switchMap, takeUntil } from "rxjs";

const getRecords$ = <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  sql: Sql
) => {
  return subscribeToQueries(db, [sql]).pipe(
    startWith(undefined),
    switchMap(() => getRecords(db, recordConfig, sql)),
    takeUntil(db.sharedState.stop$)
  );
};

export function useRecords<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  recordConfig: IRecordConfig<Row, Rec>,
  _query: Sql | Falsy,
  _opts?: { suppressLog?: boolean } | undefined
): IQueryResult<Rec> {
  const dbState = useDbState();

  const { suppressLog } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
  };

  const [currentQuery, setCurrentQuery] = useState<Sql | undefined>(
    _query || undefined
  );
  const [data, setData] = useState<Rec[] | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryResult<Rec[]>, "data">
  >(
    _query
      ? dbState.type === "initialized"
        ? { type: "loading" }
        : { type: "waitingDb" }
      : { type: "noSqlPresent" }
  );

  useEffect(() => {
    if (!currentQuery) {
      setResponse({ type: "noSqlPresent" });

      return;
    }

    if (dbState.type !== "initialized") {
      setResponse({ type: "waitingDb" });

      return;
    }

    const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;

    const subscription = getRecords$(db, recordConfig, currentQuery).subscribe(
      (result) => {
        setData(result);
        setResponse({ type: "loaded" });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [dbState, currentQuery, suppressLog, recordConfig]);

  useEffect(() => {
    if ((currentQuery || undefined) === (_query || undefined)) return;

    if (currentQuery && _query && currentQuery.hash === _query.hash) {
      return;
    }

    setCurrentQuery(_query || undefined);
  }, [currentQuery, _query]);

  return useMemo(() => {
    if (response.type === "loaded") {
      if (!data) {
        throw new Error(
          "Internal error: response state is loaded, but there is no data!"
        );
      }

      return { ...response, data: data || [] };
    }

    return { ...response, data: data || [] };
  }, [data, response]);
}
