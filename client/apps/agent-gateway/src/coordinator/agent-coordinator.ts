import type {
  AgentDesiredState,
  AgentDetail,
  AgentEvent,
  AgentExecutionState,
  AgentMessage,
  AgentWakeReason,
} from "@bibliothecadao/types";
import {
  agentEventSchema,
  agentMessageSchema,
  createAgentRequestSchema,
  updateAgentRequestSchema,
} from "@bibliothecadao/types";

import type { AgentCoordinatorStateSnapshot, DurableObjectStateLike } from "../types";

const STATE_KEY = "state";
const EVENTS_KEY = "events";
const MESSAGES_KEY = "messages";

export class AgentCoordinatorDO {
  constructor(private readonly state: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/initialize") {
      const payload = createAgentRequestSchema.parse(await request.json());
      const agentId = url.searchParams.get("agentId");
      if (!agentId) {
        return Response.json({ error: "agentId is required." }, { status: 400 });
      }

      const detail: AgentDetail = {
        id: agentId,
        kind: payload.kind,
        ownerType: payload.ownerType,
        ownerId: payload.ownerId,
        worldId: payload.worldId,
        displayName: payload.displayName,
        desiredState: "running",
        executionState: payload.authMode === "player_session" && payload.kind === "player" ? "waiting_auth" : "idle",
        modelProvider: payload.modelProvider,
        modelId: payload.modelId,
        authMode: payload.authMode,
        runtimeConfig: payload.runtimeConfig ?? {},
        subscriptions: payload.subscriptions ?? [],
      };

      await this.state.storage.put(STATE_KEY, {
        detail,
        eventSeq: 0,
      } satisfies AgentCoordinatorStateSnapshot);
      await this.state.storage.put(EVENTS_KEY, [] satisfies AgentEvent[]);
      await this.state.storage.put(MESSAGES_KEY, [] satisfies AgentMessage[]);
      return Response.json(detail, { status: 201 });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      const snapshot = await this.loadState();
      return Response.json(snapshot.detail);
    }

    if (request.method === "PATCH" && url.pathname === "/state") {
      const patch = updateAgentRequestSchema.parse(await request.json());
      const snapshot = await this.loadState();
      const detail: AgentDetail = {
        ...snapshot.detail,
        ...("displayName" in patch && patch.displayName ? { displayName: patch.displayName } : {}),
        ...("desiredState" in patch && patch.desiredState ? { desiredState: patch.desiredState } : {}),
        ...("modelProvider" in patch && patch.modelProvider ? { modelProvider: patch.modelProvider } : {}),
        ...("modelId" in patch && patch.modelId ? { modelId: patch.modelId } : {}),
        runtimeConfig: patch.runtimeConfig ?? snapshot.detail.runtimeConfig,
        subscriptions: patch.subscriptions ?? snapshot.detail.subscriptions,
      };

      await this.state.storage.put(STATE_KEY, {
        ...snapshot,
        detail,
      } satisfies AgentCoordinatorStateSnapshot);
      return Response.json(detail);
    }

    if (request.method === "POST" && url.pathname === "/events") {
      const event = agentEventSchema.parse(await request.json());
      const snapshot = await this.loadState();
      const currentEvents = (await this.state.storage.get<AgentEvent[]>(EVENTS_KEY)) ?? [];
      if (currentEvents.some((currentEvent) => currentEvent.id === event.id)) {
        return Response.json({
          deduped: true,
          seq: currentEvents.find((currentEvent) => currentEvent.id === event.id)?.seq,
        });
      }

      const nextEvent: AgentEvent = {
        ...event,
        seq: snapshot.eventSeq + 1,
      };

      await this.state.storage.put(EVENTS_KEY, [...currentEvents, nextEvent]);
      await this.state.storage.put(STATE_KEY, {
        ...snapshot,
        eventSeq: nextEvent.seq,
      } satisfies AgentCoordinatorStateSnapshot);
      return Response.json(nextEvent, { status: 201 });
    }

    if (request.method === "GET" && url.pathname === "/events") {
      const afterSeq = Number(url.searchParams.get("afterSeq") ?? "0");
      const events = ((await this.state.storage.get<AgentEvent[]>(EVENTS_KEY)) ?? []).filter(
        (event) => event.seq > afterSeq,
      );
      if (url.searchParams.get("stream") === "1") {
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
      return Response.json({ events });
    }

    if (request.method === "POST" && url.pathname === "/messages") {
      const message = agentMessageSchema.parse(await request.json());
      const messages = (await this.state.storage.get<AgentMessage[]>(MESSAGES_KEY)) ?? [];
      await this.state.storage.put(MESSAGES_KEY, [...messages, message]);
      return Response.json(message, { status: 201 });
    }

    if (request.method === "GET" && url.pathname === "/messages") {
      const messages = (await this.state.storage.get<AgentMessage[]>(MESSAGES_KEY)) ?? [];
      return Response.json({ messages });
    }

    if (request.method === "POST" && url.pathname === "/desired-state") {
      const payload = (await request.json()) as { desiredState: AgentDesiredState };
      const snapshot = await this.loadState();
      const detail = {
        ...snapshot.detail,
        desiredState: payload.desiredState,
      };
      await this.state.storage.put(STATE_KEY, {
        ...snapshot,
        detail,
      } satisfies AgentCoordinatorStateSnapshot);
      return Response.json(detail);
    }

    if (request.method === "POST" && url.pathname === "/wake") {
      const payload = (await request.json()) as { reason: AgentWakeReason; leaseId?: string };
      const snapshot = await this.loadState();
      const executionState: AgentExecutionState = snapshot.detail.executionState === "running" ? "running" : "queued";
      const detail = {
        ...snapshot.detail,
        executionState,
      };
      await this.state.storage.put(STATE_KEY, {
        ...snapshot,
        detail,
        currentRunLeaseId: payload.leaseId ?? snapshot.currentRunLeaseId,
      } satisfies AgentCoordinatorStateSnapshot);
      return Response.json({
        queued: true,
        reason: payload.reason,
        leaseId: payload.leaseId ?? snapshot.currentRunLeaseId,
      });
    }

    return Response.json({ error: "Not found." }, { status: 404 });
  }

  private async loadState(): Promise<AgentCoordinatorStateSnapshot> {
    const snapshot = await this.state.storage.get<AgentCoordinatorStateSnapshot>(STATE_KEY);
    if (!snapshot) {
      throw new Error("Agent coordinator state is not initialized.");
    }
    return snapshot;
  }
}
