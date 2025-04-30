import type { CodegenConfig } from "@graphql-codegen/cli";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: "./.env.local" }); //Change for production?

const config: CodegenConfig = {
  overwrite: true,
  schema: "https://api.cartridge.gg/x/eternum-sepolia-interim/torii" + "/graphql",
  documents: "src/**/*.tsx",
  ignoreNoDocuments: true,
  generates: {
    "src/hooks/gql/": {
      preset: "client",
      config: {
        documentMode: "string",
      },
    },
    "./schema.graphql": {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
};

export default config;
