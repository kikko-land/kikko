import * as VFS from "wa-sqlite/src/VFS.js";

import { IDBContext } from "./IDBContext.js";
import { WebLocks } from "./WebLocks.js";

const SECTOR_SIZE = 512;

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
  path: string;
  offset: number;
  version: number;
  data: Int8Array;
}

interface IZeroFileBlock extends IBlock {
  fileSize: number;
}

interface IOpenedFile {
  path: string;
  flags: number;
  block0?: IZeroFileBlock;
  changedPages?: Set<number>;
  overwrite?: boolean;
}

// This sample VFS stores optionally versioned writes to IndexedDB, which
// it uses with the SQLite xFileControl() batch atomic write feature.
export class IDBBatchAtomicVFS extends VFS.Base {
  private name: string;

  private options: IOptions;
  private mapIdToFile = new Map<number, IOpenedFile>();
  private idb: IDBContext;
  private webLocks = new WebLocks();
  private pendingPurges = new Set<string>();

  private blockToWrite = new Map<number, IBlock | IZeroFileBlock>();

  constructor(
    idbDatabaseName = "wa-sqlite",
    options: Partial<IOptions> = DEFAULT_OPTIONS
  ) {
    super();
    this.name = idbDatabaseName;
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.idb = new IDBContext(openDatabase(idbDatabaseName), {
      durability: this.options.durability,
    });
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
      log(`xOpen ${name} 0x${fileId.toString(16)} 0x${flags.toString(16)}`);

      try {
        // Filenames can be URLs, possibly with query parameters.
        const url = new URL(name, "http://localhost/");
        const file: IOpenedFile = {
          path: url.pathname,
          flags,
          block0: undefined,
        };
        this.mapIdToFile.set(fileId, file);

        // Read the first block, which also contains the file metadata.
        file.block0 = await this.idb.run("readonly", ({ blocks }) => {
          return blocks.get(this.#bound(file, 0));
        });

        if (!file.block0) {
          // File doesn't exist, create if requested.
          if (flags & VFS.SQLITE_OPEN_CREATE) {
            file.block0 = {
              path: file.path,
              offset: 0,
              version: 0,
              data: new Int8Array(0),
              fileSize: 0,
            };

            // Write metadata block to IndexedDB.
            this.idb.run("readwrite", ({ blocks }) => blocks.put(file.block0));
            await this.idb.sync();
          } else {
            throw new Error(`file not found: ${file.path}`);
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
        const file = this.mapIdToFile.get(fileId);
        if (file) {
          log(`xClose ${file.path}`);

          this.mapIdToFile.delete(fileId);
          if (file.flags & VFS.SQLITE_OPEN_DELETEONCLOSE) {
            this.idb.run("readwrite", async ({ blocks }) => {
              await blocks.delete(
                IDBKeyRange.bound([file.path], [file.path, []])
              );
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
    return this.handleAsync(async () => {
      const file = this.mapIdToFile.get(fileId);

      if (!file) throw new Error("File not found");

      log(`xRead ${file.path} ${pData.value.length} ${iOffset}`);

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
        const result = await this.idb.run("readonly", async ({ blocks }) => {
          let pDataOffset = 0;
          while (pDataOffset < pData.value.length) {
            // Fetch the IndexedDB block for this file location.
            const fileOffset = iOffset + pDataOffset;

            if (!file.block0) throw new Error("Block0 not present");

            const block =
              fileOffset < file.block0.data.length
                ? file.block0
                : await blocks.get(this.#bound(file, -fileOffset));

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
    const file = this.mapIdToFile.get(fileId);

    if (!file) throw new Error("File not found");

    log(`xWrite ${file.path} ${pData.value.length} ${iOffset}`);

    try {
      if (!file.block0) {
        throw new Error("block0 not present");
      }
      // Convert the write directly into an IndexedDB object. Our assumption
      // is that SQLite will only overwrite data with an xWrite of the same
      // offset and size unless the database page size changes, except when
      // changing database page size which is handled by #reblockIfNeeded().
      const prevFileSize = file.block0.fileSize;
      file.block0.fileSize = Math.max(
        file.block0.fileSize,
        iOffset + pData.value.length
      );
      const block: IBlock = (() => {
        if (iOffset === 0) {
          file.block0.data = pData.value.slice();

          return file.block0;
        } else {
          return {
            path: file.path,
            offset: -iOffset,
            version: file.block0.version,
            data: pData.value.slice(),
          };
        }
      })();

      if (file.changedPages) {
        // This write is part of a batch atomic write. All writes in the
        // batch have a new version, so update the changed list to allow
        // old versions to be eventually deleted.
        if (prevFileSize === file.block0.fileSize) {
          file.changedPages.add(-iOffset);
        }

        // Defer writing block 0 to IndexedDB until batch commit.
        if (iOffset !== 0) {
          // this.idb.run("readwrite", ({ blocks }) => blocks.put(block));
        }
      } else {
        // Not a batch atomic write so write through.
        // this.idb.run("readwrite", ({ blocks }) => blocks.put(block));
      }

      this.blockToWrite.set(iOffset !== 0 ? -iOffset : 0, block);

      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xTruncate(fileId: number, iSize: number) {
    const file = this.mapIdToFile.get(fileId);

    if (!file) throw new Error("File not found");

    log(`xTruncate ${file.path} ${iSize}`);

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
      const block0 = Object.assign({}, file.block0);
      this.idb.run("readwrite", async ({ blocks }) => {
        await blocks.delete(this.#bound(file, -Infinity, -iSize));
        await blocks.put(block0);
      });
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xSync(fileId: number, flags: number) {
    const file = this.mapIdToFile.get(fileId);

    if (!file) throw new Error("File not found");

    log(`xSync ${file.path} ${flags}`);

    try {
      if (this.options.durability !== "relaxed") {
        return this.handleAsync(async () => {
          await this.idb.sync();
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
    const file = this.mapIdToFile.get(fileId);

    if (!file) throw new Error("File not found");

    log(`xFileSize ${file.path}`);

    if (!file.block0) {
      throw new Error("block0 not present");
    }

    pSize64.set(file.block0.fileSize);
    return VFS.SQLITE_OK;
  }

  xLock(fileId: number, flags: number) {
    return this.handleAsync(async () => {
      const file = this.mapIdToFile.get(fileId);

      if (!file) throw new Error("File not found");

      log(`xLock ${file.path} ${flags}`);

      try {
        // Acquire the lock.
        log("getting lock...");
        const result = await this.webLocks.lock(file.path, flags);
        log(result);
        if (result === VFS.SQLITE_OK && flags === VFS.SQLITE_LOCK_SHARED) {
          // Update block 0 in case another connection changed it.
          file.block0 = await this.idb.run("readonly", ({ blocks }) => {
            return blocks.get(this.#bound(file, 0));
          });
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
      const file = this.mapIdToFile.get(fileId);

      if (!file) throw new Error("File not found");

      log(`xUnlock ${file.path} ${flags}`);

      try {
        return this.webLocks.unlock(file.path, flags);
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
    const file = this.mapIdToFile.get(fileId);

    if (!file) throw new Error("File not found");

    log(`xFileControl ${file.path} ${op}`);

    switch (op) {
      case 11: //SQLITE_FCNTL_OVERWRITE
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
        return this.handleAsync(async () => {
          console.time("blockToWrite");
          await Promise.all(
            Array.from(this.blockToWrite.keys()).map(async (k) => {
              await this.idb.run("readwrite", async ({ blocks }) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const block = this.blockToWrite.get(k)!;

                await blocks.put(block);
              });
            })
          );
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
                await this.#reblockIfNeeded(file);
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
        return this.handleAsync(async () => {
          try {
            if (!file.block0) {
              throw new Error("block0 not present");
            }

            // Prepare a new version for IndexedDB blocks.
            file.block0.version--;
            file.changedPages = new Set();

            // Clear blocks from abandoned transactions that would conflict
            // with the new transaction.

            await this.idb.run("readwrite", async ({ blocks }) => {
              if (!file.block0) {
                throw new Error("block0 not present");
              }

              const keys = await blocks
                .index("version")
                .getAllKeys(
                  IDBKeyRange.bound(
                    [file.path],
                    [file.path, file.block0.version]
                  )
                );
              for (const key of keys) {
                blocks.delete(key);
              }
            });

            return VFS.SQLITE_OK;
          } catch (e) {
            console.error(e);
            return VFS.SQLITE_IOERR;
          }
        });

      case 32: // SQLITE_FCNTL_COMMIT_ATOMIC_WRITE
        try {
          const block0 = Object.assign({}, file.block0);
          block0.data = block0.data.slice();

          if (!file.changedPages) {
            throw new Error("Files doesn't have changed pages");
          }

          const changedPages = file.changedPages;

          file.changedPages = undefined;

          this.idb.run("readwrite", async ({ blocks }) => {
            // Write block 0 to commit the new version.
            blocks.put(block0);

            // Blocks to purge are saved in a special IndexedDB object with
            // an "index" of "purge". Add pages changed by this transaction.
            const purgeBlock = (await blocks.get([file.path, "purge", 0])) ?? {
              path: file.path,
              offset: "purge",
              version: 0,
              data: new Map(),
              count: 0,
            };

            purgeBlock.count += changedPages.size;
            for (const pageIndex of changedPages) {
              purgeBlock.data.set(pageIndex, block0.version);
            }

            blocks.put(purgeBlock);
            this.#maybePurge(file.path, purgeBlock.count);
          });
          return VFS.SQLITE_OK;
        } catch (e) {
          console.error(e);
          return VFS.SQLITE_IOERR;
        }

      case 33: // SQLITE_FCNTL_ROLLBACK_ATOMIC_WRITE
        return this.handleAsync(async () => {
          try {
            // Restore original state. Objects for the abandoned version will
            // be left in IndexedDB to be removed by the next atomic write
            // transaction.
            file.changedPages = undefined;
            file.block0 = await this.idb.run("readonly", ({ blocks }) => {
              if (!file.block0) {
                throw new Error("block0 not present");
              }

              return blocks.get([file.path, 0, file.block0.version + 1]);
            });
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
    return this.handleAsync(async () => {
      try {
        const path = new URL(name, "file://localhost/").pathname;
        log(`xAccess ${path} ${flags}`);

        // Check if block 0 exists.

        const key = await this.idb.run("readonly", ({ blocks }) => {
          return blocks.getKey(this.#bound({ path }, 0));
        });

        pResOut.set(key ? 1 : 0);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  xDelete(name: string, syncDir: number) {
    return this.handleAsync(async () => {
      const path = new URL(name, "file://localhost/").pathname;
      log(`xDelete ${path} ${syncDir}`);

      try {
        this.idb.run("readwrite", ({ blocks }) => {
          return blocks.delete(IDBKeyRange.bound([path], [path, []]));
        });
        if (syncDir) {
          await this.idb.sync();
        }
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  async purge(path: string) {
    const start = Date.now();
    await this.idb.run("readwrite", async ({ blocks }) => {
      const purgeBlock = await blocks.get([path, "purge", 0]);
      if (purgeBlock) {
        for (const [pageOffset, version] of purgeBlock.data) {
          blocks.delete(
            IDBKeyRange.bound(
              [path, pageOffset, version],
              [path, pageOffset, Infinity],
              true,
              false
            )
          );
        }
        await blocks.delete([path, "purge", 0]);
      }
      log(
        `purge ${path} ${purgeBlock?.data.size ?? 0} pages in ${
          Date.now() - start
        } ms`
      );
    });
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
        this.purge(path);
        this.pendingPurges.delete(path);
      });
    } else {
      setTimeout(() => {
        this.purge(path);
        this.pendingPurges.delete(path);
      });
    }
    this.pendingPurges.add(path);
  }

  #bound(file: IOpenedFile | { path: string }, begin: number, end = 0) {
    // Fetch newest block 0. For other blocks, use block 0 version.
    const version = (() => {
      if (!("block0" in file)) return -Infinity;

      if (!begin || (file.block0 && -begin < file.block0.data.length)) {
        return -Infinity;
      }

      return file.block0?.version;
    })();

    return IDBKeyRange.bound(
      [file.path, begin, version],
      [file.path, end, Infinity]
    );
  }

  // The database page size can be changed with PRAGMA page_size and VACUUM.
  // The updated file will be overwritten with a regular transaction using
  // the old page size. After that it will be read and written using the
  // new page size, so the IndexedDB objects must be combined or split
  // appropriately.
  async #reblockIfNeeded(file: IOpenedFile) {
    if (!file.block0) throw new Error("Block0 not present");

    const oldPageSize = file.block0.data.length;
    if (oldPageSize < 18) return; // no page size defined

    const view = new DataView(
      file.block0.data.buffer,
      file.block0.data.byteOffset
    );
    let newPageSize = view.getUint16(16);
    if (newPageSize === 1) newPageSize = 65536;
    if (newPageSize === oldPageSize) return; // no page size change

    const maxPageSize = Math.max(oldPageSize, newPageSize);
    const nOldPages = maxPageSize / oldPageSize;
    const nNewPages = maxPageSize / newPageSize;

    const newPageCount = view.getUint32(28);
    const fileSize = newPageCount * newPageSize;

    const version = file.block0.version;
    await this.idb.run("readwrite", async ({ blocks }) => {
      // When the block size changes, the entire file is rewritten. Delete
      // all blocks older than block 0 to leave a single version at every
      // offset.
      const keys = await blocks
        .index("version")
        .getAllKeys(
          IDBKeyRange.bound([file.path, version + 1], [file.path, Infinity])
        );
      for (const key of keys) {
        blocks.delete(key);
      }
      blocks.delete([file.path, "purge", 0]);

      // Do the conversion in chunks of the larger of the page sizes.
      for (let iOffset = 0; iOffset < fileSize; iOffset += maxPageSize) {
        // Fetch nOldPages. They can be fetched in one request because
        // there is now a single version in the file.
        const oldPages = await blocks.getAll(
          IDBKeyRange.lowerBound([
            file.path,
            -(iOffset + maxPageSize),
            Infinity,
          ]),
          nOldPages
        );
        for (const oldPage of oldPages) {
          blocks.delete([oldPage.path, oldPage.offset, oldPage.version]);
        }

        // Convert to new pages.
        if (nNewPages === 1) {
          // Combine nOldPages old pages into a new page.
          const buffer = new Int8Array(newPageSize);
          for (const oldPage of oldPages) {
            buffer.set(oldPage.data, -(iOffset + oldPage.offset));
          }
          const newPage = {
            path: file.path,
            offset: -iOffset,
            version,
            data: buffer,
          };

          if (newPage.offset === 0) {
            file.block0 = { ...newPage, fileSize };
          }

          blocks.put(newPage);
        } else {
          // Split an old page into nNewPages new pages.
          const oldPage = oldPages[0];
          for (let i = 0; i < nNewPages; ++i) {
            const offset = -(iOffset + i * newPageSize);
            if (-offset >= fileSize) break;
            const newPage = {
              path: oldPage.path,
              offset,
              version,
              data: oldPage.data.subarray(
                i * newPageSize,
                (i + 1) * newPageSize
              ),
            };

            if (newPage.offset === 0) {
              file.block0 = { ...newPage, fileSize };
            }

            blocks.put(newPage);
          }
        }
      }
    });
  }
}

function openDatabase(idbDatabaseName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = globalThis.indexedDB.open(idbDatabaseName, 5);
    request.addEventListener("upgradeneeded", function () {
      const blocks = request.result.createObjectStore("blocks", {
        keyPath: ["path", "offset", "version"],
      });
      blocks.createIndex("version", ["path", "version"]);
    });
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
  });
}
