import * as VFS from "wa-sqlite/src/VFS.js";

import { IDBContext } from "./IDBContext";
import { WebLocks } from "./WebLocks";

const SECTOR_SIZE = 512;

const blockSize = 32 * 1024;

type IOptions = {
  durability: "default" | "strict" | "relaxed";
  purge: "deferred" | "manual";
  purgeAtLeast: number;
};

const DEFAULT_OPTIONS: IOptions = {
  durability: "default",
  purge: "deferred",
  purgeAtLeast: 16,
} as const;

function log(...args: unknown[]) {
  // console.debug(...args);
}

interface IBlock {
  offset: number;
  data: Int8Array;
}

interface IZeroFileBlock extends IBlock {
  fileSize: number;
}

interface IOpenedFile {
  name: string;
  flags: number;
  block0?: IZeroFileBlock;
  overwrite?: boolean;
}

export class IDBAtomicVFS extends VFS.Base {
  private options: IOptions;

  private filesState = new Map<number, { file: IOpenedFile; db: IDBContext }>();
  private dbNameFileIdMap = new Map<string, number>();

  private webLocks = new WebLocks();

  private pendingPurges = new Set<string>();

  private blockToWrite = new Map<number, IBlock | IZeroFileBlock>();

  constructor(
    public name: string,
    options: Partial<IOptions> = DEFAULT_OPTIONS
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  xOpen(
    name: string,
    fileId: number,
    flags: number,
    pOutFlags: {
      set: (arg0: number) => void;
    }
  ) {
    console.warn("...opening", name);
    return this.handleAsync(async () => {
      this.dbNameFileIdMap.set(name, fileId);

      const db = new IDBContext(openDatabase(name), {
        durability: this.options.durability,
      });

      if (name === null) name = `null_${fileId}`;
      log(`xOpen ${name} 0x${fileId.toString(16)} 0x${flags.toString(16)}`);

      try {
        const file: IOpenedFile = {
          name,
          flags,
          block0: undefined,
        };
        this.filesState.set(fileId, {
          file,
          db,
        });

        // Read the first block, which also contains the file metadata.
        file.block0 = await db.run("readonly", ({ blocks }) =>
          blocks.get(this.#bound(0))
        );

        if (!file.block0) {
          // File doesn't exist, create if requested.
          if (flags & VFS.SQLITE_OPEN_CREATE) {
            file.block0 = {
              offset: 0,
              data: new Int8Array(0),
              fileSize: 0,
            };

            // Write metadata block to IndexedDB.
            await db.run("readwrite", ({ blocks }) =>
              blocks.put(file.block0, 0)
            );
            await db.sync();
          } else {
            throw new Error(`file not found: ${name}`);
          }
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
          const { file } = state;

          log(`xClose ${file.name}`);

          this.filesState.delete(fileId);
          if (file.flags & VFS.SQLITE_OPEN_DELETEONCLOSE) {
            // TODO: delete DB
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
    return this.handleAsync(async () => {
      const { file, db } = this.getFileStateByIdOrThrow(fileId);

      log(`xRead ${file.name} ${pData.value.length} ${iOffset}`);

      const fromCache = this.blockToWrite.get(-iOffset)?.data;

      if (fromCache && fromCache.length === pData.size) {
        pData.value.set(fromCache);

        return VFS.SQLITE_OK;
      }

      try {
        // Read as many blocks as necessary to satisfy the read request.
        // Usually a read fits within a single write but there is at least
        // one case - rollback after journal spill - where reads cross
        // write boundaries so we have to allow for that.
        const result = await db.run("readonly", async ({ blocks }) => {
          let pDataOffset = 0;
          while (pDataOffset < pData.value.length) {
            // console.log("read", pDataOffset);

            // Fetch the IndexedDB block for this file location.
            const fileOffset = iOffset + pDataOffset;

            if (!file.block0) throw new Error("Block0 not present");

            const block0 = file.block0;

            const block = await (async () => {
              if (fileOffset < block0.data.length) {
                return file.block0;
              } else {
                const res = await blocks.get(this.#bound(-fileOffset));
                return "data" in res
                  ? res
                  : {
                      data: res,
                      offset: -fileOffset,
                    };
              }
            })();

            if (!block || block.data.length - block.offset <= fileOffset) {
              pData.value.fill(0, pDataOffset);
              return VFS.SQLITE_IOERR_SHORT_READ;
            }

            const buffer = pData.value.subarray(pDataOffset);
            const blockOffset = fileOffset + block.offset;
            const nBytesToCopy = Math.min(
              Math.max(block.data.length - blockOffset, 0), // source bytes
              buffer.length
            ); // destination bytes
            buffer.set(
              block.data.subarray(blockOffset, blockOffset + nBytesToCopy)
            );

            pDataOffset += nBytesToCopy;
          }

          return VFS.SQLITE_OK;
        });
        return result;
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
    const { file } = this.getFileStateByIdOrThrow(fileId);

    log(`xWrite ${file.name} ${pData.value.length} ${iOffset}`);

    try {
      if (!file.block0) {
        throw new Error("block0 not present");
      }
      // Convert the write directly into an IndexedDB object. Our assumption
      // is that SQLite will only overwrite data with an xWrite of the same
      // offset and size unless the database page size changes, except when
      // changing database page size which is handled by #reblockIfNeeded().
      file.block0.fileSize = Math.max(
        file.block0.fileSize,
        iOffset + pData.value.length
      );
      const block: IBlock = (() => {
        if (iOffset === 0) {
          file.block0.data = pData.value.slice();

          return file.block0;
        }
        return {
          offset: -iOffset,
          data: pData.value.slice(),
        };
      })();

      this.blockToWrite.set(iOffset !== 0 ? -iOffset : 0, block);

      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xTruncate(fileId: number, iSize: number) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    if (!file) throw new Error("File not found");

    log(`xTruncate ${file.name} ${iSize}`);

    try {
      if (!file.block0) {
        throw new Error("block0 not present");
      }

      Object.assign(file.block0, {
        fileSize: iSize,
        data: file.block0.data.slice(0, iSize),
      });

      // Delete all blocks beyond the file size and update metadata.
      // This is never called within a transaction.
      const block0 = { ...file.block0 };
      void db.run("readwrite", async ({ blocks }) => {
        await blocks.delete(this.#bound(-Infinity, -iSize));
        await blocks.put(block0, 0);
      });
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xSync(fileId: number, flags: number) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    if (!file) throw new Error("File not found");

    log(`xSync ${file.name} ${flags}`);

    try {
      if (this.options.durability !== "relaxed") {
        return this.handleAsync(async () => {
          console.log("sync!");
          await db.sync();
          return VFS.SQLITE_OK;
        });
      }
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xFileSize(
    fileId: number,
    pSize64: {
      set: (arg0: number) => void;
    }
  ) {
    const { file } = this.getFileStateByIdOrThrow(fileId);

    log(`xFileSize ${file.name}`);

    if (!file.block0) {
      throw new Error("block0 not present");
    }

    pSize64.set(file.block0.fileSize);
    return VFS.SQLITE_OK;
  }

  xLock(fileId: number, flags: number) {
    return this.handleAsync(async () => {
      const { file, db } = this.getFileStateByIdOrThrow(fileId);

      if (!file) throw new Error("File not found");

      log(`xLock ${file.name} ${flags}`);

      try {
        // Acquire the lock.
        log("getting lock...");
        const result = await this.webLocks.lock(file.name, flags);
        log(result);
        if (result === VFS.SQLITE_OK && flags === VFS.SQLITE_LOCK_SHARED) {
          // Update block 0 in case another connection changed it.
          file.block0 = await db.run("readonly", ({ blocks }) =>
            blocks.get(this.#bound(0))
          );
        }
        return result;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  xUnlock(fileId: number, flags: number) {
    return this.handleAsync(async () => {
      const { file } = this.getFileStateByIdOrThrow(fileId);

      log(`xUnlock ${file.name} ${flags}`);

      try {
        return this.webLocks.unlock(file.name, flags);
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  xSectorSize(fileId: number) {
    log("xSectorSize");
    return SECTOR_SIZE;
  }

  xDeviceCharacteristics(fileId: number) {
    log("xDeviceCharacteristics");
    return (
      VFS.SQLITE_IOCAP_BATCH_ATOMIC |
      VFS.SQLITE_IOCAP_SAFE_APPEND |
      VFS.SQLITE_IOCAP_SEQUENTIAL |
      VFS.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN
    );
  }

  xFileControl(fileId: number, op: number) {
    const { file, db } = this.getFileStateByIdOrThrow(fileId);

    log(`xFileControl ${file.name} ${op}`);

    switch (op) {
      case 11: // SQLITE_FCNTL_OVERWRITE
        // This called on VACUUM. Set a flag so we know whether to check
        // later if the page size changed.
        file.overwrite = true;
        return VFS.SQLITE_OK;

      case 21: {
        // SQLITE_FCNTL_SYNC

        console.log(
          "writing blocks...",
          Array.from(this.blockToWrite.keys()).length
        );

        const toWriteBlocks = this.blockToWrite;
        this.blockToWrite = new Map();

        return this.handleAsync(async () => {
          console.time("blockToWrite");

          const idb = await db.dbReady;

          await new Promise<void>((resolve, reject) => {
            // @ts-expect-error lib dom misses third argument
            const tx = idb.transaction("blocks", "readwrite", {
              durability: "relaxed",
            });

            const blocksStore = tx.objectStore("blocks");

            for (const k of toWriteBlocks.keys()) {
              const toWrite = toWriteBlocks.get(k)!;

              blocksStore.put(
                toWrite.offset === 0 ? toWrite : toWrite.data,
                Math.ceil(toWrite.offset / blockSize)
              );
            }

            tx.addEventListener("complete", () => {
              resolve();
            });
            tx.addEventListener("abort", reject);
            tx.addEventListener("error", reject);
          });

          //           await db.run("readwrite", async ({ blocks }) => {
          //             // assuming toWriteBlocks is a Map...
          //             for (const k of toWriteBlocks.keys()) {
          //               const toWrite = toWriteBlocks.get(k)!;

          //               void blocks.put(
          //                 toWrite.offset === 0 ? toWrite : toWrite.data,
          //                 Math.ceil(toWrite.offset / blockSize)
          //               );
          //             }
          //             await db.sync();
          //           });

          // await db.run("readwrite", async ({ blocks }) => {
          //   await Promise.all(
          //     Array.from(this.blockToWrite.keys()).map(async (k) => {
          //       const toWrite = toWriteBlocks.get(k)!;

          //       await blocks.put(toWrite);
          //     })
          //   );
          // });

          console.timeEnd("blockToWrite");

          this.blockToWrite = new Map();

          // This is called at the end of each database transaction, whether
          // it is batch atomic or not. Handle page size changes here.
          if (file.overwrite) {
            // As an optimization we only check for and handle a page file
            // changes if we know a VACUUM has been done because handleAsync()
            // has to unwind and rewind the stack. We must be sure to follow
            // the same conditional path in both calls.
            try {
              return this.handleAsync(async () => {
                await this.#reblockIfNeeded(file, db);
                return VFS.SQLITE_OK;
              });
            } catch (e) {
              console.error(e);
              return VFS.SQLITE_IOERR;
            }
          }
          return VFS.SQLITE_OK;
        });
      }
      case 22: // SQLITE_FCNTL_COMMIT_PHASETWO
        // This is called after a commit is completed.
        file.overwrite = false;
        return VFS.SQLITE_OK;

      case 31: // SQLITE_FCNTL_BEGIN_ATOMIC_WRITE
        return VFS.SQLITE_OK;

      case 32: // SQLITE_FCNTL_COMMIT_ATOMIC_WRITE
        console.log("commit!!");
        try {
          if (!file.block0) throw new Error("block0 not present!");

          const block0 = { ...file.block0 };
          block0.data = block0.data.slice();

          void db.run("readwrite", async ({ blocks }) => {
            // Write block 0 to commit the new version.
            await blocks.put(block0, 0);
          });
          return VFS.SQLITE_OK;
        } catch (e) {
          console.error(e);
          return VFS.SQLITE_IOERR;
        }

      case 33: // SQLITE_FCNTL_ROLLBACK_ATOMIC_WRITE
        return this.handleAsync(async () => {
          try {
            this.blockToWrite = new Map();

            return VFS.SQLITE_OK;
          } catch (e) {
            console.error(e);
            return VFS.SQLITE_IOERR;
          }
        });

      default:
        return VFS.SQLITE_NOTFOUND;
    }
  }

  xAccess(
    name: string,
    flags: number,
    pResOut: {
      set: (arg0: number) => void;
    }
  ) {
    // const { db } = this.getFileStateByPathOrThrow(name);

    pResOut.set(0);
    return VFS.SQLITE_OK;

    // console.log("xAccess", name, { db });
    // return this.handleAsync(async () => {
    //   try {
    //     const path = new URL(name, "file://localhost/").pathname;
    //     log(`xAccess ${path} ${flags}`);

    //     // Check if block 0 exists.

    //     const key = await db.run("readonly", ({ blocks }) =>
    //       blocks.getKey(this.#bound({ path }, 0))
    //     );

    //     console.log(key ? 1 : 0);
    //     pResOut.set(key ? 1 : 0);
    //     return VFS.SQLITE_OK;
    //   } catch (e) {
    //     console.error(e);
    //     return VFS.SQLITE_IOERR;
    //   }
    // });
  }

  xDelete(name: string, syncDir: number) {
    const { db } = this.getFileStateByPathOrThrow(name);

    return this.handleAsync(async () => {
      const path = new URL(name, "file://localhost/").pathname;
      log(`xDelete ${path} ${syncDir}`);

      try {
        void db.run("readwrite", ({ blocks }) =>
          blocks.delete(IDBKeyRange.bound([path], [path, []]))
        );

        if (syncDir) {
          await db.sync();
        }
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  async purge(path: string) {
    // const start = Date.now();
    // await this.idb.run("readwrite", async ({ blocks }) => {
    //   const purgeBlock = await blocks.get([path, "purge", 0]);
    //   if (purgeBlock) {
    //     for (const [pageOffset, version] of purgeBlock.data) {
    //       blocks.delete(
    //         IDBKeyRange.bound(
    //           [path, pageOffset, version],
    //           [path, pageOffset, Infinity],
    //           true,
    //           false
    //         )
    //       );
    //     }
    //     await blocks.delete([path, "purge", 0]);
    //   }
    //   log(
    //     `purge ${path} ${purgeBlock?.data.size ?? 0} pages in ${
    //       Date.now() - start
    //     } ms`
    //   );
    // });
  }

  #maybePurge(path: string, nPages: number) {
    if (
      this.options.purge === "manual" ||
      this.pendingPurges.has(path) ||
      nPages < this.options.purgeAtLeast
    ) {
      // No purge needed.
      return;
    }

    if (globalThis.requestIdleCallback) {
      globalThis.requestIdleCallback(() => {
        void this.purge(path);
        this.pendingPurges.delete(path);
      });
    } else {
      setTimeout(() => {
        void this.purge(path);
        this.pendingPurges.delete(path);
      });
    }
    this.pendingPurges.add(path);
  }

  #bound(begin: number, end = 0) {
    return IDBKeyRange.bound(Math.ceil(begin / blockSize), end);
  }

  // The database page size can be changed with PRAGMA page_size and VACUUM.
  // The updated file will be overwritten with a regular transaction using
  // the old page size. After that it will be read and written using the
  // new page size, so the IndexedDB objects must be combined or split
  // appropriately.
  async #reblockIfNeeded(file: IOpenedFile, db: IDBContext) {
    // if (!file.block0) throw new Error("Block0 not present");
    // const oldPageSize = file.block0.data.length;
    // if (oldPageSize < 18) return; // no page size defined
    // const view = new DataView(
    //   file.block0.data.buffer,
    //   file.block0.data.byteOffset
    // );
    // let newPageSize = view.getUint16(16);
    // if (newPageSize === 1) newPageSize = 65536;
    // if (newPageSize === oldPageSize) return; // no page size change
    // const maxPageSize = Math.max(oldPageSize, newPageSize);
    // const nOldPages = maxPageSize / oldPageSize;
    // const nNewPages = maxPageSize / newPageSize;
    // const newPageCount = view.getUint32(28);
    // const fileSize = newPageCount * newPageSize;
    // await db.run("readwrite", async ({ blocks }) => {
    //   // When the block size changes, the entire file is rewritten. Delete
    //   // all blocks older than block 0 to leave a single version at every
    //   // offset.
    //   const keys = await blocks
    //     .index("version")
    //     .getAllKeys(
    //       IDBKeyRange.bound([file.path, version + 1], [file.path, Infinity])
    //     );
    //   for (const key of keys) {
    //     void blocks.delete(key);
    //   }
    //   await blocks.delete([file.path, "purge", 0]);
    //   // Do the conversion in chunks of the larger of the page sizes.
    //   for (let iOffset = 0; iOffset < fileSize; iOffset += maxPageSize) {
    //     // Fetch nOldPages. They can be fetched in one request because
    //     // there is now a single version in the file.
    //     const oldPages = await blocks.getAll(
    //       IDBKeyRange.lowerBound([
    //         file.path,
    //         -(iOffset + maxPageSize),
    //         Infinity,
    //       ]),
    //       nOldPages
    //     );
    //     for (const oldPage of oldPages) {
    //       void blocks.delete([oldPage.path, oldPage.offset, oldPage.version]);
    //     }
    //     // Convert to new pages.
    //     if (nNewPages === 1) {
    //       // Combine nOldPages old pages into a new page.
    //       const buffer = new Int8Array(newPageSize);
    //       for (const oldPage of oldPages) {
    //         buffer.set(oldPage.data, -(iOffset + oldPage.offset));
    //       }
    //       const newPage = {
    //         path: file.path,
    //         offset: -iOffset,
    //         version,
    //         data: buffer,
    //       };
    //       if (newPage.offset === 0) {
    //         file.block0 = { ...newPage, fileSize };
    //       }
    //       await blocks.put(newPage);
    //     } else {
    //       // Split an old page into nNewPages new pages.
    //       const oldPage = oldPages[0];
    //       for (let i = 0; i < nNewPages; ++i) {
    //         const offset = -(iOffset + i * newPageSize);
    //         if (-offset >= fileSize) break;
    //         const newPage = {
    //           path: oldPage.path,
    //           offset,
    //           version,
    //           data: oldPage.data.subarray(
    //             i * newPageSize,
    //             (i + 1) * newPageSize
    //           ),
    //         };
    //         if (newPage.offset === 0) {
    //           file.block0 = { ...newPage, fileSize };
    //         }
    //         await blocks.put(newPage);
    //       }
    //     }
    //   }
    // });
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
    const request = globalThis.indexedDB.open(idbDatabaseName, 5);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore("blocks");
    });
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
  });
}
