/// <reference types="react-scripts" />

declare module "*.wasm" {
  const url: string;

  export default url;
}
