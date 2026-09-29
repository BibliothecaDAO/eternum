import { fileURLToPath } from "node:url";

export default {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // The portal refuses to start without its environment; tests name theirs here.
    env: {
      VITE_PUBLIC_CHAIN: "mainnet",
      VITE_PUBLIC_SLOT: "test",
      VITE_BASE_URL: "https://realms.test",
      VITE_PUBLIC_IDENTITY_RPC_URL: "https://identity-rpc.realms.test",
      VITE_ALCHEMY_API_KEY: "test",
    },
    environment: "node",
  },
};
