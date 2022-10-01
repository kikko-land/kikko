import { IMigration, sql } from "@kikko-land/react";

export const createKVMigration: IMigration = {
  up: async (db) => {
    await db.runQuery(
      sql`
      CREATE TABLE kv (key TEXT, value TEXT);
      `
    );
  },
  id: 19,
  name: "createKV",
};
