import type { Config } from "drizzle-kit";

import { env } from "./env";

export default {
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  tablesFilter: ["!herald_*"],
  dbCredentials: {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL !== "false",
  },
} satisfies Config;
