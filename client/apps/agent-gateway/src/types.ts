import type { AgentDetail, AgentEvent, AgentMessage, AgentRunJob } from "@bibliothecadao/types";
import type { PlayerAgentRepository } from "./persistence";

export interface QueueBindingLike<TPayload = unknown> {
  send(message: TPayload): Promise<void>;
}

export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}

export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export interface AgentGatewayEnv {
  AGENT_COORDINATOR?: DurableObjectNamespaceLike;
  AGENT_RUN_QUEUE?: QueueBindingLike<AgentRunJob>;
  MODELS?: string;
  DATABASE_URL?: string;
  AGENT_REPOSITORY?: PlayerAgentRepository;
}

export interface AgentCoordinatorStateSnapshot {
  detail: AgentDetail;
  eventSeq: number;
  currentRunLeaseId?: string;
}

export interface AgentCoordinatorStorageShape {
  state: AgentCoordinatorStateSnapshot;
  events: AgentEvent[];
  messages: AgentMessage[];
}
