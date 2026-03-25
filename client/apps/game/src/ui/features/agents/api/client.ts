import type {
  CompleteAgentSetupRequest,
  DisableAgentAutonomyRequest,
  EnableAgentAutonomyRequest,
  LaunchMyAgentResponse,
  MyAgentDetail,
  MyAgentHistoryResponse,
  MyAgentMessagesResponse,
  MyAgentsResponse,
  SetSteeringJobRequest,
} from "@bibliothecadao/types";

import { env } from "../../../../../env";

const AGENT_GATEWAY_URL = env.VITE_PUBLIC_AGENT_GATEWAY_URL;

function buildHeaders(playerId: string, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("x-player-id", playerId);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return headers;
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchMyAgents(playerId: string): Promise<MyAgentsResponse> {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents`, {
    headers: buildHeaders(playerId),
  });
  return parseJsonOrThrow<MyAgentsResponse>(response);
}

export async function launchMyAgent(
  playerId: string,
  payload: {
    worldId: string;
    worldName?: string;
    chain?: "sepolia" | "mainnet" | "slot" | "slottest" | "local";
    rpcUrl?: string;
    toriiBaseUrl?: string;
    displayName?: string;
    modelProvider: string;
    modelId: string;
    initialConfig?: Record<string, unknown>;
  },
) {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents`, {
    method: "POST",
    headers: buildHeaders(playerId),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<LaunchMyAgentResponse>(response);
}

export async function completeMyAgentSetup(agentId: string, payload: CompleteAgentSetupRequest) {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}/setup/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<{ agentId: string; detail: MyAgentDetail }>(response);
}

export async function fetchMyAgentDetail(playerId: string, agentId: string): Promise<MyAgentDetail> {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}`, {
    headers: buildHeaders(playerId),
  });
  return parseJsonOrThrow<MyAgentDetail>(response);
}

export async function updateMyAgent(
  playerId: string,
  agentId: string,
  payload: Record<string, unknown>,
): Promise<MyAgentDetail> {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}`, {
    method: "PATCH",
    headers: buildHeaders(playerId),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<MyAgentDetail>(response);
}

export async function enableMyAgentAutonomy(
  playerId: string,
  agentId: string,
  payload: EnableAgentAutonomyRequest,
): Promise<MyAgentDetail> {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}/autonomy/enable`, {
    method: "POST",
    headers: buildHeaders(playerId),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<MyAgentDetail>(response);
}

export async function disableMyAgentAutonomy(
  playerId: string,
  agentId: string,
  payload: DisableAgentAutonomyRequest,
): Promise<MyAgentDetail> {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}/autonomy/disable`, {
    method: "POST",
    headers: buildHeaders(playerId),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<MyAgentDetail>(response);
}

export async function setMyAgentSteering(
  playerId: string,
  agentId: string,
  payload: SetSteeringJobRequest,
): Promise<MyAgentDetail> {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}/steering`, {
    method: "POST",
    headers: buildHeaders(playerId),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<MyAgentDetail>(response);
}

export async function fetchMyAgentMessages(playerId: string, agentId: string) {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}/messages`, {
    headers: buildHeaders(playerId),
  });
  return parseJsonOrThrow<MyAgentMessagesResponse>(response);
}

export async function sendMyAgentMessage(
  playerId: string,
  agentId: string,
  payload: { content: string; metadata?: Record<string, unknown> },
) {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}/messages`, {
    method: "POST",
    headers: buildHeaders(playerId),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<Record<string, unknown>>(response);
}

export async function fetchMyAgentHistory(playerId: string, agentId: string) {
  const response = await fetch(`${AGENT_GATEWAY_URL}/my/agents/${agentId}/history`, {
    headers: buildHeaders(playerId),
  });
  return parseJsonOrThrow<MyAgentHistoryResponse>(response);
}

export function buildMyAgentEventsUrl(playerId: string, agentId: string, afterSeq: number = 0): string {
  const url = new URL(`${AGENT_GATEWAY_URL}/my/agents/${agentId}/events`);
  url.searchParams.set("afterSeq", String(afterSeq));
  url.searchParams.set("playerId", playerId);
  return url.toString();
}
