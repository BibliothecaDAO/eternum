import { drizzle } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import config from "../drizzle.config";

import type { NeonQueryFunction } from "@neondatabase/serverless";
import { neon, neonConfig } from "@neondatabase/serverless";

import * as schema from "./schema";
import { env } from "../env";

if (!env.VERCEL_ENV) {
  neonConfig.wsProxy = (/*host*/) => `127.0.0.1/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

export const neonSql = neon(
  config.dbCredentials.url
) satisfies NeonQueryFunction<boolean, boolean>;

export const db = drizzle(neonSql, { schema });

export type Database = NodePgDatabase<typeof schema>;
