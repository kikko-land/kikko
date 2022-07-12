import * as VFS from "wa-sqlite/src/VFS.js";

const WEB_LOCKS =
  // @ts-ignore
  navigator["locks"] ??
  console.warn("concurrency is unsafe without Web Locks API");

export class WebLocks {
  private mapIdToState = new Map<string, number>();
  private mapNameToReleaser = new Map<
    string,
    (value: void | PromiseLike<void>) => void
  >();

  // Use a single exclusive lock.

  async lock(name: string, flags: number) {
    const lockState = this.mapIdToState.get(name) ?? VFS.SQLITE_LOCK_NONE;
    if (lockState === VFS.SQLITE_LOCK_NONE) {
      await this.acquireWebLock(name, "exclusive");
    }
    this.mapIdToState.set(name, flags);
    return VFS.SQLITE_OK;
  }

  async unlock(name: string, flags: number) {
    if (flags === VFS.SQLITE_LOCK_NONE) {
      this.releaseWebLock(name);
      this.mapIdToState.delete(name);
    } else {
      this.mapIdToState.set(name, flags);
    }
    return VFS.SQLITE_OK;
  }

  private async acquireWebLock(
    name: string,
    mode: LockMode,
    signal?: AbortSignal
  ) {
    if (WEB_LOCKS) {
      const lockName = `sqlite-${name}`;
      // eslint-disable-next-line promise/param-names, no-async-promise-executor
      return new Promise<void>(async (hasLock, aborted) => {
        try {
          await WEB_LOCKS.request(
            lockName,
            { mode, signal },
            () =>
              // eslint-disable-next-line promise/param-names
              new Promise<void>((release) => {
                this.mapNameToReleaser.set(name, release);
                hasLock();
              })
          );
        } catch (e) {
          aborted(e);
        }
      });
    }
  }

  private releaseWebLock(name: string) {
    this.mapNameToReleaser.get(name)?.();
    this.mapNameToReleaser.delete(name);
  }
}
