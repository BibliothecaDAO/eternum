import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  generates: {
    "./src/gql/eternum/": {
      documents: ["src/lib/eternum/*.ts", "!src/gql/**/*"],
      preset: "client",
      schema: "https://api.cartridge.gg/x/eternum-prod/torii/graphql",
      config: {
        documentMode: "string",
      },
      presetConfig: {
        fragmentMasking: false,
      },
      plugins: [],
    },
    "./src/gql/snapshot/": {
      documents: ["src/lib/snapshot/*.ts", "!src/gql/**/*"],
      preset: "client",
      schema: "https://api.snapshot.box/",
      config: {
        documentMode: "string",
      },
      presetConfig: {
        fragmentMasking: false,
      },
      plugins: [],
    },
  },
};

export default config;
