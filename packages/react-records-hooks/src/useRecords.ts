import { IDbState, IWithToSql, withSuppressedLog } from "@trong-orm/core";
import {
  DistributiveOmit,
  Falsy,
  IQueryResult,
  useDbState,
} from "@trong-orm/react-queries-hooks";
import { subscribeToQueries } from "@trong-orm/reactive-queries-plugin";
import { getRecords, IRecordConfig } from "@trong-orm/records";
import { useEffect, useMemo, useState } from "react";
import { startWith, switchMap, takeUntil } from "rxjs";

const getRecords$ = <
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  sql: IWithToSql
) => {
  return subscribeToQueries(db, [sql]).pipe(
    startWith(undefined),
    switchMap(() => getRecords(db, recordConfig, sql)),
    takeUntil(db.sharedState.stopStarted$)
  );
};

export function useRecords<
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  recordConfig: IRecordConfig<Row, Rec>,
  _query: IWithToSql | Falsy,
  _opts?: { suppressLog?: boolean } | undefined
): IQueryResult<Rec> {
  const dbState = useDbState();

  const { suppressLog } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
  };

  const [currentQuery, setCurrentQuery] = useState<IWithToSql | undefined>(
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
        setData(result.records);
        setResponse({ type: "loaded" });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [dbState, currentQuery, suppressLog, recordConfig]);

  useEffect(() => {
    if ((currentQuery || undefined) === (_query || undefined)) return;

    if (
      currentQuery &&
      _query &&
      currentQuery.toSql().hash === _query.toSql().hash
    ) {
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
