import type { NeonQueryFunction } from "@neondatabase/serverless";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import config from "../drizzle.config";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

export const neonSql = neon(
  config.dbCredentials.url,
) satisfies NeonQueryFunction<boolean, boolean>;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
