import { defineConfig } from "apibara/config";
import typescript from "@rollup/plugin-typescript";

export default defineConfig({
  runtimeConfig: {
    streamUrl: "https://starknet.preview.apibara.org",
    contractAddress: "0x028d709c875c0ceac3dce7065bec5328186dc89fe254527084d1689910954b0a",
  },
  rollupConfig: {
    plugins: [typescript()],
  },
});