import * as VFS from "wa-sqlite/src/VFS.js";

import { IDBContext } from "./IDBContext.js";
import { WebLocks } from "./WebLocks.js";

function log(...args: unknown[]) {
  // console.debug(...args);
}

const blockSize = 32 * 1024;

type IOptions = {
  durability: "default" | "strict" | "relaxed";
};

const DEFAULT_OPTIONS: IOptions = { durability: "default" };

interface IBlock {
  offset: number;
  data: Int8Array;
}

interface IOpenedFile {
  path: string;
  flags: number;
  fileSize: number;
}

export class IDCachedWritesVFS extends VFS.Base {
  private filesState = new Map<number, { file: IOpenedFile; db: IDBContext }>();
  private dbNameFileIdMap = new Map<string, number>();
  private webLocks = new WebLocks();
  private options;

  private pendingWrites: Map<number, Map<number, IBlock>> = new Map();
  private cursors: Map<number, IDBCursorWithValue> = new Map();

  constructor(public name: string, options = DEFAULT_OPTIONS) {
    super();
    this.options = options;
  }

  xOpen(
    name: string,
    fileId: number,
    flags: number,
    pOutFlags: {
      set: (arg0: number) => void;
    }
  ) {
    return this.handleAsync(async () => {
      if (name === null) name = `null_${fileId}`;

      this.dbNameFileIdMap.set(name, fileId);

      const db = new IDBContext(openDatabase(name), {
        durability: this.options.durability,
      });

      log(`xOpen ${name} ${fileId} 0x${flags.toString(16)}`);

      try {
        // Filenames can be URLs, possibly with query parameters.
        const url = new URL(name, "file://localhost/");
        const file = {
          path: url.pathname,
          flags,
          fileSize: 0,
        };

        this.filesState.set(fileId, {
          file,
          db,
        });

        // Read the last block to get the file size.
        const lastBlock = await db.run("readonly", ({ blocks }) => {
          return blocks.get(this.bound(-Infinity));
        });
        if (lastBlock) {
          file.fileSize = lastBlock.data.length - lastBlock.offset;
        } else if (flags & VFS.SQLITE_OPEN_CREATE) {
          const block: IBlock = {
            offset: 0,
            data: new Int8Array(0),
          };

          await db.run("readwrite", ({ blocks }) => blocks.put(block));
        } else {
          throw new Error(`file not found: ${file.path}`);
        }
        pOutFlags.set(flags & VFS.SQLITE_OPEN_READONLY);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_CANTOPEN;
      }
    });
  }

  xClose(fileId: number) {
    return this.handleAsync(async () => {
      try {
        const state = this.filesState.get(fileId);
        if (state) {
          const { file, db } = state;

          log(`xClose ${file.path}`);

          this.filesState.delete(fileId);
          if (file.flags & VFS.SQLITE_OPEN_DELETEONCLOSE) {
            await db.run("readwrite", async ({ blocks }) => {
              await blocks.delete(this.bound(-Infinity));
            });
          }
        }
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  private cursorPromises: Map<
    number,
    { resolve: (res: IBlock) => void; reject: (e: unknown) => void }
  > = new Map();
  xRead(
    fileId: number,
    pData: {
      size: number;
      value: Int8Array;
    },
    iOffset: number
  ) {
    return this.handleAsync(async () => {
      // TODO: not sure why, but if is not in handleAsync then code called twice.
      // Is it stack unwind/rewind?
      const { db } = this.getFileStateByIdOrThrow(fileId);

      const filePendingWrites = this.pendingWrites.get(fileId);
      const block = filePendingWrites?.get(iOffset);

      if (block) {
        pData.value.set(block.data);

        return VFS.SQLITE_OK;
      }

      const dir = this.getReadDirection(fileId);

      const waitCursor = async () => {
        const block = await new Promise<IBlock>((resolve, reject) => {
          if (this.cursorPromises.has(fileId)) {
            throw new Error(
              "waitCursor() called but something else is already waiting"
            );
          }
          this.cursorPromises.set(fileId, { resolve, reject });
        });

        // console.log({ block });

        const blockOffset = iOffset + block.offset;
        const nBytesToCopy = Math.min(
          Math.max(block.data.length - blockOffset, 0), // source bytes
          pData.value.length
        ); // destination bytes
        pData.value.set(
          block.data.subarray(blockOffset, blockOffset + nBytesToCopy)
        );

        if (nBytesToCopy < pData.value.length) {
          pData.value.fill(0, nBytesToCopy, pData.value.length);
          return VFS.SQLITE_IOERR_SHORT_READ;
        }

        return VFS.SQLITE_OK;
      };

      const cursor = this.cursors.get(fileId);
      if (cursor) {
        const key = cursor.key as number;
        // console.log({ key });
        if (
          cursor.direction === "next" &&
          key < -iOffset &&
          -iOffset < key + 100 * blockSize
        ) {
          cursor.advance(Math.abs(Math.ceil((-iOffset - key) / blockSize)));

          return waitCursor();
        } else if (
          cursor.direction === "prev" &&
          key - 100 * blockSize < -iOffset &&
          -iOffset < key
        ) {
          cursor.advance(Math.abs(Math.ceil((-key - iOffset) / blockSize)));

          return waitCursor();
        } else {
          // console.log(
          //   "cursor miss(",
          //   cursor.direction,
          //   cursor.direction === "next"
          //     ? [key, -iOffset, key + 100 * blockSize]
          //     : [key - 100 * blockSize, -iOffset, key]
          // );
          this.cursors.delete(fileId);
        }
      } else {
        if (dir) {
          this.prevReads.delete(fileId);

          const keyRange = (() => {
            if (dir === "prev") {
              return IDBKeyRange.upperBound(-iOffset);
            } else {
              return IDBKeyRange.lowerBound(-iOffset);
            }
          })();

          const idb = await db.dbReady;

          // @ts-expect-error lib dom misses third argument
          const tx = idb.transaction("blocks", "readwrite", {
            durability: "relaxed",
          });

          const blocksStore = tx.objectStore("blocks");

          const req = blocksStore.openCursor(keyRange, dir);

          req.onsuccess = (e) => {
            let cursor: IDBCursorWithValue = (e.target as any).result;
            this.cursors.set(fileId, cursor);

            const promise = this.cursorPromises.get(fileId);

            if (!promise)
              throw new Error("Got data from cursor but nothing is waiting it");

            promise.resolve(cursor ? cursor.value : null);
            this.cursorPromises.delete(fileId);
          };

          req.onerror = (e) => {
            console.log("Cursor failure:", e);

            const promise = this.cursorPromises.get(fileId);

            if (!promise)
              throw new Error("Got data from cursor but nothing is waiting it");

            promise.reject(e);
            this.cursorPromises.delete(fileId);
          };

          return await waitCursor();
        } else {
          const res = this.prevReads.get(fileId);
          if (!res) {
            this.prevReads.set(fileId, [0, 0, -iOffset]);
          } else {
            res.push(-iOffset);
            res.shift();
          }
        }
      }

      // console.log(`xRead ${file.path} ${pData.value.length} ${iOffset}`);

      try {
        const block: IBlock = await db.run("readonly", ({ blocks }) => {
          return blocks.get(this.bound(-iOffset));
        });

        const blockOffset = iOffset + block.offset;
        const nBytesToCopy = Math.min(
          Math.max(block.data.length - blockOffset, 0), // source bytes
          pData.value.length
        ); // destination bytes
        pData.value.set(
          block.data.subarray(blockOffset, blockOffset + nBytesToCopy)
        );

        if (nBytesToCopy < pData.value.length) {
          pData.value.fill(0, nBytesToCopy, pData.value.length);
          return VFS.SQLITE_IOERR_SHORT_READ;
        }
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  // The ideas is taken from absurd-sql. Very smart!
  // Also this might be helpful https://nolanlawson.com/2021/08/22/speeding-up-indexeddb-reads-and-writes/
  private prevReads: Map<number, [number, number, number]> = new Map();
  private getReadDirection(fileId: number) {
    // There are a two ways we can read data: a direct `get` request
    // or opening a cursor and iterating through data. We don't know
    // what future reads look like, so we don't know the best strategy
    // to pick. Always choosing one strategy forgoes a lot of
    // optimization, because iterating with a cursor is a lot faster
    // than many `get` calls. On the other hand, opening a cursor is
    // slow, and so is calling `advance` to move a cursor over a huge
    // range (like moving it 1000 items later), so many `get` calls would
    // be faster. In general:
    //
    // * Many `get` calls are faster when doing random accesses
    // * Iterating with a cursor is faster if doing mostly sequential
    //   accesses
    //
    // We implement a heuristic and keeps track of the last 3 reads
    // and detects when they are mostly sequential. If they are, we
    // open a cursor and start reading by iterating it. If not, we do
    // direct `get` calls.
    //
    // On top of all of this, each browser has different perf
    // characteristics. We will probably want to make these thresholds
    // configurable so the user can change them per-browser if needed,
    // as well as fine-tuning them for their usage of sqlite.

    let prevReads = this.prevReads.get(fileId);
    if (prevReads) {
      // Has there been 3 forward sequential reads within 10 blocks?
      if (
        prevReads[0] < prevReads[1] &&
        prevReads[1] < prevReads[2] &&
        Math.abs(prevReads[2] - prevReads[0]) < 10 * blockSize
      ) {
        return "next";
      }

      // Has there been 3 backwards sequential reads within 10 blocks?
      if (
        prevReads[0] > prevReads[1] &&
        prevReads[1] > prevReads[2] &&
        Math.abs(prevReads[0] - prevReads[2]) < 10 * blockSize
      ) {
        return "prev";
      }
    }

    return null;
  }

  xWrite(
    fileId: number,
    pData: {
      size: number;
      value: Int8Array;
    },
    iOffset: number
  ) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    log(`xWrite ${file.path} ${pData.value.length} ${iOffset}`);

    try {
      // Convert the write directly into an IndexedDB object.
      const block: IBlock = {
        offset: -iOffset,
        data: pData.value.slice(),
      };

      const filePendingWrites = this.pendingWrites.get(fileId);

      if (filePendingWrites) {
        filePendingWrites.set(iOffset, block);

        return VFS.SQLITE_OK;
      }

      void (async () => {
        file.fileSize = Math.max(file.fileSize, iOffset + pData.value.length);

        await db.run("readwrite", ({ blocks }) => blocks.put(block));
      })();

      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xTruncate(fileId: number, iSize: number) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    log(`xTruncate ${file.path} ${iSize}`);

    try {
      file.fileSize = iSize;

      void db.run("readwrite", async ({ blocks }) => {
        await blocks.delete(this.bound(-Infinity, -iSize));
        if (iSize === 0) {
          const block: IBlock = {
            offset: 0,
            data: new Int8Array(0),
          };
          await blocks.put(block);
        }
      });
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xSync(fileId: number, flags: number) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    if (this.options.durability !== "relaxed") {
      return this.handleAsync(async () => {
        log(`xSync ${file.path} ${flags}`);

        try {
          await db.sync();
          return VFS.SQLITE_OK;
        } catch (e) {
          console.error(e);
          return VFS.SQLITE_IOERR;
        }
      });
    }

    return VFS.SQLITE_OK;
  }

  xFileSize(
    fileId: number,
    pSize64: {
      set: (arg0: number) => void;
    }
  ) {
    const { file } = this.getFileStateByIdOrThrow(fileId);

    log(`xFileSize ${file.path}`);

    pSize64.set(file.fileSize);
    return VFS.SQLITE_OK;
  }

  xLock(fileId: number, flags: number) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    return this.handleAsync(async () => {
      log(`xLock ${file.path} ${flags}`);

      if (flags === VFS.SQLITE_LOCK_EXCLUSIVE) {
        this.pendingWrites.set(fileId, new Map());
      }

      try {
        const result = await this.webLocks.lock(file.path, flags);
        if (result === VFS.SQLITE_OK && flags === VFS.SQLITE_LOCK_SHARED) {
          // Update cached file size when lock is acquired.
          const lastBlock = await db.run("readonly", ({ blocks }) => {
            return blocks.get(this.bound(-Infinity));
          });
          file.fileSize = lastBlock.data.length - lastBlock.offset;
        }

        return result;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  xUnlock(fileId: number, flags: number) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    return this.handleAsync(async () => {
      log(`xUnlock ${file.path} ${flags}`);

      const filePendingWrites = this.pendingWrites.get(fileId);

      if (filePendingWrites && filePendingWrites.size > 0) {
        console.time("writing bulk");

        // void db.run("readwrite", async ({ blocks }) => {
        //   for (const block of filePendingWrites.values()) {
        //     await blocks.put(block);
        //   }
        // });
        // await db.sync();

        const idb = await db.dbReady;

        await new Promise<void>((resolve, reject) => {
          // @ts-expect-error lib dom misses third argument
          const tx = idb.transaction("blocks", "readwrite", {
            durability: "relaxed",
          });

          const blocksStore = tx.objectStore("blocks");

          for (const v of filePendingWrites.values()) {
            blocksStore.put(v);
          }

          tx.addEventListener("complete", () => {
            resolve();
          });
          tx.addEventListener("abort", reject);
          tx.addEventListener("error", reject);
        });

        console.timeEnd("writing bulk");
      }

      this.pendingWrites.delete(fileId);

      try {
        await this.webLocks.unlock(file.path, flags);

        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  xSectorSize(fileId: number) {
    log("xSectorSize");
    return 512;
  }

  xDeviceCharacteristics(fileId: number) {
    log("xDeviceCharacteristics");
    return (
      VFS.SQLITE_IOCAP_SAFE_APPEND |
      VFS.SQLITE_IOCAP_SEQUENTIAL |
      VFS.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN
    );
  }

  xAccess(
    name: string,
    flags: number,
    pResOut: {
      set: (arg0: number) => void;
    }
  ) {
    pResOut.set(0);
    return VFS.SQLITE_OK;
  }

  xDelete(name: string, syncDir: number) {
    const { db } = this.getFileStateByPathOrThrow(name);

    return this.handleAsync(async () => {
      const path = new URL(name, "file://localhost/").pathname;
      log(`xDelete ${path} ${syncDir}`);

      try {
        const complete = db.run("readwrite", ({ blocks }) => {
          return blocks.delete(this.bound(-Infinity));
        });
        if (syncDir) await complete;
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  txFileControl(fileId: number, op: number) {
    console.debug("xFileControl", fileId, op);

    return VFS.SQLITE_NOTFOUND;
  }

  private bound(begin: number, end = Infinity) {
    return IDBKeyRange.bound(begin, end);
  }

  private getFileStateByPathOrThrow(path: string) {
    const dbName = path.replace(/-journal$/, "").replace(/-wal$/, "");
    const fileId = this.dbNameFileIdMap.get(dbName);

    if (!fileId) {
      throw new Error(`Failed to find db state for path: ${path}`);
    }

    return this.getFileStateByIdOrThrow(fileId);
  }

  private getFileStateByIdOrThrow(fileId: number) {
    const state = this.filesState.get(fileId);

    if (!state) throw new Error("File not found");

    return state;
  }
}

function openDatabase(idbDatabaseName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = globalThis.indexedDB.open(`${idbDatabaseName}.sqlite`, 1);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore("blocks", {
        keyPath: "offset",
      });
    });
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
  });
}

// read(position) {
//   let waitCursor = () => {
//     return new Promise((resolve, reject) => {
//       if (this.cursorPromise != null) {
//         throw new Error(
//           'waitCursor() called but something else is already waiting'
//         );
//       }
//       this.cursorPromise = { resolve, reject };
//     });
//   };

//   if (this.cursor) {
//     let cursor = this.cursor;

//     if (
//       cursor.direction === 'next' &&
//       position > cursor.key &&
//       position < cursor.key + 100
//     ) {
//       perf.record('stream-next');

//       cursor.advance(position - cursor.key);
//       return waitCursor();
//     } else if (
//       cursor.direction === 'prev' &&
//       position < cursor.key &&
//       position > cursor.key - 100
//     ) {
//       perf.record('stream-next');

//       cursor.advance(cursor.key - position);
//       return waitCursor();
//     } else {
//       // Ditch the cursor
//       this.cursor = null;
//       return this.read(position);
//     }
//   } else {
//     // We don't already have a cursor. We need to a fresh read;
//     // should we open a cursor or call `get`?

//     let dir = this.getReadDirection();
//     if (dir) {
//       // Open a cursor
//       this.prevReads = null;

//       let keyRange;
//       if (dir === 'prev') {
//         keyRange = IDBKeyRange.upperBound(position);
//       } else {
//         keyRange = IDBKeyRange.lowerBound(position);
//       }

//       let req = this.store.openCursor(keyRange, dir);
//       perf.record('stream');

//       req.onsuccess = (e) => {
//         perf.endRecording('stream');
//         perf.endRecording('stream-next');

//         let cursor = e.target.result;
//         this.cursor = cursor;

//         if (this.cursorPromise == null) {
//           throw new Error('Got data from cursor but nothing is waiting it');
//         }
//         this.cursorPromise.resolve(cursor ? cursor.value : null);
//         this.cursorPromise = null;
//       };
//       req.onerror = (e) => {
//         console.log('Cursor failure:', e);

//         if (this.cursorPromise == null) {
//           throw new Error('Got data from cursor but nothing is waiting it');
//         }
//         this.cursorPromise.reject(e);
//         this.cursorPromise = null;
//       };

//       return waitCursor();
//     } else {
//       if (this.prevReads == null) {
//         this.prevReads = [0, 0, 0];
//       }
//       this.prevReads.push(position);
//       this.prevReads.shift();

//       return this.get(position);
//     }
//   }
// }
