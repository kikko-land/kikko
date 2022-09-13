---
sidebar_position: 1
slug: /backends/web
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Web

This backend uses [better-absurd-sql](https://github.com/kikko-land/better-absurd-sql).

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/query-builder @kikko-land/sql.js @kikko-land/absurd-web-backend
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/query-builder @kikko-land/sql.js @kikko-land/absurd-web-backend
```

  </TabItem>
</Tabs>

Then configure Kikko:

```typescript
import { absurdWebBackend } from "@kikko-land/absurd-web-backend";
// For Vite:
import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm?url";
// For CRA:
// import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm";

const config: IInitDbClientConfig = {
  dbName: "db-name",
  dbBackend: absurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [migrationsPlugin({ migrations: [] }), reactiveQueriesPlugin()],
};
```

It uses migration plugin. Is is useful when you need to run queries(like table creation) on app start and only once.

## Configuration and usage with Vite

For vite add this to vite config:

```typescript
export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});
```

Also to import wasm use this code:

```typescript
import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm?url";
```

Code example for react + vite: https://github.com/kikko-land/kikko/tree/main/packages/vite-react-example

Code example for vue + tauri + vite: [https://github.com/kikko-land/kikko/tree/main/packages/vite-react-example](https://github.com/kikko-land/kikko-tauri-vue)

## Configuration and usage with create-react-app

Create `src/setupProxy.js`:

```javascript
module.exports = function (app) {
  app.use(function (req, res, next) {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
  });
};
```

Also to import wasm use this code:

```typescript
import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm";
```

Code example: https://github.com/kikko-land/kikko-cra-example
