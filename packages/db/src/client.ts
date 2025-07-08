import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import config from "../drizzle.config";
import { env } from "../env";

// Import only the specific schema tables that are actually used
import { user, session, account, verification } from "./schema/auth";
import { 
  realmsBridgeRequests, 
  realmsBridgeEvents, 
  realmsLordsClaims,
  bridgeEventTypeEnum,
  realmsBridgeRequestsRelations,
  realmsBridgeEventsRelations
} from "./schema/bridge";
import { 
  governances, 
  delegates, 
  delegateProfiles,
  delegatesRelations,
  delegateProfilesRelations
} from "./schema/governance";
import { velords_burns, velords_supply } from "./schema/dune";

// Vercel-specific optimizations
if (env.VERCEL_ENV) {
  // Optimize for serverless environment
  neonConfig.poolQueryViaFetch = true;
} else {
  neonConfig.wsProxy = (/*host*/) => `127.0.0.1/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

// Create schema object with only the tables we actually use
const schema = {
  user,
  session,
  account,
  verification,
  realmsBridgeRequests,
  realmsBridgeEvents,
  realmsLordsClaims,
  bridgeEventTypeEnum,
  governances,
  delegates,
  delegateProfiles,
  velords_burns,
  velords_supply,
  // Include relations
  realmsBridgeRequestsRelations,
  realmsBridgeEventsRelations,
  delegatesRelations,
  delegateProfilesRelations,
};

// Lazy singleton pattern for database connection
let _db: ReturnType<typeof drizzle> | null = null;
let _isInitializing = false;

function getDbInstance(): ReturnType<typeof drizzle> {
  if (!_db && !_isInitializing) {
    _isInitializing = true;
    
    try {
      const neonSql = neon(
        config.dbCredentials.url,
      ) satisfies NeonQueryFunction<boolean, boolean>;
      
      _db = drizzle(neonSql, { schema });
    } catch (error) {
      _isInitializing = false;
      throw error;
    }
    
    _isInitializing = false;
  }
  
  if (!_db) {
    throw new Error("Database connection failed to initialize");
  }
  
  return _db;
}

// Export the database instance - this will be initialized when first accessed
export const db = getDbInstance();
export const getDb = getDbInstance;

export type Database = NodePgDatabase<typeof schema>;
