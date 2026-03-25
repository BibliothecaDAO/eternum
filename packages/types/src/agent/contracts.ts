import { z } from "zod";

import {
  DISPLAY_NAME_MAX_LENGTH,
  ENTITY_ID_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  entityIdSchema,
  messageContentSchema,
  metadataSchema,
  playerIdSchema,
  timestampSchema,
  zoneIdSchema,
} from "../chat/shared";

export const agentKindSchema = z.enum(["player", "npc"]);
export const agentDesiredStateSchema = z.enum(["running", "paused", "stopped"]);
export const agentExecutionStateSchema = z.enum([
  "creating",
  "waiting_auth",
  "idle",
  "queued",
  "running",
  "cooldown",
  "error",
  "stopped",
]);
export const agentWakeReasonSchema = z.enum([
  "user_prompt",
  "world_event",
  "chat_mention",
  "scheduled_tick",
  "retry",
  "auth_completed",
  "manual_resume",
]);

export const agentIdSchema = z.string().min(1).max(ENTITY_ID_MAX_LENGTH);
export const agentThreadIdSchema = z.string().min(1).max(ENTITY_ID_MAX_LENGTH);
export const agentEventTypeSchema = z.string().min(1).max(ENTITY_ID_MAX_LENGTH);
export const agentOwnerTypeSchema = z.enum(["player", "npc", "system"]);
export const agentMessageSenderTypeSchema = z.enum(["owner", "agent", "system"]);
export const agentCreateStatusSchema = z.enum(["ready", "pending_auth", "error"]);
export const myAgentLaunchStatusSchema = z.enum(["launching", "pending_auth", "ready", "error"]);
export const agentAuthModeSchema = z.enum(["player_session", "npc_managed"]);
export const agentSessionProviderSchema = z.enum(["cartridge", "managed"]);
export const agentSessionStatusSchema = z.enum(["pending", "approved", "expired", "revoked", "invalidated", "error"]);
export const agentRunStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);
export const agentSetupStatusSchema = z.enum(["none", "launching", "pending_auth", "ready", "error"]);
export const steeringJobTypeSchema = z.enum(["scout", "defend", "gather", "expand", "support", "custom"]);
export const steeringJobStatusSchema = z.enum(["none", "active", "paused", "blocked", "ended_with_match"]);
export const agentHistoryEntryKindSchema = z.enum(["run", "setup", "autonomy", "steering", "match", "error"]);

export const agentSetupStateSchema = z.object({
  status: agentSetupStatusSchema,
  authUrl: z.string().url().optional(),
  expiresAt: timestampSchema.optional(),
  errorMessage: z.string().max(MESSAGE_MAX_LENGTH).optional(),
});

export const agentAutonomyStateSchema = z.object({
  enabled: z.boolean(),
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  matchId: entityIdSchema.optional(),
  enabledAt: timestampSchema.optional(),
  disabledAt: timestampSchema.optional(),
});

export const steeringJobConfigSchema = z.object({
  objective: z.string().max(MESSAGE_MAX_LENGTH).optional(),
  aggressiveness: z.number().min(0).max(100).optional(),
  caution: z.number().min(0).max(100).optional(),
  metadata: metadataSchema.optional(),
});

export const steeringJobStateSchema = z.object({
  type: steeringJobTypeSchema,
  status: steeringJobStatusSchema,
  label: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  summary: z.string().min(1).max(MESSAGE_MAX_LENGTH),
  config: steeringJobConfigSchema.default({}),
  startedAt: timestampSchema.optional(),
  updatedAt: timestampSchema.optional(),
  endedAt: timestampSchema.optional(),
});

export const agentRuntimeConfigSchema = z.object({
  tickIntervalMs: z.number().int().positive().optional(),
  maxToolCalls: z.number().int().positive().optional(),
  maxMutatingActionGroups: z.number().int().positive().optional(),
  maxPublicMessagesPerWindow: z.number().int().positive().optional(),
  publicMessageWindowSeconds: z.number().int().positive().optional(),
  promptOnlyMode: z.boolean().optional(),
  metadata: metadataSchema.optional(),
});

export const agentWorldSubscriptionSchema = z.object({
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  zoneIds: z.array(zoneIdSchema).default([]),
  entityIds: z.array(entityIdSchema).default([]),
  eventTypes: z.array(z.string().min(1).max(ENTITY_ID_MAX_LENGTH)).default([]),
});

export const agentSummarySchema = z.object({
  id: agentIdSchema,
  kind: agentKindSchema,
  ownerType: agentOwnerTypeSchema,
  ownerId: playerIdSchema,
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  displayName: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  desiredState: agentDesiredStateSchema,
  executionState: agentExecutionStateSchema,
  modelProvider: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  modelId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  nextWakeAt: timestampSchema.optional(),
  lastRunFinishedAt: timestampSchema.optional(),
  lastErrorCode: z.string().min(1).max(ENTITY_ID_MAX_LENGTH).optional(),
  lastErrorMessage: z.string().max(MESSAGE_MAX_LENGTH).optional(),
});

export const agentSessionSummarySchema = z.object({
  id: entityIdSchema,
  provider: agentSessionProviderSchema,
  status: agentSessionStatusSchema,
  authUrl: z.string().url().optional(),
  expiresAt: timestampSchema.optional(),
  approvedAt: timestampSchema.optional(),
});

export const agentSessionDetailSchema = agentSessionSummarySchema.extend({
  cartridgeUsername: z.string().max(DISPLAY_NAME_MAX_LENGTH).optional(),
  sessionAccountAddress: z.string().optional(),
  invalidationReason: z.string().max(MESSAGE_MAX_LENGTH).optional(),
});

export const agentRunSummarySchema = z.object({
  id: entityIdSchema,
  agentId: agentIdSchema,
  leaseId: entityIdSchema,
  wakeReason: agentWakeReasonSchema,
  status: agentRunStatusSchema,
  snapshotVersion: z.number().int().nonnegative().optional(),
  toolCalls: z.number().int().nonnegative().default(0),
  mutatingActions: z.number().int().nonnegative().default(0),
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  estimatedCostUsd: z.number().nonnegative().default(0),
  startedAt: timestampSchema,
  finishedAt: timestampSchema.optional(),
  errorCode: z.string().min(1).max(ENTITY_ID_MAX_LENGTH).optional(),
  errorMessage: z.string().max(MESSAGE_MAX_LENGTH).optional(),
});

export const agentDetailSchema = agentSummarySchema.extend({
  authMode: agentAuthModeSchema,
  accountAddress: z.string().optional(),
  runtimeConfig: agentRuntimeConfigSchema.default({}),
  subscriptions: z.array(agentWorldSubscriptionSchema).default([]),
  session: agentSessionSummarySchema.optional(),
  latestRun: agentRunSummarySchema.optional(),
});

export const myAgentSummarySchema = agentSummarySchema.extend({
  setup: agentSetupStateSchema.default({ status: "none" }),
  autonomy: agentAutonomyStateSchema,
  activeSteeringJob: steeringJobStateSchema.optional(),
});

export const myAgentDetailSchema = agentDetailSchema.extend({
  setup: agentSetupStateSchema.default({ status: "none" }),
  autonomy: agentAutonomyStateSchema,
  activeSteeringJob: steeringJobStateSchema.optional(),
  activeSession: agentSessionDetailSchema.optional(),
  history: z.array(agentRunSummarySchema).default([]),
  recentEvents: z.array(z.lazy(() => agentEventSchema)).default([]),
});

export const agentEventSchema = z.object({
  id: entityIdSchema,
  agentId: agentIdSchema,
  seq: z.number().int().nonnegative(),
  type: agentEventTypeSchema,
  payload: metadataSchema.default({}),
  createdAt: timestampSchema,
});

export const agentSetupChangedEventPayloadSchema = z.object({
  status: agentSetupStatusSchema,
  authUrl: z.string().url().optional(),
  expiresAt: timestampSchema.optional(),
  errorMessage: z.string().max(MESSAGE_MAX_LENGTH).optional(),
});

export const agentAutonomyChangedEventPayloadSchema = z.object({
  worldId: entityIdSchema,
  enabled: z.boolean(),
  matchId: entityIdSchema.optional(),
  steeringJobType: steeringJobTypeSchema.optional(),
});

export const agentSteeringChangedEventPayloadSchema = z.object({
  worldId: entityIdSchema,
  steeringJobType: steeringJobTypeSchema,
  summary: z.string().max(MESSAGE_MAX_LENGTH),
});

export const agentMatchEndedEventPayloadSchema = z.object({
  worldId: entityIdSchema,
  matchId: entityIdSchema.optional(),
  summary: z.string().max(MESSAGE_MAX_LENGTH),
});

export const agentHistoryEntrySchema = z.object({
  id: entityIdSchema,
  kind: agentHistoryEntryKindSchema,
  title: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  summary: z.string().min(1).max(MESSAGE_MAX_LENGTH),
  createdAt: timestampSchema,
  status: z.string().max(ENTITY_ID_MAX_LENGTH).optional(),
  wakeReason: agentWakeReasonSchema.optional(),
});

export const agentThreadSchema = z.object({
  id: agentThreadIdSchema,
  agentId: agentIdSchema,
  ownerId: playerIdSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});

export const agentMessageSchema = z.object({
  id: entityIdSchema,
  threadId: agentThreadIdSchema,
  senderType: agentMessageSenderTypeSchema,
  senderId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  content: messageContentSchema,
  metadata: metadataSchema.optional(),
  createdAt: timestampSchema,
});

export const createAgentRequestSchema = z.object({
  kind: agentKindSchema,
  ownerType: agentOwnerTypeSchema,
  ownerId: playerIdSchema,
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  displayName: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  modelProvider: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  modelId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  authMode: agentAuthModeSchema,
  runtimeConfig: agentRuntimeConfigSchema.optional(),
  subscriptions: z.array(agentWorldSubscriptionSchema).optional(),
  metadata: metadataSchema.optional(),
});

export const createAgentResponseSchema = z.object({
  agentId: agentIdSchema,
  status: agentCreateStatusSchema,
  authSessionId: entityIdSchema.optional(),
  authUrl: z.string().url().optional(),
  expiresAt: timestampSchema.optional(),
  detail: agentDetailSchema.optional(),
  errorCode: z.string().min(1).max(ENTITY_ID_MAX_LENGTH).optional(),
  errorMessage: z.string().max(MESSAGE_MAX_LENGTH).optional(),
});

export const launchMyAgentResponseSchema = z.object({
  agentId: agentIdSchema,
  status: myAgentLaunchStatusSchema,
  authSessionId: entityIdSchema.optional(),
  authUrl: z.string().url().optional(),
  expiresAt: timestampSchema.optional(),
  detail: myAgentDetailSchema.optional(),
  errorCode: z.string().min(1).max(ENTITY_ID_MAX_LENGTH).optional(),
  errorMessage: z.string().max(MESSAGE_MAX_LENGTH).optional(),
});

export const updateAgentRequestSchema = z.object({
  displayName: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH).optional(),
  desiredState: agentDesiredStateSchema.optional(),
  modelProvider: z.string().min(1).max(ENTITY_ID_MAX_LENGTH).optional(),
  modelId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH).optional(),
  runtimeConfig: agentRuntimeConfigSchema.optional(),
  subscriptions: z.array(agentWorldSubscriptionSchema).optional(),
  metadata: metadataSchema.optional(),
});

export const agentPromptRequestSchema = z.object({
  prompt: messageContentSchema,
  metadata: metadataSchema.optional(),
});

export const postAgentMessageRequestSchema = z.object({
  content: messageContentSchema,
  metadata: metadataSchema.optional(),
});

export const modelsResponseSchema = z.object({
  models: z.array(
    z.object({
      provider: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
      id: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
      label: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH),
    }),
  ),
});

export const myAgentsResponseSchema = z.object({
  agents: z.array(myAgentSummarySchema),
});

export const myAgentMessagesResponseSchema = z.object({
  messages: z.array(agentMessageSchema),
});

export const myAgentHistoryResponseSchema = z.object({
  history: z.array(agentHistoryEntrySchema),
});

export const launchMyAgentRequestSchema = z.object({
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  worldName: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH).optional(),
  chain: z.enum(["sepolia", "mainnet", "slot", "slottest", "local"]).optional(),
  rpcUrl: z.string().url().optional(),
  toriiBaseUrl: z.string().url().optional(),
  displayName: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH).optional(),
  modelProvider: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  modelId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  initialConfig: agentRuntimeConfigSchema.optional(),
});

export const completeAgentSetupRequestSchema = z.object({
  authSessionId: entityIdSchema,
  state: z.string().min(1).max(MESSAGE_MAX_LENGTH),
  startapp: z.string().min(1),
});

export const resetAgentSessionRequestSchema = z.object({
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH).optional(),
});

export const enableAgentAutonomyRequestSchema = z.object({
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  steeringJobType: steeringJobTypeSchema,
  steeringConfig: steeringJobConfigSchema.optional(),
});

export const disableAgentAutonomyRequestSchema = z.object({
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
});

export const setSteeringJobRequestSchema = z.object({
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  steeringJobType: steeringJobTypeSchema,
  steeringConfig: steeringJobConfigSchema.optional(),
});

export const agentRunJobSchema = z.object({
  jobId: entityIdSchema,
  agentId: agentIdSchema,
  wakeReason: agentWakeReasonSchema,
  coalescedEventIds: z.array(entityIdSchema).default([]),
  snapshotVersion: z.number().int().nonnegative().optional(),
  leaseId: entityIdSchema,
  priority: z.number().int().nonnegative(),
  requestedAt: timestampSchema,
});

export const worldIngestJobSchema = z.object({
  worldId: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  reason: z.string().min(1).max(ENTITY_ID_MAX_LENGTH),
  requestedAt: timestampSchema,
});

export const agentDelayedWakeJobSchema = z.object({
  agentId: agentIdSchema,
  wakeAt: timestampSchema,
  reason: agentWakeReasonSchema,
  correlationId: entityIdSchema,
});

export const agentMaintenanceTaskSchema = z.enum([
  "reconcile_state",
  "refresh_auth",
  "compact_artifacts",
  "rebuild_snapshot_subscription",
]);

export const agentMaintenanceJobSchema = z.object({
  agentId: agentIdSchema,
  task: agentMaintenanceTaskSchema,
  requestedAt: timestampSchema,
});

export const agentWorldChatMetadataSchema = z.object({
  agent: z.object({
    agentId: agentIdSchema,
    kind: agentKindSchema,
  }),
  replyDepth: z.number().int().nonnegative().optional(),
});

export type AgentKind = z.infer<typeof agentKindSchema>;
export type AgentDesiredState = z.infer<typeof agentDesiredStateSchema>;
export type AgentExecutionState = z.infer<typeof agentExecutionStateSchema>;
export type AgentWakeReason = z.infer<typeof agentWakeReasonSchema>;
export type AgentRuntimeConfig = z.infer<typeof agentRuntimeConfigSchema>;
export type AgentWorldSubscription = z.infer<typeof agentWorldSubscriptionSchema>;
export type AgentSummary = z.infer<typeof agentSummarySchema>;
export type AgentDetail = z.infer<typeof agentDetailSchema>;
export type AgentSetupState = z.infer<typeof agentSetupStateSchema>;
export type AgentAutonomyState = z.infer<typeof agentAutonomyStateSchema>;
export type SteeringJobType = z.infer<typeof steeringJobTypeSchema>;
export type SteeringJobStatus = z.infer<typeof steeringJobStatusSchema>;
export type SteeringJobConfig = z.infer<typeof steeringJobConfigSchema>;
export type SteeringJobState = z.infer<typeof steeringJobStateSchema>;
export type AgentHistoryEntryKind = z.infer<typeof agentHistoryEntryKindSchema>;
export type MyAgentSummary = z.infer<typeof myAgentSummarySchema>;
export type MyAgentDetail = z.infer<typeof myAgentDetailSchema>;
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type AgentSetupChangedEventPayload = z.infer<typeof agentSetupChangedEventPayloadSchema>;
export type AgentAutonomyChangedEventPayload = z.infer<typeof agentAutonomyChangedEventPayloadSchema>;
export type AgentSteeringChangedEventPayload = z.infer<typeof agentSteeringChangedEventPayloadSchema>;
export type AgentMatchEndedEventPayload = z.infer<typeof agentMatchEndedEventPayloadSchema>;
export type AgentHistoryEntry = z.infer<typeof agentHistoryEntrySchema>;
export type AgentThread = z.infer<typeof agentThreadSchema>;
export type AgentMessage = z.infer<typeof agentMessageSchema>;
export type AgentRunSummary = z.infer<typeof agentRunSummarySchema>;
export type AgentSessionSummary = z.infer<typeof agentSessionSummarySchema>;
export type AgentSessionDetail = z.infer<typeof agentSessionDetailSchema>;
export type CreateAgentRequest = z.infer<typeof createAgentRequestSchema>;
export type CreateAgentResponse = z.infer<typeof createAgentResponseSchema>;
export type LaunchMyAgentResponse = z.infer<typeof launchMyAgentResponseSchema>;
export type UpdateAgentRequest = z.infer<typeof updateAgentRequestSchema>;
export type AgentPromptRequest = z.infer<typeof agentPromptRequestSchema>;
export type PostAgentMessageRequest = z.infer<typeof postAgentMessageRequestSchema>;
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;
export type MyAgentsResponse = z.infer<typeof myAgentsResponseSchema>;
export type MyAgentMessagesResponse = z.infer<typeof myAgentMessagesResponseSchema>;
export type MyAgentHistoryResponse = z.infer<typeof myAgentHistoryResponseSchema>;
export type LaunchMyAgentRequest = z.infer<typeof launchMyAgentRequestSchema>;
export type CompleteAgentSetupRequest = z.infer<typeof completeAgentSetupRequestSchema>;
export type ResetAgentSessionRequest = z.infer<typeof resetAgentSessionRequestSchema>;
export type EnableAgentAutonomyRequest = z.infer<typeof enableAgentAutonomyRequestSchema>;
export type DisableAgentAutonomyRequest = z.infer<typeof disableAgentAutonomyRequestSchema>;
export type SetSteeringJobRequest = z.infer<typeof setSteeringJobRequestSchema>;
export type AgentRunJob = z.infer<typeof agentRunJobSchema>;
export type WorldIngestJob = z.infer<typeof worldIngestJobSchema>;
export type AgentDelayedWakeJob = z.infer<typeof agentDelayedWakeJobSchema>;
export type AgentMaintenanceTask = z.infer<typeof agentMaintenanceTaskSchema>;
export type AgentMaintenanceJob = z.infer<typeof agentMaintenanceJobSchema>;
export type AgentWorldChatMetadata = z.infer<typeof agentWorldChatMetadataSchema>;
