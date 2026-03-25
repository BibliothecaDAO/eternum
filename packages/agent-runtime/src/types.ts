import type { AgentMessage as CoreAgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";

import type {
  AgentKind,
  AgentRuntimeConfig,
  AgentWakeReason,
  SteeringJobConfig,
  SteeringJobType,
} from "@bibliothecadao/types";

export interface ResolvedAgentSession {
  agentId: string;
  status: "ready" | "pending_auth" | "error" | "expired" | "invalidated";
  accountAddress?: string;
  authUrl?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CartridgeWorldAuthContext {
  worldId: string;
  worldName: string;
  chain: "mainnet" | "sepolia" | "slot" | "slottest" | "local";
  chainId: string;
  rpcUrl: string;
  toriiBaseUrl: string;
  worldAddress: string;
  manifest: Record<string, unknown>;
  contractsBySelector: Record<string, string>;
  entryTokenAddress?: string;
  feeTokenAddress?: string;
  policies: Record<string, unknown>;
  policyFingerprint: string;
}

export interface CartridgeSigner {
  privKey: string;
  pubKey: string;
}

export interface CartridgeSessionRegistration {
  username?: string;
  address: string;
  ownerGuid: string;
  expiresAt: string;
  guardianKeyGuid: string;
  metadataHash: string;
  sessionKeyGuid: string;
  [key: string]: unknown;
}

export interface CartridgeApprovalResult {
  authUrl: string;
  signer: CartridgeSigner;
  sessionRef: string;
}

export interface StoredCartridgeSessionMaterial {
  signer: CartridgeSigner;
  session: CartridgeSessionRegistration;
}

export interface EncryptedCartridgeSessionMaterial {
  keyVersion: string;
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface CartridgeEncryptionConfig {
  activeKeyId: string;
  keys: Record<string, string>;
}

export interface LoadAgentSessionInput<TContext = Record<string, unknown>> {
  agentId: string;
  context?: TContext;
}

export interface AgentSessionResolver<
  TContext = Record<string, unknown>,
  TSession extends ResolvedAgentSession = ResolvedAgentSession,
> {
  load(input: LoadAgentSessionInput<TContext>): Promise<TSession>;
}

export interface AgentArtifacts {
  agentId: string;
  files: Record<string, string>;
}

export interface LoadAgentArtifactsInput {
  agentId: string;
  files?: string[];
}

export interface SaveAgentArtifactsInput extends AgentArtifacts {}

export interface AgentArtifactStore {
  load(input: LoadAgentArtifactsInput): Promise<AgentArtifacts>;
  save(input: SaveAgentArtifactsInput): Promise<void>;
}

export interface ManagedAgentRuntimeEvent {
  type: string;
  payload?: Record<string, unknown>;
}

export interface ManagedAgentRuntimeInput {
  dataDir: string;
  model: Model<any>;
  tools: AgentTool[];
  systemPromptBuilder: (dataDir: string) => string;
  convertToLlm?: (messages: CoreAgentMessage[]) => Message[];
  transformContext?: (messages: CoreAgentMessage[]) => Promise<CoreAgentMessage[]>;
  followUpMode?: "one-at-a-time" | "all";
}

export interface SteeringOverlay {
  jobType: SteeringJobType;
  summary: string;
  promptSupplement: string;
  taskOverrides: Record<string, string>;
  runtimeConfigOverrides: Partial<AgentRuntimeConfig>;
  memoryNote?: string | null;
  updatedAt: string;
}

export interface SteeringOverlayResolverInput {
  agentId: string;
  worldId?: string;
}

export interface SteeringOverlayResolver {
  load(input: SteeringOverlayResolverInput): Promise<SteeringOverlay | null>;
}

export interface SteeringProfileInput {
  jobType: SteeringJobType;
  config?: SteeringJobConfig;
}

export interface RunAgentTurnInput {
  runtime: ManagedAgentRuntime;
  prompt: string;
  wakeReason?: AgentWakeReason;
  steeringOverlay?: SteeringOverlay | null;
}

export interface AgentTurnResult {
  startedAt: string;
  finishedAt: string;
  wakeReason?: AgentWakeReason;
  toolCalls: number;
  success: boolean;
  errorMessage?: string;
}

export interface WorldActionBatchInput<TAction, TResult> {
  actions: TAction[];
  execute: (action: TAction, index: number) => Promise<TResult>;
}

export interface ActionBatchResult<TResult> {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<
    | {
        ok: true;
        result: TResult;
      }
    | {
        ok: false;
        error: string;
      }
  >;
}

export interface PublishAgentWorldChatInput {
  baseUrl: string;
  zoneId: string;
  content: string;
  agentId: string;
  kind: AgentKind;
  metadata?: Record<string, unknown>;
  queryParams?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export interface ManagedAgentRuntime {
  dataDir: string;
  isBusy(): boolean;
  prompt(prompt: string): Promise<void>;
  followUp(prompt: string): void;
  reloadPrompt(): void;
  onEvent(listener: (event: ManagedAgentRuntimeEvent) => void): () => void;
  dispose(): Promise<void>;
}
