import { Hono } from "hono";
import { cors } from "hono/cors";

import {
  type AgentDetail,
  type AgentEvent,
  type AgentMessage,
  completeAgentSetupRequestSchema,
  createAgentRequestSchema,
  createAgentResponseSchema,
  disableAgentAutonomyRequestSchema,
  enableAgentAutonomyRequestSchema,
  launchMyAgentRequestSchema,
  launchMyAgentResponseSchema,
  modelsResponseSchema,
  myAgentHistoryResponseSchema,
  myAgentMessagesResponseSchema,
  myAgentsResponseSchema,
  postAgentMessageRequestSchema,
  resetAgentSessionRequestSchema,
  setSteeringJobRequestSchema,
  updateAgentRequestSchema,
} from "@bibliothecadao/types";

import type { AgentGatewayEnv } from "./types";
import { completePendingCartridgeSession, createPendingCartridgeSession } from "./auth/cartridge-session-service";
import { getLocalCoordinatorNamespace } from "./local-coordinator";
import { buildAgentMessage } from "./registry";
import { getPlayerAgentRepository } from "./persistence";

const app = new Hono<{ Bindings: AgentGatewayEnv }>();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return origin;
      }

      if (
        origin.startsWith("http://127.0.0.1:") ||
        origin.startsWith("https://127.0.0.1:") ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("https://localhost:")
      ) {
        return origin;
      }

      return "";
    },
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "x-player-id", "x-wallet-address", "Authorization"],
  }),
);

function resolveCurrentPlayerId(request: Request): string | null {
  const url = new URL(request.url);
  const playerId =
    request.headers.get("x-player-id") ??
    request.headers.get("x-wallet-address") ??
    url.searchParams.get("playerId") ??
    url.searchParams.get("walletAddress");

  return playerId?.trim() ? playerId.trim() : null;
}

function getCoordinatorStub(env: AgentGatewayEnv, agentId: string) {
  const namespace = env.AGENT_COORDINATOR ?? getLocalCoordinatorNamespace();
  const durableObjectId = namespace.idFromName(agentId);
  return namespace.get(durableObjectId);
}

function resolveGatewayBaseUrl(request: Request): string {
  return new URL(request.url).origin;
}

function resolveAuthCallbackBaseUrl(request: Request): string {
  return request.headers.get("origin")?.trim() || process.env.AGENT_CLIENT_ORIGIN || new URL(request.url).origin;
}

function buildLaunchStatus(detail: { setup?: { status: string } }) {
  switch (detail.setup?.status) {
    case "launching":
      return "launching";
    case "pending_auth":
      return "pending_auth";
    case "error":
      return "error";
    default:
      return "ready";
  }
}

async function streamAgentEvents(events: AgentEvent[]): Promise<Response> {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

async function initializeAgent(env: AgentGatewayEnv, agentId: string, request: Request): Promise<AgentDetail> {
  const coordinator = getCoordinatorStub(env, agentId);
  const response = await coordinator.fetch(new URL(`https://agent.internal/initialize?agentId=${agentId}`), {
    method: "POST",
    body: await request.text(),
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
  });
  return (await response.json()) as AgentDetail;
}

app.get("/health", (c) => c.json({ ok: true }));

app.get("/my/agents", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }

  const repository = getPlayerAgentRepository(c.env);
  const agents = await repository.listPlayerAgents(ownerId);
  return c.json(
    myAgentsResponseSchema.parse({
      agents,
    }),
  );
});

app.post("/my/agents", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }

  const payload = launchMyAgentRequestSchema.parse(await c.req.json());
  const repository = getPlayerAgentRepository(c.env);
  const existingAgent = await repository.getPlayerAgentByWorld(ownerId, payload.worldId);
  if (existingAgent) {
    return c.json(
      launchMyAgentResponseSchema.parse({
        agentId: existingAgent.id,
        status: buildLaunchStatus(existingAgent),
        authSessionId: existingAgent.activeSession?.id,
        authUrl: existingAgent.setup.authUrl,
        expiresAt: existingAgent.setup.expiresAt,
        detail: existingAgent,
      }),
      200,
    );
  }

  const detail = await initializeAgent(
    c.env,
    crypto.randomUUID(),
    new Request("https://agent.internal", {
      method: "POST",
      body: JSON.stringify({
        kind: "player",
        ownerType: "player",
        ownerId,
        worldId: payload.worldId,
        displayName: payload.displayName ?? "My Agent",
        modelProvider: payload.modelProvider,
        modelId: payload.modelId,
        authMode: "player_session",
        runtimeConfig: {
          ...(payload.initialConfig ?? {}),
          metadata: {
            ...(payload.initialConfig?.metadata ?? {}),
            worldAuth: {
              worldName: payload.worldName ?? payload.worldId,
              chain: payload.chain,
              rpcUrl: payload.rpcUrl,
              toriiBaseUrl: payload.toriiBaseUrl,
            },
          },
        },
      }),
      headers: {
        "content-type": "application/json",
      },
    }),
  );
  const authSessionId = crypto.randomUUID();
  const pendingSession = await createPendingCartridgeSession({
    agentId: detail.id,
    authSessionId,
    launchRequest: payload,
    callbackBaseUrl: resolveAuthCallbackBaseUrl(c.req.raw),
  });
  const myDetail = await repository.launchPlayerAgent({
    ownerId,
    detail,
    baseUrl: resolveGatewayBaseUrl(c.req.raw),
    authSession: pendingSession.authSession,
  });

  return c.json(
    launchMyAgentResponseSchema.parse({
      agentId: detail.id,
      status: buildLaunchStatus(myDetail),
      authSessionId: pendingSession.authSession.id,
      authUrl: myDetail.setup.authUrl,
      expiresAt: myDetail.setup.expiresAt,
      detail: myDetail,
    }),
    myDetail.setup.status === "pending_auth" ? 202 : myDetail.setup.status === "launching" ? 202 : 201,
  );
});

app.get("/my/agents/:agentId", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }

  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail || detail.ownerId !== ownerId) {
    return c.json({ error: "Agent not found." }, 404);
  }

  return c.json(detail);
});

app.post("/my/agents/:agentId/setup/complete", async (c) => {
  const payload = completeAgentSetupRequestSchema.parse(await c.req.json());
  const repository = getPlayerAgentRepository(c.env);
  const pendingContext = await repository.getPendingSetupContext({
    agentId: c.req.param("agentId"),
    authSessionId: payload.authSessionId,
  });

  if (!pendingContext) {
    return c.json({ error: "Pending auth session not found." }, 404);
  }

  const completion = await completePendingCartridgeSession({
    request: payload,
    storedSession: pendingContext,
    launchRequest: {
      worldId: pendingContext.worldId,
      worldName: pendingContext.worldName,
      chain: pendingContext.chain,
      rpcUrl: pendingContext.rpcUrl,
      toriiBaseUrl: pendingContext.toriiBaseUrl,
    },
  }).catch(async () => null);

  if (!completion) {
    return c.json({ error: "Invalid or expired auth completion payload." }, 400);
  }

  const nextDetail = await repository.completePlayerAgentSetup({
    agentId: c.req.param("agentId"),
    authSessionId: payload.authSessionId,
    state: payload.state,
    startapp: payload.startapp,
    approvedSession: completion.approvedSession,
  });
  if (!nextDetail) {
    return c.json({ error: "Agent session could not be completed." }, 404);
  }

  return c.json({
    agentId: nextDetail.id,
    detail: nextDetail,
  });
});

app.patch("/my/agents/:agentId", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }

  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail || detail.ownerId !== ownerId) {
    return c.json({ error: "Agent not found." }, 404);
  }

  const payload = updateAgentRequestSchema.parse(await c.req.json());
  const stub = getCoordinatorStub(c.env, detail.id);
  await stub.fetch("https://agent.internal/state", {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
  });

  const nextDetail = await repository.updatePlayerAgent({
    ownerId,
    agentId: detail.id,
    patch: payload,
  });
  return c.json(nextDetail);
});

app.post("/my/agents/:agentId/autonomy/enable", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }

  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail || detail.ownerId !== ownerId) {
    return c.json({ error: "Agent not found." }, 404);
  }

  const payload = enableAgentAutonomyRequestSchema.parse(await c.req.json());
  await repository.setPlayerAgentAutonomy({
    ownerId,
    agentId: detail.id,
    enabled: true,
    worldId: payload.worldId,
  });
  const nextDetail = await repository.setPlayerAgentSteering({
    ownerId,
    agentId: detail.id,
    worldId: payload.worldId,
    type: payload.steeringJobType,
    config: payload.steeringConfig,
  });
  return c.json(nextDetail);
});

app.post("/my/agents/:agentId/autonomy/disable", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }

  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail || detail.ownerId !== ownerId) {
    return c.json({ error: "Agent not found." }, 404);
  }

  const payload = disableAgentAutonomyRequestSchema.parse(await c.req.json());
  const updatedDetail = await repository.setPlayerAgentAutonomy({
    ownerId,
    agentId: detail.id,
    enabled: false,
    worldId: payload.worldId,
  });
  return c.json(updatedDetail);
});

app.post("/my/agents/:agentId/steering", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }

  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail || detail.ownerId !== ownerId) {
    return c.json({ error: "Agent not found." }, 404);
  }

  const payload = setSteeringJobRequestSchema.parse(await c.req.json());
  const nextDetail = await repository.setPlayerAgentSteering({
    ownerId,
    agentId: detail.id,
    worldId: payload.worldId,
    type: payload.steeringJobType,
    config: payload.steeringConfig,
  });
  return c.json(nextDetail);
});

app.post("/my/agents/:agentId/session/reset", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }

  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail) {
    return c.json({ error: "Agent not found." }, 404);
  }

  const payload = resetAgentSessionRequestSchema.parse(await c.req.json().catch(() => ({})));
  const nextPendingSession = await createPendingCartridgeSession({
    agentId: detail.id,
    authSessionId: crypto.randomUUID(),
    launchRequest: {
      worldId: payload.worldId ?? detail.worldId,
      worldName: (detail.runtimeConfig.metadata?.worldAuth as Record<string, unknown> | undefined)?.worldName as
        | string
        | undefined,
      chain: (detail.runtimeConfig.metadata?.worldAuth as Record<string, unknown> | undefined)?.chain as
        | "mainnet"
        | "sepolia"
        | "slot"
        | "slottest"
        | "local"
        | undefined,
      rpcUrl: (detail.runtimeConfig.metadata?.worldAuth as Record<string, unknown> | undefined)?.rpcUrl as
        | string
        | undefined,
      toriiBaseUrl: (detail.runtimeConfig.metadata?.worldAuth as Record<string, unknown> | undefined)?.toriiBaseUrl as
        | string
        | undefined,
    },
    callbackBaseUrl: resolveAuthCallbackBaseUrl(c.req.raw),
  });
  const nextDetail = await repository.resetPlayerAgentSession({
    ownerId,
    agentId: detail.id,
    nextAuthSession: nextPendingSession.authSession,
    nextSetupState: {
      status: "pending_auth",
      authUrl: nextPendingSession.authSession.authUrl,
    },
  });

  return c.json(nextDetail);
});

app.get("/my/agents/:agentId/events", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }
  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail) {
    return c.json({ error: "Agent not found." }, 404);
  }
  const afterSeq = c.req.query("afterSeq") ?? "0";
  const events = await repository.listPlayerAgentEvents({
    ownerId,
    agentId: detail.id,
    afterSeq: Number(afterSeq),
  });
  return streamAgentEvents(events);
});

app.get("/my/agents/:agentId/messages", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }
  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail) {
    return c.json({ error: "Agent not found." }, 404);
  }
  return c.json(
    myAgentMessagesResponseSchema.parse({
      messages: await repository.listPlayerAgentMessages(ownerId, detail.id),
    }),
  );
});

app.post("/my/agents/:agentId/messages", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }
  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail) {
    return c.json({ error: "Agent not found." }, 404);
  }

  const payload = postAgentMessageRequestSchema.parse(await c.req.json());
  const message = buildAgentMessage({
    agentId: detail.id,
    senderType: "owner",
    senderId: ownerId,
    content: payload.content,
    metadata: payload.metadata,
  });
  const savedMessage = await repository.appendPlayerAgentMessage({
    ownerId,
    agentId: detail.id,
    message,
  });
  return c.json(savedMessage, 201);
});

app.get("/my/agents/:agentId/history", async (c) => {
  const ownerId = resolveCurrentPlayerId(c.req.raw);
  if (!ownerId) {
    return c.json({ error: "Player identity required." }, 401);
  }
  const repository = getPlayerAgentRepository(c.env);
  const detail = await repository.getPlayerAgentDetail(ownerId, c.req.param("agentId"));
  if (!detail) {
    return c.json({ error: "Agent not found." }, 404);
  }

  return c.json(
    myAgentHistoryResponseSchema.parse({
      history: await repository.listPlayerAgentHistory(ownerId, detail.id),
    }),
  );
});

app.post("/agents", async (c) => {
  const payload = createAgentRequestSchema.parse(await c.req.json());
  const agentId = crypto.randomUUID();
  const detail = await initializeAgent(
    c.env,
    agentId,
    new Request("https://agent.internal", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
      },
    }),
  );

  const response = createAgentResponseSchema.parse({
    agentId,
    status: detail.executionState === "waiting_auth" ? "pending_auth" : "ready",
    ...(detail.executionState === "waiting_auth"
      ? {
          authSessionId: crypto.randomUUID(),
          authUrl: `https://auth.local/agents/${agentId}`,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        }
      : {}),
    detail,
  });

  if (detail.ownerType === "player") {
    const repository = getPlayerAgentRepository(c.env);
    const authSessionId = crypto.randomUUID();
    const pendingSession = await createPendingCartridgeSession({
      agentId: detail.id,
      authSessionId,
      launchRequest: {
        worldId: detail.worldId,
      },
      callbackBaseUrl: resolveAuthCallbackBaseUrl(c.req.raw),
    });
    const persistedDetail = await repository.launchPlayerAgent({
      ownerId: detail.ownerId,
      detail,
      baseUrl: resolveGatewayBaseUrl(c.req.raw),
      authSession: pendingSession.authSession,
    });
    response.detail = persistedDetail;
    response.status = buildLaunchStatus(persistedDetail) === "pending_auth" ? "pending_auth" : "ready";
    response.authUrl = persistedDetail.setup.authUrl;
    response.expiresAt = persistedDetail.setup.expiresAt;
    response.authSessionId = pendingSession.authSession.id;
  }

  return c.json(response, response.status === "ready" ? 201 : 202);
});

app.get("/agents/:agentId", async (c) => {
  const stub = getCoordinatorStub(c.env, c.req.param("agentId"));
  const response = await stub.fetch("https://agent.internal/state");
  return c.json(await response.json(), response.status as 200 | 404);
});

app.patch("/agents/:agentId", async (c) => {
  const payload = updateAgentRequestSchema.parse(await c.req.json());
  const stub = getCoordinatorStub(c.env, c.req.param("agentId"));
  const response = await stub.fetch("https://agent.internal/state", {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
  });
  return c.json(await response.json(), response.status as 200 | 404);
});

app.post("/agents/:agentId/prompt", async (c) => {
  const payload = postAgentMessageRequestSchema.parse(await c.req.json());
  const agentId = c.req.param("agentId");
  const stub = getCoordinatorStub(c.env, agentId);
  const promptMessage: AgentMessage = {
    id: crypto.randomUUID(),
    threadId: `thread:${agentId}`,
    senderType: "owner",
    senderId: "owner",
    content: payload.content,
    metadata: payload.metadata,
    createdAt: new Date().toISOString(),
  };

  await stub.fetch("https://agent.internal/messages", {
    method: "POST",
    body: JSON.stringify(promptMessage),
    headers: {
      "content-type": "application/json",
    },
  });

  const wakeEvent: AgentEvent = {
    id: crypto.randomUUID(),
    agentId,
    seq: 0,
    type: "user_prompt",
    payload: {
      messageId: promptMessage.id,
    },
    createdAt: new Date().toISOString(),
  };

  await stub.fetch("https://agent.internal/events", {
    method: "POST",
    body: JSON.stringify(wakeEvent),
    headers: {
      "content-type": "application/json",
    },
  });

  const leaseId = crypto.randomUUID();
  await stub.fetch("https://agent.internal/wake", {
    method: "POST",
    body: JSON.stringify({
      reason: "user_prompt",
      leaseId,
    }),
    headers: {
      "content-type": "application/json",
    },
  });

  if (c.env.AGENT_RUN_QUEUE) {
    await c.env.AGENT_RUN_QUEUE.send({
      jobId: crypto.randomUUID(),
      agentId,
      wakeReason: "user_prompt",
      coalescedEventIds: [wakeEvent.id],
      leaseId,
      priority: 0,
      requestedAt: new Date().toISOString(),
    });
  }

  return c.json({ accepted: true, agentId, leaseId }, 202);
});

app.post("/agents/:agentId/pause", async (c) => {
  const stub = getCoordinatorStub(c.env, c.req.param("agentId"));
  const response = await stub.fetch("https://agent.internal/desired-state", {
    method: "POST",
    body: JSON.stringify({ desiredState: "paused" }),
    headers: {
      "content-type": "application/json",
    },
  });
  return c.json(await response.json());
});

app.post("/agents/:agentId/resume", async (c) => {
  const agentId = c.req.param("agentId");
  const stub = getCoordinatorStub(c.env, agentId);
  await stub.fetch("https://agent.internal/desired-state", {
    method: "POST",
    body: JSON.stringify({ desiredState: "running" }),
    headers: {
      "content-type": "application/json",
    },
  });
  const leaseId = crypto.randomUUID();
  await stub.fetch("https://agent.internal/wake", {
    method: "POST",
    body: JSON.stringify({ reason: "manual_resume", leaseId }),
    headers: {
      "content-type": "application/json",
    },
  });
  if (c.env.AGENT_RUN_QUEUE) {
    await c.env.AGENT_RUN_QUEUE.send({
      jobId: crypto.randomUUID(),
      agentId,
      wakeReason: "manual_resume",
      coalescedEventIds: [],
      leaseId,
      priority: 1,
      requestedAt: new Date().toISOString(),
    });
  }
  return c.json({ accepted: true, agentId, leaseId }, 202);
});

app.post("/agents/:agentId/stop", async (c) => {
  const stub = getCoordinatorStub(c.env, c.req.param("agentId"));
  const response = await stub.fetch("https://agent.internal/desired-state", {
    method: "POST",
    body: JSON.stringify({ desiredState: "stopped" }),
    headers: {
      "content-type": "application/json",
    },
  });
  return c.json(await response.json());
});

app.get("/agents/:agentId/events", async (c) => {
  const stub = getCoordinatorStub(c.env, c.req.param("agentId"));
  const afterSeq = c.req.query("afterSeq") ?? "0";
  return stub.fetch(`https://agent.internal/events?stream=1&afterSeq=${afterSeq}`);
});

app.get("/agents/:agentId/messages", async (c) => {
  const stub = getCoordinatorStub(c.env, c.req.param("agentId"));
  const response = await stub.fetch("https://agent.internal/messages");
  return c.json(await response.json());
});

app.post("/agents/:agentId/messages", async (c) => {
  const payload = postAgentMessageRequestSchema.parse(await c.req.json());
  const agentId = c.req.param("agentId");
  const stub = getCoordinatorStub(c.env, agentId);
  const message: AgentMessage = {
    id: crypto.randomUUID(),
    threadId: `thread:${agentId}`,
    senderType: "owner",
    senderId: "owner",
    content: payload.content,
    metadata: payload.metadata,
    createdAt: new Date().toISOString(),
  };
  const response = await stub.fetch("https://agent.internal/messages", {
    method: "POST",
    body: JSON.stringify(message),
    headers: {
      "content-type": "application/json",
    },
  });
  return c.json(await response.json(), response.status as 201);
});

app.get("/models", (c) => {
  const configuredModels = (c.env.MODELS ?? "anthropic:claude-sonnet-4-20250514:Claude Sonnet 4")
    .split(",")
    .map((entry) => {
      const [provider, id, label] = entry.split(":");
      return {
        provider: provider?.trim() ?? "anthropic",
        id: id?.trim() ?? "claude-sonnet-4-20250514",
        label: label?.trim() ?? id?.trim() ?? "Model",
      };
    });

  return c.json(modelsResponseSchema.parse({ models: configuredModels }));
});

export default app;
