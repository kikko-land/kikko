import {
  IDbClientPlugin,
  IDbState,
  runInTransaction,
  runQuery,
} from "@kikko-land/kikko";
import { generateInsert, sql } from "@kikko-land/sql";

import { IMigration } from "./types";

const migrationsTable = "migrations";

const runMigrations = (state: IDbState, migrations: IMigration[]) => {
  if (migrations.length === 0) return;

  return runInTransaction(state, async (state) => {
    await runQuery(
      state,
      sql`
        CREATE TABLE IF NOT EXISTS ${sql.raw(migrationsTable)} (
          id INTEGER PRIMARY KEY,
          name varchar(20) NOT NULL,
          migratedAt INTEGER NOT NULL
        )
      `
    );

    const migratedMigrations = await runQuery<{ id: number }>(
      state,
      sql`SELECT id FROM ${sql.raw(migrationsTable)}`
    );

    const migratedIds = new Set(migratedMigrations.map(({ id }) => id));

    for (const migration of migrations.sort((a, b) => a.id - b.id)) {
      if (migratedIds.has(migration.id)) return;

      await migration.up(state);

      await runQuery(
        state,
        generateInsert(migrationsTable, [
          {
            id: migration.id,
            name: migration.name,
            migratedAt: new Date().getTime(),
          },
        ])
      );
    }
  });
};

export const migrationsPlugin = ({
  migrations,
}: {
  migrations: IMigration[];
}): IDbClientPlugin => (state: IDbState) => {
  state.sharedState.eventsEmitter.on("initialized", async () => {
    await runMigrations(state, migrations);
  });

  return state;
};
