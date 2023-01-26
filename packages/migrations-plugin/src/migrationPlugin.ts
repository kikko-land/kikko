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

  let retriesCount = 0;

  retryLoop: while (true) {
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

      try {
        await migrate(migration);
      } catch (e) {
        if (e instanceof Error) {
          // That may happens when other migrator is running in parallel
          //
          // Let's just retry to run migrations again
          if (
            e.message.includes("UNIQUE") &&
            e.message.includes("migrations.id") &&
            retriesCount < 5
          ) {
            retriesCount++;

            await new Promise((resolve) =>
              setTimeout(resolve, retriesCount * 500, undefined)
            );

            continue retryLoop;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
    }

    return;
  }
};

const runMigrations = async (db: IDb, migrations: IMigration[]) => {
  return handleMigrations(db, migrations, async (migration) => {
    await db.runInTransaction(async (db) => {
      await db.runQuery(
        generateInsert(migrationsTable, [
          {
            id: migration.id,
            name: migration.name,
            migratedAt: new Date().getTime(),
          },
        ])
      );

      await migration.up(db);
    });
  });
};

const runAtomicMigrations = async (db: IDb, migrations: IAtomicMigration[]) => {
  return handleMigrations(db, migrations, async (migration) => {
    await db.runInAtomicTransaction(async (tr) => {
      tr.addQuery(
        generateInsert(migrationsTable, [
          {
            id: migration.id,
            name: migration.name,
            migratedAt: new Date().getTime(),
          },
        ])
      );

      await migration.up(tr, db);
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
