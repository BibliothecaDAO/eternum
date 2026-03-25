import { describe, expect, it } from "vitest";

import app from "./index";
import { AgentCoordinatorDO } from "./coordinator/agent-coordinator";
import type {
  AgentGatewayEnv,
  DurableObjectNamespaceLike,
  DurableObjectStateLike,
  DurableObjectStorageLike,
  DurableObjectStubLike,
  QueueBindingLike,
} from "./types";

class InMemoryStorage implements DurableObjectStorageLike {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }
}

class InMemoryState implements DurableObjectStateLike {
  storage = new InMemoryStorage();
}

class CoordinatorStub implements DurableObjectStubLike {
  constructor(private readonly coordinator: AgentCoordinatorDO) {}

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : new Request(String(input), init);
    return this.coordinator.fetch(request);
  }
}

class InMemoryCoordinatorNamespace implements DurableObjectNamespaceLike {
  private readonly coordinators = new Map<string, CoordinatorStub>();

  idFromName(name: string) {
    return name;
  }

  get(id: unknown): DurableObjectStubLike {
    const key = String(id);
    let stub = this.coordinators.get(key);
    if (!stub) {
      stub = new CoordinatorStub(new AgentCoordinatorDO(new InMemoryState()));
      this.coordinators.set(key, stub);
    }
    return stub;
  }
}

class RecordedQueue<TPayload> implements QueueBindingLike<TPayload> {
  readonly messages: TPayload[] = [];

  async send(message: TPayload): Promise<void> {
    this.messages.push(message);
  }
}

function createEnv() {
  process.env.AGENT_SESSION_ENCRYPTION_KEYS = JSON.stringify({
    test: Buffer.from("12345678901234567890123456789012").toString("base64"),
  });
  process.env.AGENT_SESSION_ENCRYPTION_ACTIVE_KEY_ID = "test";
  process.env.AGENT_AUTH_SKIP_VALIDATE = "true";
  const queue = new RecordedQueue<any>();
  const env: AgentGatewayEnv = {
    AGENT_COORDINATOR: new InMemoryCoordinatorNamespace(),
    AGENT_RUN_QUEUE: queue,
    MODELS: "anthropic:claude-sonnet-4-20250514:Claude Sonnet 4",
  };
  return { env, queue };
}

describe("agent gateway e2e", () => {
  it("lists only the current player's agents through /my/agents", async () => {
    const { env } = createEnv();

    const createAgent = async (ownerId: string, worldId: string, displayName: string) =>
      app.request(
        "/agents",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "player",
            ownerType: "player",
            ownerId,
            worldId,
            displayName,
            modelProvider: "anthropic",
            modelId: "claude-sonnet-4-20250514",
            authMode: "npc_managed",
          }),
        },
        env,
      );

    await createAgent("player-a", "world-1", "Alpha");
    await createAgent("player-a", "world-2", "Bravo");
    await createAgent("player-b", "world-1", "Charlie");

    const myAgentsResponse = await app.request("/my/agents", { headers: { "x-player-id": "player-a" } }, env);
    expect(myAgentsResponse.status).toBe(200);

    const payload = await myAgentsResponse.json();
    expect(payload.agents).toHaveLength(2);
    expect(payload.agents.every((agent: { ownerId: string }) => agent.ownerId === "player-a")).toBe(true);
    expect(payload.agents.map((agent: { worldId: string }) => agent.worldId).sort()).toEqual(["world-1", "world-2"]);
  });

  it("creates an npc agent, stores prompt state, and queues a run", async () => {
    const { env, queue } = createEnv();

    const createResponse = await app.request(
      "/agents",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
        body: JSON.stringify({
          kind: "npc",
          ownerType: "npc",
          ownerId: "npc-owner",
          worldId: "world-1",
          displayName: "Scout",
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
          authMode: "npc_managed",
        }),
      },
      env,
    );

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.status).toBe("ready");
    expect(created.detail.executionState).toBe("idle");

    const promptResponse = await app.request(
      `/agents/${created.agentId}/prompt`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "Defend the north edge." }),
      },
      env,
    );

    expect(promptResponse.status).toBe(202);
    expect(queue.messages).toHaveLength(1);
    expect(queue.messages[0].agentId).toBe(created.agentId);
    expect(queue.messages[0].wakeReason).toBe("user_prompt");

    const messagesResponse = await app.request(`/agents/${created.agentId}/messages`, undefined, env);
    const messages = await messagesResponse.json();
    expect(messages.messages).toHaveLength(1);
    expect(messages.messages[0].content).toBe("Defend the north edge.");

    const eventsResponse = await app.request(`/agents/${created.agentId}/events?afterSeq=0`, undefined, env);
    const eventsText = await eventsResponse.text();
    expect(eventsText).toContain("user_prompt");
  });

  it("creates a player agent in pending auth state", async () => {
    const { env } = createEnv();

    const response = await app.request(
      "/agents",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "player",
          ownerType: "player",
          ownerId: "player-1",
          worldId: "world-1",
          displayName: "My Agent",
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
          authMode: "player_session",
        }),
      },
      env,
    );

    expect(response.status).toBe(202);
    const created = await response.json();
    expect(created.status).toBe("pending_auth");
    expect(created.authUrl).toContain("redirect_uri=");
    const redirectUri = new URL(new URL(created.authUrl).searchParams.get("redirect_uri")!);
    expect(redirectUri.pathname).toBe("/agents/auth/callback");
    const redirectHash = new URLSearchParams(redirectUri.hash.replace(/^#/, ""));
    expect(redirectHash.get("agentId")).toBe(created.agentId);
  });

  it("completes player setup through the auth URL and persists the ready state", async () => {
    const { env } = createEnv();

    const createResponse = await app.request(
      "/my/agents",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-player-id": "player-setup", origin: "http://127.0.0.1:5173" },
        body: JSON.stringify({
          worldId: "world-setup",
          displayName: "Setup Agent",
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
        }),
      },
      env,
    );

    expect(createResponse.status).toBe(202);
    const created = await createResponse.json();
    expect(created.status).toBe("pending_auth");
    expect(created.authUrl).toBeTruthy();
    expect(created.authSessionId).toBeTruthy();
    expect(created.authUrl).toContain("public_key=");
    expect(created.authUrl).toContain("redirect_uri=");
    expect(created.authUrl).toContain("policies=");
    expect(created.authUrl).toContain("rpc_url=");

    const setupUrl = new URL(created.authUrl);
    const redirectUri = new URL(setupUrl.searchParams.get("redirect_uri")!);
    const redirectHash = new URLSearchParams(redirectUri.hash.replace(/^#/, ""));
    const callbackResponse = await app.request(
      `/my/agents/${created.agentId}/setup/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authSessionId: created.authSessionId,
          state: redirectHash.get("state"),
          startapp: btoa(
            JSON.stringify({
              username: "player_setup",
              address: "0xABCDEF",
              ownerGuid: "0x123456",
              expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
            }),
          ),
        }),
      },
      env,
    );

    expect(callbackResponse.status).toBe(200);
    const callbackPayload = await callbackResponse.json();
    expect(callbackPayload.detail.setup.status).toBe("ready");
    expect(callbackPayload.detail.session.status).toBe("approved");

    const detailResponse = await app.request(
      `/my/agents/${created.agentId}`,
      { headers: { "x-player-id": "player-setup" } },
      env,
    );
    expect(detailResponse.status).toBe(200);

    const detail = await detailResponse.json();
    expect(detail.setup.status).toBe("ready");
    expect(detail.executionState).toBe("idle");

    const autonomyResponse = await app.request(
      `/my/agents/${created.agentId}/autonomy/enable`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-player-id": "player-setup" },
        body: JSON.stringify({
          worldId: "world-setup",
          steeringJobType: "scout",
        }),
      },
      env,
    );

    expect(autonomyResponse.status).toBe(200);
    const enabledDetail = await autonomyResponse.json();
    expect(enabledDetail.autonomy.enabled).toBe(true);
    expect(enabledDetail.executionState).toBe("idle");
    expect(enabledDetail.nextWakeAt).toBeTruthy();

    const eventsResponse = await app.request(
      `/my/agents/${created.agentId}/events?afterSeq=0`,
      { headers: { "x-player-id": "player-setup" } },
      env,
    );
    expect(eventsResponse.status).toBe(200);
    expect(await eventsResponse.text()).toContain("agent.setup_changed");
  });

  it("falls back to the local in-memory coordinator when no durable object binding exists", async () => {
    const queue = new RecordedQueue<any>();
    const env: AgentGatewayEnv = {
      AGENT_RUN_QUEUE: queue,
      MODELS: "anthropic:claude-sonnet-4-20250514:Claude Sonnet 4",
    };

    const response = await app.request(
      "/my/agents",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-player-id": "player-local", origin: "http://127.0.0.1:5173" },
        body: JSON.stringify({
          worldId: "world-local",
          displayName: "Local Agent",
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
        }),
      },
      env,
    );

    expect(response.status).toBe(202);
    const created = await response.json();
    expect(created.agentId).toBeTruthy();

    const listResponse = await app.request("/my/agents", { headers: { "x-player-id": "player-local" } }, env);
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expect(listPayload.agents).toHaveLength(1);
    expect(listPayload.agents[0].displayName).toBe("Local Agent");
  });
});
