---
sidebar_position: 6
slug: /backends/react-native
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# React Native

This backend uses [react-native-sqlite-storage](https://github.com/andpor/react-native-sqlite-storage).

## Installation

Install Kikko packages and react-native-sqlite-storage:

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/react @kikko-land/query-builder @kikko-land/react-native-backend react-native-sqlite-storage
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/react @kikko-land/query-builder @kikko-land/react-native-backend react-native-sqlite-storage
```

  </TabItem>
</Tabs>

Then configure Kikko:

```typescript
import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  migrationsPlugin,
  reactiveQueriesPlugin,
} from "@kikko-land/react";
import { reactNativeBackend } from "@kikko-land/react-native-backend";

const config: IInitDbClientConfig = {
  dbName: "kikko-db",
  dbBackend: reactNativeBackend({ name: (dbName) => `${dbName}.db` }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTable] }),
    reactiveQueriesPlugin({ webMultiTabSupport: false }),
  ],
};
```

And then wrap your with DbProvider and EnsureDbLoaded(optional):

```tsx
import { DbProvider, EnsureDbLoaded } from "@kikko-land/react";

<DbProvider config={config}>
  <EnsureDbLoaded fallback={<Text>Loading db...</Text>}>
    <App />
  </EnsureDbLoaded>
</DbProvider>;
```

Code example: https://github.com/kikko-land/kikko-react-native-example
