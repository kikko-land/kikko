import { sql, raw } from "../Sql";
import { runQuery } from "./runQueries";
import { generateInsert } from "./sqlHelpers";
import { runInTransaction } from "./transaction";
import { IDbState } from "./types";

const migrationsTable = "migrations";

export const runMigrations = (state: IDbState) => {
  const { migrations } = state.sharedState;

  if (migrations.length === 0) return;

  return runInTransaction(state, async (state) => {
    await runQuery(
      state,
      sql`
        CREATE TABLE IF NOT EXISTS ${raw(migrationsTable)} (
          id INTEGER PRIMARY KEY,
          name varchar(20) NOT NULL,
          migratedAt INTEGER NOT NULL
        )
      `
    );

    const migratedMigrations = (
      await runQuery(state, sql`SELECT id FROM ${raw(migrationsTable)}`)
    )[0].values;

    const migratedIds = new Set(migratedMigrations.map(([id]) => id));

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
