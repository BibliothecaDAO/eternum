import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import config from "../drizzle.config";
import * as schema from "./schema";

const pool = new Pool({ connectionString: config.dbCredentials.url });
export const db = drizzle(pool, { schema: { ...schema } });

export type Database = NodePgDatabase<typeof schema>;
