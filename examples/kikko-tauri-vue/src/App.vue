<script setup lang="ts">
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import Greet from "./components/Greet.vue";

import {
  IMigration,
  migrationsPlugin,
  useInitDb,
  runQuery,
  sql,
  reactiveQueriesPlugin,
} from "@kikko-land/vue";
import { tauriBackend } from "@kikko-land/tauri-backend";
import { currentDb } from "./currentDb";

const createNotesTableMigration: IMigration = {
  up: async (db) => {
    await runQuery(
      db,
      sql`CREATE TABLE notes(id varchar(20) PRIMARY KEY, title TEXT NOT NULL);`
    );
  },
  id: 18,
  name: "createNotesTable",
};

useInitDb(currentDb, {
  dbName: "helloWorld2",
  dbBackend: tauriBackend((dbName) => `${dbName}.db`),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
});
</script>

<template>
  <div class="container">
    <h1>Welcome to Tauri!</h1>

    <Greet />
  </div>
</template>

<style scoped>
.logo.vite:hover {
  filter: drop-shadow(0 0 2em #747bff);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #249b73);
}
</style>
