import { IDb, IDbClientPlugin } from "@kikko-land/kikko";
import { generateInsert, sql } from "@kikko-land/boono-sql";

import { IMigration } from "./types";

const migrationsTable = "migrations";

const runMigrations = (db: IDb, migrations: IMigration[]) => {
  if (migrations.length === 0) return;

  return db.runInTransaction(
    async (db) => {
      await db.runQuery(
        sql`
        CREATE TABLE IF NOT EXISTS ${sql.raw(migrationsTable)} (
          id INTEGER PRIMARY KEY,
          name varchar(20) NOT NULL,
          migratedAt INTEGER NOT NULL
        )
      `
      );

      const migratedMigrations = await db.runQuery<{ id: number }>(
        sql`SELECT id FROM ${sql.raw(migrationsTable)}`
      );

      const migratedIds = new Set(migratedMigrations.map(({ id }) => id));

      for (const migration of migrations.sort((a, b) => a.id - b.id)) {
        if (migratedIds.has(migration.id)) return;

        await migration.up(db);

        await db.runQuery(
          generateInsert(migrationsTable, [
            {
              id: migration.id,
              name: migration.name,
              migratedAt: new Date().getTime(),
            },
          ])
        );
      }
    },
    { label: "migration transaction" }
  );
};

export const migrationsPlugin =
  ({ migrations }: { migrations: IMigration[] }): IDbClientPlugin =>
  (db: IDb) => {
    db.__state.sharedState.eventsEmitter.on("initialized", async () => {
      await runMigrations(db, migrations);
    });

    return db;
  };
