import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "https://api.snapshot.box/",
  documents: ["app/**/*.ts", "!app/gql/**/*"],
  generates: {
    "./app/gql/": {
      preset: "client",
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
