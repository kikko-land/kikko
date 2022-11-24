// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { initSqliteBridge } from "@kikko-land/electron-better-sqlite3-backend/preload";

initSqliteBridge();
