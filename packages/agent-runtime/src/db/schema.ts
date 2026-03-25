import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import {
  DISPLAY_NAME_MAX_LENGTH,
  ENTITY_ID_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  PLAYER_ID_MAX_LENGTH,
} from "@bibliothecadao/types";

type AgentRuntimeConfigShape = Record<string, unknown>;
type SteeringJobConfigShape = Record<string, unknown>;
type AgentWorldSubscriptionShape = Record<string, unknown>;
type AgentEventPayloadShape = Record<string, unknown>;
type AgentWorldChatMetadataShape = Record<string, unknown>;

export const agents = pgTable(
  "agents",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    kind: varchar("kind", { length: 16 }).notNull(),
    ownerType: varchar("owner_type", { length: 32 }).notNull(),
    ownerId: varchar("owner_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    worldId: varchar("world_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    displayName: varchar("display_name", { length: DISPLAY_NAME_MAX_LENGTH }).notNull(),
    desiredState: varchar("desired_state", { length: 16 }).notNull(),
    executionState: varchar("execution_state", { length: 32 }).notNull(),
    runtimeConfigJson: jsonb("runtime_config_json").$type<AgentRuntimeConfigShape>().notNull().default({}),
    subscriptionJson: jsonb("subscription_json").$type<AgentWorldSubscriptionShape[]>().notNull().default([]),
    modelProvider: varchar("model_provider", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    modelId: varchar("model_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    authMode: varchar("auth_mode", { length: 32 }).notNull(),
    accountAddress: varchar("account_address", { length: 68 }),
    activeSessionId: varchar("active_session_id", { length: ENTITY_ID_MAX_LENGTH }),
    setupStatus: varchar("setup_status", { length: 16 }).notNull().default("none"),
    setupAuthUrl: text("setup_auth_url"),
    setupExpiresAt: timestamp("setup_expires_at", { withTimezone: true }),
    setupErrorMessage: varchar("setup_error_message", { length: MESSAGE_MAX_LENGTH }),
    autonomyEnabled: boolean("autonomy_enabled").notNull().default(false),
    autonomyMatchId: varchar("autonomy_match_id", { length: ENTITY_ID_MAX_LENGTH }),
    autonomyEnabledAt: timestamp("autonomy_enabled_at", { withTimezone: true }),
    autonomyDisabledAt: timestamp("autonomy_disabled_at", { withTimezone: true }),
    steeringJobType: varchar("steering_job_type", { length: 32 }),
    steeringJobStatus: varchar("steering_job_status", { length: 32 }),
    steeringJobLabel: varchar("steering_job_label", { length: DISPLAY_NAME_MAX_LENGTH }),
    steeringJobSummary: varchar("steering_job_summary", { length: MESSAGE_MAX_LENGTH }),
    steeringJobConfigJson: jsonb("steering_job_config_json").$type<SteeringJobConfigShape>().notNull().default({}),
    steeringStartedAt: timestamp("steering_started_at", { withTimezone: true }),
    steeringUpdatedAt: timestamp("steering_updated_at", { withTimezone: true }),
    steeringEndedAt: timestamp("steering_ended_at", { withTimezone: true }),
    currentSnapshotVersion: integer("current_snapshot_version"),
    nextWakeAt: timestamp("next_wake_at", { withTimezone: true }),
    lastRunStartedAt: timestamp("last_run_started_at", { withTimezone: true }),
    lastRunFinishedAt: timestamp("last_run_finished_at", { withTimezone: true }),
    lastErrorCode: varchar("last_error_code", { length: ENTITY_ID_MAX_LENGTH }),
    lastErrorMessage: varchar("last_error_message", { length: MESSAGE_MAX_LENGTH }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerWorldUniqueIndex: uniqueIndex("agents_owner_world_unique_idx").on(
      table.kind,
      table.ownerType,
      table.ownerId,
      table.worldId,
      table.displayName,
    ),
    worldExecutionIndex: index("agents_world_execution_idx").on(table.worldId, table.executionState),
  }),
);

export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    agentId: varchar("agent_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    sessionRef: varchar("session_ref", { length: ENTITY_ID_MAX_LENGTH }),
    callbackStateHash: varchar("callback_state_hash", { length: ENTITY_ID_MAX_LENGTH }),
    redirectUri: text("redirect_uri"),
    policyFingerprint: varchar("policy_fingerprint", { length: ENTITY_ID_MAX_LENGTH }),
    sessionAccountAddress: varchar("session_account_address", { length: 68 }),
    cartridgeUsername: varchar("cartridge_username", { length: DISPLAY_NAME_MAX_LENGTH }),
    encryptedSignerJson: jsonb("encrypted_signer_json").$type<Record<string, unknown>>(),
    encryptedSessionJson: jsonb("encrypted_session_json").$type<Record<string, unknown>>(),
    keyVersion: varchar("key_version", { length: 32 }),
    callbackReceivedAt: timestamp("callback_received_at", { withTimezone: true }),
    authUrl: text("auth_url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    invalidationReason: varchar("invalidation_reason", { length: MESSAGE_MAX_LENGTH }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    errorMessage: varchar("error_message", { length: MESSAGE_MAX_LENGTH }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentSessionAgentIndex: index("agent_sessions_agent_idx").on(table.agentId),
  }),
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    agentId: varchar("agent_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    leaseId: varchar("lease_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    wakeReason: varchar("wake_reason", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    snapshotVersion: integer("snapshot_version"),
    toolCalls: integer("tool_calls").notNull().default(0),
    mutatingActions: integer("mutating_actions").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: ENTITY_ID_MAX_LENGTH }),
    errorMessage: varchar("error_message", { length: MESSAGE_MAX_LENGTH }),
  },
  (table) => ({
    agentRunsAgentIndex: index("agent_runs_agent_idx").on(table.agentId, table.startedAt),
    agentRunsLeaseUniqueIndex: uniqueIndex("agent_runs_lease_unique_idx").on(table.leaseId),
  }),
);

export const agentEvents = pgTable(
  "agent_events",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    agentId: varchar("agent_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    seq: integer("seq").notNull(),
    type: varchar("type", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    payloadJson: jsonb("payload_json").$type<AgentEventPayloadShape>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentEventsAgentSeqIndex: uniqueIndex("agent_events_agent_seq_unique_idx").on(table.agentId, table.seq),
    agentEventsCreatedIndex: index("agent_events_agent_created_idx").on(table.agentId, table.createdAt),
  }),
);

export const agentThreads = pgTable(
  "agent_threads",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    agentId: varchar("agent_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    ownerId: varchar("owner_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentThreadsAgentOwnerUniqueIndex: uniqueIndex("agent_threads_agent_owner_unique_idx").on(
      table.agentId,
      table.ownerId,
    ),
  }),
);

export const agentThreadMessages = pgTable(
  "agent_thread_messages",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    threadId: varchar("thread_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    senderType: varchar("sender_type", { length: 16 }).notNull(),
    senderId: varchar("sender_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    content: varchar("content", { length: MESSAGE_MAX_LENGTH }).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentThreadMessagesThreadIndex: index("agent_thread_messages_thread_idx").on(table.threadId, table.createdAt),
  }),
);

export const worldSnapshots = pgTable(
  "world_snapshots",
  {
    worldId: varchar("world_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    version: integer("version").notNull(),
    snapshotKey: text("snapshot_key").notNull(),
    snapshotSummaryJson: jsonb("snapshot_summary_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    worldSnapshotsUniqueIndex: uniqueIndex("world_snapshots_world_version_unique_idx").on(table.worldId, table.version),
  }),
);

export const worldEvents = pgTable(
  "world_events",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    worldId: varchar("world_id", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    snapshotVersion: integer("snapshot_version"),
    type: varchar("type", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    subjectId: varchar("subject_id", { length: ENTITY_ID_MAX_LENGTH }),
    zoneId: varchar("zone_id", { length: ENTITY_ID_MAX_LENGTH }),
    dedupeKey: varchar("dedupe_key", { length: ENTITY_ID_MAX_LENGTH }).notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    worldEventsDedupeUniqueIndex: uniqueIndex("world_events_dedupe_unique_idx").on(table.worldId, table.dedupeKey),
    worldEventsWorldCreatedIndex: index("world_events_world_created_idx").on(table.worldId, table.createdAt),
  }),
);

export const agentWorldChatRateLimits = pgTable("agent_world_chat_rate_limits", {
  agentId: varchar("agent_id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
  lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }),
  windowMessageCount: integer("window_message_count").notNull().default(0),
  metadataJson: jsonb("metadata_json").$type<AgentWorldChatMetadataShape | null>(),
});
