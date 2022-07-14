const RETRYABLE_EXCEPTIONS = new Set([
  "TransactionInactiveError",
  "InvalidStateError",
]);

// For debugging.
let nextTxId = 0;
const mapTxToId = new WeakMap();
function log(...args: unknown[]) {
  // console.debug(...args);
}

// This class manages IDBTransaction and IDBRequest instances. It tries
// to reuse transactions to minimize transaction overhead.
export class IDBContext {
  public dbReady: Promise<IDBDatabase>;
  private txOptions: { durability: string };

  private tx: IDBTransaction | undefined;
  private txComplete: Promise<void> | undefined;
  private request: IDBRequest | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chain: Promise<any> = Promise.resolve();

  constructor(
    idbDatabase: Promise<IDBDatabase> | IDBDatabase,
    txOptions = { durability: "default" }
  ) {
    this.dbReady = Promise.resolve(idbDatabase);
    this.txOptions = txOptions;
  }

  /**
   * Run a function with the provided object stores. The function
   * should be idempotent in case it is passed an expired transaction.
   */
  async run<T>(
    mode: IDBTransactionMode,
    f: (arg: Record<string, Store>) => Promise<T> | T
  ): Promise<T> {
    // Ensure that functions run sequentially.
    return (this.chain = this.chain.then(() => {
      return this.performRun<T>(mode, f);
    }));
  }

  private async performRun<T>(
    mode: IDBTransactionMode,
    f: (arg: Record<string, Store>) => Promise<T> | T
  ): Promise<T> {
    const db = await this.dbReady;
    const storeNames = Array.from(db.objectStoreNames);
    if (mode !== "readonly" && this.tx?.mode === "readonly") {
      // Force creation of a new read-write transaction.
      this.tx = undefined;
    } else if (this.request?.readyState === "pending") {
      const req = this.request;

      // Wait for pending IDBRequest so the IDBTransaction is active.
      await new Promise((resolve) => {
        req.addEventListener("success", resolve);
        req.addEventListener("error", resolve);
      });
    }

    let res: T | "not_set" = "not_set";

    // Run the user function with a retry in case the transaction is invalid.
    for (let i = 0; i < 2; ++i) {
      if (!this.tx) {
        // @ts-expect-error lib dom misses third argument
        this.tx = db.transaction(storeNames, mode, this.txOptions);

        // const timeStart = Date.now();
        // console.log("start transaction");

        const tx = this.tx;
        this.txComplete = new Promise((resolve) => {
          tx.addEventListener("complete", () => {
            if (this.tx === tx) {
              this.tx = undefined;
            }

            resolve();

            // console.log("end transaction", Date.now() - timeStart);

            log(`transaction ${mapTxToId.get(tx)} complete`);
          });
        });

        log(`new transaction ${nextTxId} ${mode}`);
        mapTxToId.set(this.tx, nextTxId++);
      }

      try {
        const tx = this.tx;

        const stores = Object.fromEntries(
          storeNames.map((name) => {
            const objectStore = tx.objectStore(name);
            const store = new Store(objectStore, (request: IDBRequest) =>
              this.setRequest(request)
            );
            return [name, store];
          })
        );

        // console.log(stores, storeNames);
        res = await f(stores);
      } catch (e) {
        if (i || !RETRYABLE_EXCEPTIONS.has((e as Error).name)) {
          // On failure make sure nothing is committed.
          try {
            this.tx.abort();
            // eslint-disable-next-line no-empty
          } catch (ignored) {}
          throw e;
        }

        this.tx = undefined;
      }
    }

    if (res === "not_set") {
      throw new Error("No result returns, that should not happen!");
    }

    return res;
  }

  async sync() {
    const request = this.request;
    if (request?.readyState === "pending") {
      await new Promise((resolve) => {
        request.addEventListener("success", resolve);
        request.addEventListener("error", resolve);
      });

      request.transaction?.commit();
    }
    return this.txComplete;
  }

  private setRequest(request: IDBRequest) {
    this.request = request;
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        // console.log(request.result);
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// const cache = new Map<number, Int8Array>();
// IDBStore wrapper passed to IDBActivity run functions.
class Store {
  private store: IDBObjectStore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addRequest: (request: IDBRequest) => Promise<any>;

  constructor(
    store: IDBObjectStore,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addRequest: (request: IDBRequest) => Promise<any>
  ) {
    this.store = store;
    this.addRequest = addRequest;
  }

  get(query: IDBValidKey | IDBKeyRange) {
    // if (cache.has(query.lower[1])) {
    //   console.log("cache hit!");
    //   return this.addRequest({
    //     set onsuccess(call) {
    //       call();
    //     },
    //     onerror: () => null,
    //     result: { data: cache.get(query.lower[1]) },
    //   });
    // }
    // log(`get ${this.store.name}`, query.lower);
    const request = this.store.get(query);
    return this.addRequest(request);
  }

  getAll(query: IDBValidKey | IDBKeyRange, count: number) {
    log(`getAll ${this.store.name}`, query, count);

    const request = this.store.getAll(query, count);

    return this.addRequest(request);
  }

  getKey(query: IDBValidKey | IDBKeyRange) {
    log(`getKey ${this.store.name}`, query);
    const request = this.store.getKey(query);
    return this.addRequest(request);
  }

  getAllKeys(query: IDBValidKey | IDBKeyRange, count: number) {
    log(`getAllKeys ${this.store.name}`, query, count);
    const request = this.store.getAllKeys(query, count);
    return this.addRequest(request);
  }

  put(value: unknown, key?: IDBValidKey) {
    // cache.set(value.offset, value.data);
    log(`put ${this.store.name}`, value, key);

    const request = this.store.put(value, key);
    return this.addRequest(request);
  }

  delete(query: IDBValidKey | IDBKeyRange) {
    console.trace();
    log(`delete ${this.store.name}`, query);
    const request = this.store.delete(query);
    return this.addRequest(request);
  }

  clear() {
    log(`clear ${this.store.name}`);
    const request = this.store.clear();
    return this.addRequest(request);
  }

  index(name: string) {
    return new Index(this.store.index(name), (request) =>
      this.addRequest(request)
    );
  }
}

class Index {
  private index: IDBIndex;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addRequest: (request: IDBRequest) => Promise<any>;

  constructor(
    index: IDBIndex,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addRequest: (request: IDBRequest) => Promise<any>
  ) {
    this.index = index;
    this.addRequest = addRequest;
  }

  getAllKeys(query: IDBValidKey | IDBKeyRange, count?: number) {
    log(
      `IDBIndex.getAllKeys ${this.index.objectStore.name}<${this.index.name}>`,
      query,
      count
    );
    const request = this.index.getAllKeys(query, count);
    return this.addRequest(request);
  }
}
