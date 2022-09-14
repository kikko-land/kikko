---
sidebar_position: 5
slug: /backends/ionic
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Ionic (Angular, React only)

This backend uses [better-absurd-sql](https://github.com/kikko-land/better-absurd-sql) for web and [@awesome-cordova-plugins/sqlite](https://www.npmjs.com/package/@awesome-cordova-plugins/sqlite) for native.

## Installation

Install Kikko packages:

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/query-builder @kikko-land/sql.js @kikko-land/native-ionic-backend @kikko-land/absurd-web-backend cordova-sqlite-storage
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/query-builder @kikko-land/sql.js @kikko-land/native-ionic-backend @kikko-land/absurd-web-backend cordova-sqlite-storage
```

  </TabItem>
</Tabs>

Then configure Kikko:

```typescript
import { isPlatform } from "@ionic/react";
// @ts-ignore
import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm";

const config: IInitDbClientConfig = {
  dbName: "test-db",
  dbBackend: (async () =>
    isPlatform("hybrid")
      ? (await import("@kikko-land/native-ionic-backend")).ionicBackend(
          (name) => `${name}.db`
        )
      : (await import("@kikko-land/absurd-web-backend")).absurdWebBackend({
          wasmUrl: sqlWasmUrl,
        }))(),
  plugins: [migrationsPlugin({ migrations: [] }), reactiveQueriesPlugin()],
};
```

If you using `create-react-app` create `src/setupProxy.js`:

```javascript
module.exports = function (app) {
  app.use(function (req, res, next) {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
  });
};
```

Code example with react + ionic: https://github.com/kikko-land/kikko-ionic-example
