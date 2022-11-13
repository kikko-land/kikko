import { generateInsert, sql } from "@kikko-land/boono-sql";
import { IDb, IDbClientPlugin } from "@kikko-land/kikko";

import { IAtomicMigration, IMigration } from "./types";

const migrationsTable = "migrations";

const handleMigrations = async <T extends IMigration | IAtomicMigration>(
  db: IDb,
  migrations: T[],
  migrate: (m: T) => Promise<void> | void
) => {
  if (migrations.length === 0) return;

  await db.runQuery(
    sql`
        CREATE TABLE IF NOT EXISTS ${sql.raw(migrationsTable)} (
          id INTEGER PRIMARY KEY,
          name varchar(20) NOT NULL,
          migratedAt INTEGER NOT NULL
        )
      `
  );

  const migratedIds = new Set(
    (
      await db.runQuery<{ id: number }>(
        sql`SELECT id FROM ${sql.raw(migrationsTable)}`
      )
    ).map(({ id }) => id)
  );

  for (const migration of migrations.sort((a, b) => a.id - b.id)) {
    if (migratedIds.has(migration.id)) return;

    await migrate(migration);
  }
};

const runMigrations = async (db: IDb, migrations: IMigration[]) => {
  return handleMigrations(db, migrations, async (migration) => {
    await db.runInTransaction(async (db) => {
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
    });
  });
};

const runAtomicMigrations = async (db: IDb, migrations: IAtomicMigration[]) => {
  return handleMigrations(db, migrations, async (migration) => {
    await db.runInAtomicTransaction(async (tr) => {
      await migration.up(tr, db);

      tr.addQuery(
        generateInsert(migrationsTable, [
          {
            id: migration.id,
            name: migration.name,
            migratedAt: new Date().getTime(),
          },
        ])
      );
    });
  });
};

export const migrationsPlugin =
  ({ migrations }: { migrations: IMigration[] }): IDbClientPlugin =>
  (db: IDb) => {
    db.__state.sharedState.eventsEmitter.on("initialized", async () => {
      await runMigrations(db, migrations);
    });

    return db;
  };

export const atomicMigrationsPlugin =
  ({ migrations }: { migrations: IAtomicMigration[] }): IDbClientPlugin =>
  (db: IDb) => {
    db.__state.sharedState.eventsEmitter.on("initialized", async () => {
      await runAtomicMigrations(db, migrations);
    });

    return db;
  };
