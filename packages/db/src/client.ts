import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";
import { env } from "../env";

const connectionString = env.DATABASE_URL 

const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

export type Database = NodePgDatabase<typeof schema>;