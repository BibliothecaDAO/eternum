import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT ?? 30_000),
    });
  }
  return pool;
};

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!dbInstance) {
      dbInstance = drizzle({
        client: getPool(),
        schema,
      });
    }
    return dbInstance[prop as keyof typeof dbInstance];
  },
});

export { schema };
