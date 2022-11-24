/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React from 'react';
import {Text} from 'react-native';

import {enablePromise} from 'react-native-sqlite-storage';
import {sql} from '@kikko-land/query-builder';
import {
  IMigration,
  runQuery,
  IInitDbClientConfig,
  migrationsPlugin,
  reactiveQueriesPlugin,
  DbProvider,
  EnsureDbLoaded,
} from '@kikko-land/react';
import {reactNativeBackend} from '@kikko-land/react-native-backend';
import {Screen} from './components/Screen';

enablePromise(true);

const createNotesTable: IMigration = {
  up: async db => {
    const query = sql`
      CREATE TABLE notes (
        id varchar(20) PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);
    `;

    await runQuery(db, query);
  },
  id: 1653668686076, // id should be uniq
  name: 'createNotesTable',
};

const config: IInitDbClientConfig = {
  dbName: 'trong-db',
  dbBackend: reactNativeBackend({name: dbName => `${dbName}.db`}),
  plugins: [
    migrationsPlugin({migrations: [createNotesTable]}),
    reactiveQueriesPlugin({webMultiTabSupport: false}),
  ],
};

const App = () => {
  return (
    <DbProvider config={config}>
      <EnsureDbLoaded fallback={<Text>Loading db...</Text>}>
        <Screen />
      </EnsureDbLoaded>
    </DbProvider>
  );
};

export default App;
