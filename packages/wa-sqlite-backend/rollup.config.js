import typescript from "rollup-plugin-typescript2";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

function getConfig(entry, filename) {
  return {
    input: entry,
    output: {
      dir: "dist",
    },
    external: [
      "wa-sqlite",
      "wa-sqlite/src/VFS.js",
      "wa-sqlite/dist/wa-sqlite-async.mjs",
      "@kikko-land/kikko",
    ],
    plugins: [
      nodeResolve(),
      typescript({}),
      commonjs({
        include: /node_modules/,
        requireReturnsDefault: "auto", // <---- this solves default issue
      }),
    ],
  };
}

export default [getConfig("src/index.ts", "index.js")];
