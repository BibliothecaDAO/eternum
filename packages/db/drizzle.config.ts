import type { Config } from "drizzle-kit";

import { env } from "./env";

export default {
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  // Herald and the launch service own their tables in the same database; drizzle must neither
  // drop them nor offer them as rename sources, or a non-interactive push stalls on a prompt.
  tablesFilter: ["!herald_*", "!launch_runs"],
  dbCredentials: {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL !== "false",
  },
} satisfies Config;
