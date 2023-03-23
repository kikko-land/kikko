import { absurdWebBackend } from "@kikko-land/absurd-web-backend";
import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  makeId,
  migrationsPlugin,
} from "@kikko-land/react";
import absurdSqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm?url";
import { waSqliteWebBackend } from "@kikko-land/wa-sqlite-web-backend";
import { useMemo } from "react";
import { useLocation } from "react-use";
import sqlWasmUrl from "wa-sqlite/dist/wa-sqlite-async.wasm?url";

import { createKVMigration } from "./../migrations/createKV";
import { Benchmark } from "./Benchmark";

const buildConfig = (config: IBackendConfig): IInitDbClientConfig => {
  return {
    dbName: `benchmark-${config.type}-${makeId().slice(0, 5)}`,
    dbBackend:
      config.type === "absurd"
        ? absurdWebBackend({
            wasmUrl: absurdSqlWasmUrl,
            pageSize: 8 * 1024,
            cacheSize: -100,
          })
        : waSqliteWebBackend({
            wasmUrl: sqlWasmUrl,
            pageSize: 8 * 1024,
            cacheSize: -100,
          }),
    plugins: [
      migrationsPlugin({
        migrations: [createKVMigration],
      }),
    ],
  };
};

export type IBackendConfig = { type: "absurd" } | { type: "wa-sqlite" };

function parseQuery(queryString: string) {
  const query: Record<string, string> = {};
  const pairs = (
    queryString[0] === "?" ? queryString.substr(1) : queryString
  ).split("&");

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split("=");

    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || "");
  }
  return query;
}

export const backendOptions = {
  absurd: { type: "absurd" },
  waMinimal: {
    type: "wa-sqlite",
  },
} as const;

export const AppBenchmark = () => {
  const backendName = (parseQuery(useLocation().search || "")["backend"] ||
    "waMinimal") as keyof typeof backendOptions;

  const config = useMemo(() => {
    return buildConfig(backendOptions[backendName || "waMinimal"]);
  }, [backendName]);

  return (
    <DbProvider config={config}>
      <EnsureDbLoaded fallback={<div>Loading db...</div>}>
        <Benchmark />
      </EnsureDbLoaded>
    </DbProvider>
  );
};
