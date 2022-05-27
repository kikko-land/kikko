import { QueryExecResult } from "@harika-org/sql.js";
import { map } from "rxjs";
import { Sql } from "../../Sql";
import { runQuery, runQuery$ } from "../runQueries";
import { IDbState } from "../types";

const mapToRecords = <T extends Record<string, any>>(
  result: QueryExecResult
) => {
  return (result?.values?.map((res) => {
    let obj: Record<string, any> = {};

    result.columns.forEach((col, i) => {
      obj[col] = res[i];
    });

    return obj;
  }) || []) as T[];
};

export const getRecords = async <T extends Record<string, any>>(
  state: IDbState,
  query: Sql
) => {
  const [result] = await runQuery(state, query);

  return mapToRecords<T>(result);
};

export const getRecords$ = <T extends Record<string, any>>(
  state: IDbState,
  query: Sql
) => {
  return runQuery$(state, query).pipe(
    map(([result]) => mapToRecords<T>(result))
  );
};
