import type { NeonQueryFunction } from "@neondatabase/serverless";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import config from "../drizzle.config";
// Import only the specific schema tables that are actually used
import {
  bridgeEventTypeEnum,
  realmsBridgeEvents,
  realmsBridgeEventsRelations,
  realmsBridgeRequests,
  realmsBridgeRequestsRelations,
  realmsLordsClaims,
} from "./schema/bridge";
import { starknetRealmMetadata, starknetRealmOwnership, starknetRealmOwnershipStatus } from "./schema/realm-ownership";

neonConfig.webSocketConstructor = ws;

export const neonSql = neon(config.dbCredentials.url) satisfies NeonQueryFunction<boolean, boolean>;

// Optimize pool configuration for Vercel
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Limit max connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Connection timeout
});

// Create schema object with only the tables we actually use
const schema = {
  realmsBridgeRequests,
  realmsBridgeEvents,
  realmsLordsClaims,
  bridgeEventTypeEnum,
  starknetRealmOwnership,
  starknetRealmMetadata,
  starknetRealmOwnershipStatus,
  // Include relations
  realmsBridgeRequestsRelations,
  realmsBridgeEventsRelations,
};

export const db = drizzle(pool, { schema });
