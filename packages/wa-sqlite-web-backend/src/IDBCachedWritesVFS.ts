import * as VFS from "wa-sqlite/src/VFS.js";

import { IDBContext } from "./IDBContext.js";
import { WebLocks } from "./WebLocks.js";

function log(...args: unknown[]) {
  // console.debug(...args);
}

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

  xRead(
    fileId: number,
    pData: {
      size: number;
      value: Int8Array;
    },
    iOffset: number
  ) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    const filePendingWrites = this.pendingWrites.get(fileId);
    const block = filePendingWrites?.get(iOffset);

    if (block) {
      pData.value.set(block.data);

      return VFS.SQLITE_OK;
    }

    return this.handleAsync(async () => {
      log(`xRead ${file.path} ${pData.value.length} ${iOffset}`);

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

      return this.handleAsync(async () => {
        file.fileSize = Math.max(file.fileSize, iOffset + pData.value.length);

        await db.run("readwrite", ({ blocks }) => blocks.put(block));

        return VFS.SQLITE_OK;
      });
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
