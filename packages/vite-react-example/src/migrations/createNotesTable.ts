import { IMigration, runQuery, sql } from "@trong-orm/react";

export const createNotesTableMigration: IMigration = {
  up: async (db) => {
    const query = sql`
      CREATE TABLE IF NOT EXISTS notes (
        id varchar(20) PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);
    `;

    await runQuery(db, query);
  },
  id: 1653668686076,
  name: "createNotesTable",
};
