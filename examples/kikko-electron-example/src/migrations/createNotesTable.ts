import { IMigration, runQuery, sql } from "@kikko-land/react";

export const createNotesTableMigration: IMigration = {
  up: async (db) => {
    await runQuery(
      db,
      sql`
      CREATE TABLE IF NOT EXISTS notes (
        id varchar(20) PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );
      `
    );

    await runQuery(
      db,
      sql`
      CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);
      `
    );
  },
  id: 1653668686076,
  name: "createNotesTable",
};
