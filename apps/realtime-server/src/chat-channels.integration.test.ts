import { afterEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { PgDialect } from "drizzle-orm/pg-core";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import type { Context } from "hono";
import type { WSEvents } from "hono/ws";
import type { AppEnv } from "./http/middleware/auth";

const mocks = vi.hoisted(() => {
  for (const key of ["IDENTITY_URL", "HERALD_URL", "GAME_RPC_URL", "PLAYER_REGISTRY_ADDRESS"])
    process.env[key] = "test-only";
  return { events: undefined as WSEvents | undefined, where: vi.fn(), insert: vi.fn() };
});
vi.mock("hono/bun", () => ({
  websocket: {},
  upgradeWebSocket: (handler: (c: Context<AppEnv>) => WSEvents) => (c: Context<AppEnv>) => {
    mocks.events = handler(c);
    return c.text("upgraded");
  },
}));
vi.mock("./effect/runtime", () => ({ createRealtimeDependencies: () => ({}) }));
vi.mock("./services/retention", () => ({ startChatRetention: () => {} }));
vi.mock("./db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (filter: unknown) => {
          mocks.where(filter);
          return { orderBy: () => ({ limit: async () => [] }) };
        },
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        mocks.insert(row);
        return { returning: async () => [{ ...row, createdAt: new Date() }] };
      },
    }),
  },
}));

import { createRealtimeApp } from "./server";

const headers = {
  cookie: "better-auth.session_token=verified",
  origin: "http://localhost:5173",
  "content-type": "application/json",
};
const makeApp = (registered = false) => {
  const membership = {
    channelsForPlayer: vi.fn((_player: string) => Effect.succeed(new Set(["game:7"]))),
    isMember: vi.fn((_player: string, channel: string) => Effect.succeed(channel === "game:7")),
  };
  const app = createRealtimeApp({
    membership,
    sessions: {
      resolve: (cookie) =>
        Effect.succeed({ playerId: cookie, membershipPlayerId: registered ? cookie : null, aliases: [cookie] }),
    },
    security: {
      allowedOrigins: new Set([headers.origin]),
      globalConnectionCap: 20,
      perPlayerConnectionCap: 4,
      maxChannelsPerSocket: 8,
      maxMessageBytes: 8192,
      messagesPerSecond: 5,
      messageBurst: 10,
    },
  });
  return { app, membership };
};

const connect = async (app: ReturnType<typeof makeApp>["app"], player: string) => {
  await app.request("/ws", { headers: { ...headers, cookie: player } });
  const events = mocks.events!;
  const raw = { send: vi.fn() };
  const context = { raw, close: vi.fn() } as unknown as Parameters<NonNullable<WSEvents["onOpen"]>>[1];
  await events.onOpen!(new Event("open"), context);
  return { events, context, raw };
};

afterEach(() => vi.clearAllMocks());

describe("global and game chat HTTP and WebSocket integration", () => {
  it("lets signed-in players without a game account read and publish global history", async () => {
    const { app, membership } = makeApp();
    expect((await app.request(`/api/chat/world?zoneId=${GLOBAL_CHAT_CHANNEL_ID}`, { headers })).status).toBe(200);
    expect(new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).params).toEqual([GLOBAL_CHAT_CHANNEL_ID]);
    expect(
      (
        await app.request("/api/chat/world", {
          method: "POST",
          headers,
          body: JSON.stringify({ zoneId: GLOBAL_CHAT_CHANNEL_ID, content: "everyone" }),
        })
      ).status,
    ).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ zoneId: GLOBAL_CHAT_CHANNEL_ID, content: "everyone" }),
    );
    expect(membership.isMember).not.toHaveBeenCalled();
    expect(membership.channelsForPlayer).not.toHaveBeenCalled();
  });

  it("requires sign-in and keeps game histories private", async () => {
    const { app } = makeApp();
    expect((await app.request(`/api/chat/world?zoneId=${GLOBAL_CHAT_CHANNEL_ID}`)).status).toBe(401);
    expect(
      (
        await app.request("/api/chat/world", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ zoneId: GLOBAL_CHAT_CHANNEL_ID, content: "anonymous" }),
        })
      ).status,
    ).toBe(401);
    expect((await app.request("/api/chat/world?zoneId=game:7", { headers })).status).toBe(403);
    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("serves separate global and member-only game histories", async () => {
    const { app } = makeApp(true);
    expect((await app.request("/api/chat/world?zoneId=game:7", { headers })).status).toBe(200);
    expect(new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).params).toEqual(["game:7"]);
    expect((await app.request("/api/chat/world?zoneId=game:8", { headers })).status).toBe(403);
    expect(
      (
        await app.request("/api/chat/world", {
          method: "POST",
          headers,
          body: JSON.stringify({ zoneId: "game:8", content: "denied" }),
        })
      ).status,
    ).toBe(403);
    expect((await app.request(`/api/chat/world?zoneId=${GLOBAL_CHAT_CHANNEL_ID}`, { headers })).status).toBe(200);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("automatically joins unrelated signed-in players to the same live global stream", async () => {
    const { app, membership } = makeApp();
    const alice = await connect(app, "alice");
    const bob = await connect(app, "bob");
    expect(alice.raw.send.mock.calls.map(([value]) => JSON.parse(value))).toContainEqual(
      expect.objectContaining({ type: "connected", channels: [GLOBAL_CHAT_CHANNEL_ID] }),
    );
    await alice.events.onMessage!(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "world:publish",
          zoneId: GLOBAL_CHAT_CHANNEL_ID,
          payload: { zoneId: GLOBAL_CHAT_CHANNEL_ID, content: "hello Bob" },
        }),
      }),
      alice.context,
    );
    for (const socket of [alice.raw, bob.raw])
      expect(socket.send.mock.calls.map(([value]) => JSON.parse(value))).toContainEqual(
        expect.objectContaining({
          type: "world:message",
          zoneId: GLOBAL_CHAT_CHANNEL_ID,
          message: expect.objectContaining({ content: "hello Bob" }),
        }),
      );
    expect(membership.isMember).not.toHaveBeenCalled();
    expect(membership.channelsForPlayer).not.toHaveBeenCalled();
  });
  it("delivers a game message only to that game's members and refuses other games", async () => {
    const { app, membership } = makeApp(true);
    membership.channelsForPlayer.mockImplementation((player: string) =>
      Effect.succeed(new Set([player === "alice" ? "game:7" : "game:8"])),
    );
    const alice = await connect(app, "alice");
    const bob = await connect(app, "bob");
    const publish = (zoneId: string) =>
      alice.events.onMessage!(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "world:publish", zoneId, payload: { zoneId, content: "only my game" } }),
        }),
        alice.context,
      );
    await publish("game:7");
    expect(alice.raw.send.mock.calls.map(([value]) => JSON.parse(value))).toContainEqual(
      expect.objectContaining({ type: "world:message", zoneId: "game:7" }),
    );
    expect(
      bob.raw.send.mock.calls.map(([value]) => JSON.parse(value)).some((message) => message.type === "world:message"),
    ).toBe(false);
    await publish("game:8");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(alice.raw.send.mock.calls.map(([value]) => JSON.parse(value))).toContainEqual(
      expect.objectContaining({ type: "error", code: "channel_not_joined" }),
    );
  });
  it("keeps Global usable when the game membership lookup fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { app, membership } = makeApp(true);
      membership.channelsForPlayer.mockImplementationOnce(() => {
        throw new Error("Herald unavailable");
      });
      const alice = await connect(app, "alice");
      expect(alice.raw.send.mock.calls.map(([value]) => JSON.parse(value))).toContainEqual(
        expect.objectContaining({ type: "connected", channels: [GLOBAL_CHAT_CHANNEL_ID] }),
      );
      expect(alice.context.close).not.toHaveBeenCalled();
      await alice.events.onMessage!(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "world:publish",
            zoneId: GLOBAL_CHAT_CHANNEL_ID,
            payload: { zoneId: GLOBAL_CHAT_CHANNEL_ID, content: "still connected" },
          }),
        }),
        alice.context,
      );
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({ zoneId: GLOBAL_CHAT_CHANNEL_ID, content: "still connected" }),
      );
      expect(logged).toHaveBeenCalledWith("realtime_game_membership_failed", expect.any(Error));
    } finally {
      logged.mockRestore();
    }
  });
});
