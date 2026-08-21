import { fileURLToPath } from "node:url";

export default {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    env: {
      CI: "true",
    },
    environment: "node",
  },
};
