import sql, { raw } from "../Sql";
import { getRecords, IDbState, runInTransaction, runQuery } from "./db";
import { generateInsert } from "./sqlHelpers";

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

    const migratedMigrations = await getRecords<{
      id: number;
      name: string;
    }>(state, sql`SELECT * FROM ${raw(migrationsTable)}`);

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
