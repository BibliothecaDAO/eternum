import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  introspect: {
    casing: "camel",
  },
} satisfies Config;
