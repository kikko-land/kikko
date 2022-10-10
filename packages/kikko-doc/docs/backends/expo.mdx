---
sidebar_position: 3
slug: /backends/expo
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Expo (React only)

This backend uses [better-absurd-sql](https://github.com/kikko-land/better-absurd-sql) for web and [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for native.

## Installation

Install expo packages:

```bash
expo install expo-sqlite
```

Install Kikko packages:

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/react @kikko-land/query-builder @kikko-land/sql.js @kikko-land/absurd-web-backend @kikko-land/native-expo-backend
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/react @kikko-land/query-builder @kikko-land/sql.js @kikko-land/absurd-web-backend @kikko-land/native-expo-backend
```

  </TabItem>
</Tabs>

Create `webpack.config.js`:

```javascript
const createExpoWebpackConfigAsync = require("@expo/webpack-config");
const path = require("path");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  config.module.rules.forEach((rule) => {
    (rule.oneOf || []).forEach((oneOf) => {
      if (oneOf.loader && oneOf.loader.indexOf("file-loader") >= 0) {
        oneOf.exclude.push(/\.wasm$/);
      }
    });
  });

  config.module.rules.push({
    test: /\.wasm$/,
    loader: "file-loader",
    type: "javascript/auto",
  });

  config.devServer = {
    ...config.devServer,
    headers: {
      ...config.devServer.headers,
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  };

  return config;
};
```

Create `metro.config.js`:

```javascript
const { getDefaultConfig } = require("expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push("db");
defaultConfig.resolver.assetExts.push("wasm");

module.exports = defaultConfig;
```

Modify `App.tsx`:

```tsx
export default function App() {
  const isLoadingComplete = useCachedResources();
  const colorScheme = useColorScheme();

  return (() => {
    if (!isLoadingComplete) {
      return null;
    } else {
      return (
        <SafeAreaProvider>
          // highlight-start
          <DbProvider config={config}>
            <EnsureDbLoaded fallback={<Text>Loading db...</Text>}>
              //highlight-end
              <Navigation colorScheme={colorScheme} />
              // highlight-start
            </EnsureDbLoaded>
          </DbProvider>
          //highlight-end
        </SafeAreaProvider>
      );
    }
  })();
}
```

Configure Kikko:

```typescript
const config: IInitDbClientConfig = {
  dbName: "kikko-db",
  dbBackend:
    Platform.OS === "web"
      ? require("@kikko-land/absurd-web-backend").absurdWebBackend({
          wasmUrl: require("@kikko-land/sql.js/dist/sql-wasm.wasm").default,
        })
      : require("@kikko-land/native-expo-backend").nativeExpoBackend(),
  plugins: [
    migrationsPlugin({ migrations: [] }),
    reactiveQueriesPlugin({ webMultiTabSupport: Platform.OS === "web" }),
  ],
};
```

Expo app example: https://github.com/kikko-land/kikko-expo-example
