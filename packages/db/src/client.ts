import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

const connectionString = "postgresql://RedBeardEth:Vrgeq6jXUW2I@ep-frosty-sea-90384545-pooler.us-east-2.aws.neon.tech/sepolia?sslmode=require"; //TODO env

const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

export type Database = NodePgDatabase<typeof schema>;