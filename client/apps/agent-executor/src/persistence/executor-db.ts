import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@bibliothecadao/agent-runtime";

let pool: any = null;
let database: ReturnType<typeof drizzle> | null = null;

export function getExecutorDb(connectionString: string) {
  if (!database) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT ?? 30_000),
    });
    database = drizzle({
      client: pool,
      schema,
    });
  }

  return database;
}
