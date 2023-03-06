/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { d1Backend } from "@kikko-land/d1-backend";
import { initDbClient, makeId, sql } from "@kikko-land/kikko";
import {
  atomicMigrationsPlugin,
  IAtomicMigration,
} from "@kikko-land/migrations-plugin";

export interface Env {
  DB: D1Database;
}

const createCustomers: IAtomicMigration = {
  up: (tr) => {
    tr.addQuery(
      sql`
        CREATE TABLE IF NOT EXISTS Customers (CustomerID INT, CompanyName TEXT, ContactName TEXT, PRIMARY KEY (CustomerID));
      `
    );

    tr.addQuery(
      sql`INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (1, 'Alfreds Futterkiste', 'Maria Anders'),(4, 'Around the Horn', 'Thomas Hardy'),(11, 'Bs Beverages', 'Victoria Ashworth'),(13, 'Bs Beverages', 'Random Name')`
    );
  },
  id: 1653668686076,
  name: "createCustomers",
};

const initDb = (db: D1Database) =>
  initDbClient({
    dbName: "helloWorld4",
    dbBackend: d1Backend({ db }),
    plugins: [atomicMigrationsPlugin({ migrations: [createCustomers] })],
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = await initDb(env.DB);
    const id = makeId();

    await db.runInAtomicTransaction(async (tr) => {
      // For example purpose, you can run async function insied of transaction
      await new Promise((resolve) => setTimeout(resolve, 1000, ""));

      // You can also execute query inside of tr(query will be not added to transaction queue)

      const [lastCustomer] = await db.runQuery<{
        CustomerID: string;
        CompanyName: string;
        ContactName: string;
      }>(sql`SELECT * FROM Customers ORDER BY rowid DESC LIMIT 1`);

      tr.addQuery(
        // All variables inside ${} will be automatically binded to query
        sql`INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (${id}, ${`${lastCustomer.CompanyName}#${id}`}, ${`${lastCustomer.ContactName}#${id}`})`
      );
    });

    return Response.json(await db.runQuery(sql`SELECT * FROM Customers`));
  },
};
