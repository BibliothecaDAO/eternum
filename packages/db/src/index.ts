// Centralized exports to reduce file handle usage
export { db } from "./client";
export type { Database } from "./client";

// Export commonly used schema items directly
export { user, session, account, verification } from "./schema/auth";
export {
  realmsBridgeRequests,
  realmsBridgeEvents,
  realmsLordsClaims,
  bridgeEventTypeEnum,
} from "./schema/bridge";
export {
  governances,
  delegates,
  delegateProfiles,
  CreateDelegateProfileSchema,
} from "./schema/governance";
export { velords_burns, velords_supply } from "./schema/dune";

// Export commonly used query builders
export { eq, and, or, desc, asc, like, sql, gt, lt } from "drizzle-orm";
export type { SQL, AnyColumn } from "drizzle-orm";
