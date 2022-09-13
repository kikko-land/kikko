---
sidebar_position: 4
slug: /backends/electron
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Electron

This backend uses [better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

This guide is for https://www.electronforge.io/ , but it still will be helpful if you have custom electron configuration.

## Installation

Install Kikko packages :

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/query-builder @kikko-land/sql.js @kikko-land/electron-better-sqlite3-backend
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/query-builder @kikko-land/sql.js @kikko-land/electron-better-sqlite3-backend
```

  </TabItem>
</Tabs>

Fix native modules webpack [issue](https://github.com/electron-userland/electron-forge/issues/2412) in `webpack.plugins.js`:

```js
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
// highlight-start
const relocateLoader = require("@vercel/webpack-asset-relocator-loader");
// highlight-end

module.exports = [
  new ForkTsCheckerWebpackPlugin(),
  // highlight-start
  {
    apply(compiler) {
      compiler.hooks.compilation.tap(
        "webpack-asset-relocator-loader",
        (compilation) => {
          relocateLoader.initAssetCache(compilation, "native_modules");
        }
      );
    },
  },
  // highlight-end
];
```

Add this to `preload.ts`:

```typescript
// See https://github.com/import-js/eslint-plugin-import/issues/1810
// eslint-disable-next-line import/no-unresolved
import { initSqliteBridge } from "@kikko-land/electron-better-sqlite3-backend/preload";

initSqliteBridge();
```

And init Kikko:

```tsx
import { electronBetterSqlite3Backend } from "@kikko-land/electron-better-sqlite3-backend";

const config: IInitDbClientConfig = {
  dbName: "helloWorld",
  dbBackend: electronBetterSqlite3Backend((dbName) => `${dbName}.db`),
  plugins: [migrationsPlugin({ migrations: [] }), reactiveQueriesPlugin()],
};
```

Usage example repo: https://github.com/kikko-land/kikko-electron-better-sqlite3-example
