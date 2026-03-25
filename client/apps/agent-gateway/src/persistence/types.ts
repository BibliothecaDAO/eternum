import type {
  AgentDetail,
  AgentEvent,
  AgentHistoryEntry,
  AgentMessage,
  AgentSessionDetail,
  MyAgentDetail,
  MyAgentSummary,
  SteeringJobConfig,
  SteeringJobType,
  UpdateAgentRequest,
} from "@bibliothecadao/types";

export interface LaunchPlayerAgentInput {
  ownerId: string;
  detail: AgentDetail;
  baseUrl: string;
  authSession: {
    id: string;
    authUrl: string;
    authState: string;
    sessionRef: string;
    redirectUri: string;
    policyFingerprint: string;
    encryptedSignerJson: unknown;
    keyVersion: string;
  };
}

export interface CompletePlayerSetupInput {
  authSessionId: string;
  agentId: string;
  state: string;
  startapp: string;
  approvedSession: {
    expiresAt?: string;
    approvedAt: string;
    sessionAccountAddress: string;
    cartridgeUsername?: string;
    encryptedSessionJson: unknown;
  };
}

export interface UpdatePlayerAgentInput {
  ownerId: string;
  agentId: string;
  patch: UpdateAgentRequest;
}

export interface SetPlayerAgentAutonomyInput {
  ownerId: string;
  agentId: string;
  worldId: string;
  enabled: boolean;
  matchId?: string;
}

export interface SetPlayerAgentSteeringInput {
  ownerId: string;
  agentId: string;
  worldId: string;
  type: SteeringJobType;
  config?: SteeringJobConfig;
}

export interface AppendPlayerAgentMessageInput {
  ownerId: string;
  agentId: string;
  message: AgentMessage;
}

export interface ListPlayerAgentEventsInput {
  ownerId: string;
  agentId: string;
  afterSeq?: number;
}

export interface PlayerAgentRepository {
  listPlayerAgents(ownerId: string): Promise<MyAgentSummary[]>;
  getPlayerAgentDetail(ownerId: string, agentId: string): Promise<MyAgentDetail | null>;
  getPlayerAgentByWorld(ownerId: string, worldId: string): Promise<MyAgentDetail | null>;
  launchPlayerAgent(input: LaunchPlayerAgentInput): Promise<MyAgentDetail>;
  completePlayerAgentSetup(input: CompletePlayerSetupInput): Promise<MyAgentDetail | null>;
  updatePlayerAgent(input: UpdatePlayerAgentInput): Promise<MyAgentDetail | null>;
  setPlayerAgentAutonomy(input: SetPlayerAgentAutonomyInput): Promise<MyAgentDetail | null>;
  setPlayerAgentSteering(input: SetPlayerAgentSteeringInput): Promise<MyAgentDetail | null>;
  resetPlayerAgentSession(input: {
    ownerId: string;
    agentId: string;
    nextAuthSession: LaunchPlayerAgentInput["authSession"];
    nextSetupState: MyAgentDetail["setup"];
  }): Promise<MyAgentDetail | null>;
  invalidatePlayerAgentSession(input: { agentId: string; sessionId: string; reason: string }): Promise<void>;
  getPendingSetupContext(input: { agentId: string; authSessionId: string }): Promise<{
    callbackStateHash?: string | null;
    policyFingerprint?: string | null;
    encryptedSignerJson?: unknown;
    keyVersion?: string | null;
    worldId: string;
    worldName?: string;
    chain?: "mainnet" | "sepolia" | "slot" | "slottest" | "local";
    rpcUrl?: string;
    toriiBaseUrl?: string;
  } | null>;
  listPlayerAgentEvents(input: ListPlayerAgentEventsInput): Promise<AgentEvent[]>;
  listPlayerAgentMessages(ownerId: string, agentId: string): Promise<AgentMessage[]>;
  appendPlayerAgentMessage(input: AppendPlayerAgentMessageInput): Promise<AgentMessage | null>;
  listPlayerAgentHistory(ownerId: string, agentId: string): Promise<AgentHistoryEntry[]>;
  getActiveSession(ownerId: string, agentId: string): Promise<AgentSessionDetail | null>;
}
