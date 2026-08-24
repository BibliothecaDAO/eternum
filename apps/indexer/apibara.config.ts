import { defineConfig } from "apibara/config";
import esbuild from "rollup-plugin-esbuild";

import { getStarknetStreamUrl } from "./streams";

export default defineConfig({
  runtimeConfig: {
    streamUrl: getStarknetStreamUrl("mainnet"),
    contractAddress:
      "0x028d709c875c0ceac3dce7065bec5328186dc89fe254527084d1689910954b0a",
  },
  exportConditions: ["node"],
  rolldownConfig: {
    plugins: [esbuild()],
  },
});
