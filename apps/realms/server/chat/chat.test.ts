import { beforeAll, expect, it } from "vitest";

import {
  buildWorkerBundle,
  deviceKeys,
  migrationStatements,
  newStorage,
  startWorker,
  vapidKeys,
  pause,
  waitUntil,
  WORKER_NAME,
} from "../workerd-harness";

/**
 * Chat as Cloudflare runs it: the Worker admits sockets by session and membership, rooms and inboxes are Durable
 * Objects, and the shard's Herald answers who plays which game. Billing cannot be measured locally; an idle room's cost
 * rests on the room using the hibernation API only, and eviction with hibernated sockets is exercised below.
 */
const ORIGIN = "https://staging.realms.party";
const SHARD = "https://shard-a.test";
const CHAIN_ID = "0xa";
const ROOM = `game:${CHAIN_ID}:1`;

let bundle: string;
beforeAll(() => {
  bundle = buildWorkerBundle();
}, 180_000);

type Worker = Awaited<ReturnType<typeof startWorker>>;

/** A new player in a browser, signed in with an emailed code. */
let players = 0;
const signIn = (worker: Worker) => worker.signInWithEmailCode(`player-${(players += 1)}@realms.test`);

/** A socket to a chat path, with every message it receives. */
const connect = async (worker: Worker, cookie: string, path: string) => {
  const response = await worker.mf.dispatchFetch(`${ORIGIN}${path}`, {
    headers: { upgrade: "websocket", cookie, origin: ORIGIN },
  });
  const socket = response.webSocket;
  if (!socket) return { status: response.status, received: [] as Record<string, unknown>[] };
  socket.accept();
  const received: Record<string, unknown>[] = [];
  socket.addEventListener("message", (event) => received.push(JSON.parse(event.data as string)));
  return { status: response.status, socket, received };
};

const ofType = (received: Record<string, unknown>[], type: string) =>
  received.filter((message) => message.type === type);

it("lets two players chat in their Blitz room, keeps its history, survives eviction, and refuses a stranger", async () => {
  const registered = new Set<string>();
  const worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: (request) => {
      const url = new URL(request.url);
      if (url.origin !== SHARD || url.pathname !== "/games") return new Response("unexpected", { status: 599 });
      const player = url.searchParams.get("player") ?? "";
      return Response.json({
        chain: CHAIN_ID,
        confirmed_block: 1,
        games: [
          {
            game_id: 1,
            name: "blitz-a",
            mode: "blitz",
            status: "Live",
            player_state: { registered: registered.has(player), settled: false, roster_member: registered.has(player) },
          },
        ],
      });
    },
  });
  await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
  await worker.db
    .prepare(`INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES (?, ?, 'active', ?)`)
    .bind(SHARD, CHAIN_ID, Date.now())
    .run();

  const [first, second, stranger] = [await signIn(worker), await signIn(worker), await signIn(worker)];
  for (const [player, address] of [
    [first, "0xa1"],
    [second, "0xb2"],
    [stranger, "0xc3"],
  ] as const) {
    await worker.db
      .prepare(`INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?)`)
      .bind(address, player.realmsId)
      .run();
  }
  registered.add("0xa1").add("0xb2");

  expect((await connect(worker, stranger.cookie, `/api/chat/rooms/${encodeURIComponent(ROOM)}`)).status).toBe(403);

  const inbox = await connect(worker, first.cookie, "/api/chat/inbox");
  await waitUntil(() => ofType(inbox.received, "connected").length > 0, 5_000);
  expect(ofType(inbox.received, "connected")[0]!.channels).toEqual(["world:global", ROOM]);

  const one = await connect(worker, first.cookie, `/api/chat/rooms/${encodeURIComponent(ROOM)}`);
  const two = await connect(worker, second.cookie, `/api/chat/rooms/${encodeURIComponent(ROOM)}`);
  await waitUntil(() => ofType(one.received, "presence:update").length > 0, 5_000);
  expect(ofType(one.received, "presence:update")[0]!.player).toMatchObject({ playerId: second.realmsId });

  const publish = (content: string) =>
    one.socket!.send(
      JSON.stringify({
        type: "world:publish",
        zoneId: ROOM,
        payload: { zoneId: ROOM, content },
        clientMessageId: content,
      }),
    );
  publish("hold the ford");
  await waitUntil(() => ofType(two.received, "world:message").length > 0, 5_000);
  expect(ofType(two.received, "world:message")[0]!.message).toMatchObject({
    content: "hold the ford",
    sender: { playerId: first.realmsId },
  });

  two.socket!.close();
  const history = (await (
    await worker.mf.dispatchFetch(`${ORIGIN}/api/chat/world?zoneId=${encodeURIComponent(ROOM)}`, {
      headers: { cookie: second.cookie },
    })
  ).json()) as { messages: { content: string }[] };
  expect(history.messages.map((message) => message.content)).toEqual(["hold the ford"]);

  const back = await connect(worker, second.cookie, `/api/chat/rooms/${encodeURIComponent(ROOM)}`);
  await waitUntil(() => ofType(back.received, "presence:sync").length > 0, 5_000);
  await worker.mf.unsafeEvictDurableObject(WORKER_NAME, "ChatRoom", { name: ROOM, webSockets: "hibernate" });
  publish("the room woke");
  await waitUntil(() => ofType(back.received, "world:message").length > 0, 5_000);
  expect(ofType(back.received, "world:message")[0]!.message).toMatchObject({ content: "the room woke" });

  const secondInbox = await connect(worker, second.cookie, "/api/chat/inbox");
  await waitUntil(() => ofType(secondInbox.received, "connected").length > 0, 5_000);
  inbox.socket!.send(
    JSON.stringify({ type: "direct:message", payload: { recipientId: second.realmsId, content: "meet at dawn" } }),
  );
  await waitUntil(() => ofType(secondInbox.received, "direct:message").length > 0, 5_000);
  const direct = ofType(secondInbox.received, "direct:message")[0]!.message as { threadId: string; content: string };
  expect(direct.content).toBe("meet at dawn");
  const thread = (await (
    await worker.mf.dispatchFetch(`${ORIGIN}/api/chat/dm/threads/${encodeURIComponent(direct.threadId)}/messages`, {
      headers: { cookie: second.cookie },
    })
  ).json()) as { messages: { content: string }[] };
  expect(thread.messages.map((message) => message.content)).toEqual(["meet at dawn"]);

  await worker.dispose();
}, 120_000);

it("drops a blocked player's direct messages before socket and push, and delivers again after unblocking", async () => {
  const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/blocking-device";
  const pushes: string[] = [];
  const worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: (request) => {
      if (request.url === PUSH_ENDPOINT) pushes.push(request.url);
      return new Response(null, { status: request.url === PUSH_ENDPOINT ? 201 : 599 });
    },
  });
  await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
  const [sender, recipient] = [await signIn(worker), await signIn(worker)];
  const device = await deviceKeys();
  await worker.db.batch([
    worker.db
      .prepare(`INSERT INTO "notification_preferences" ("owner", "level", "revision") VALUES (?, 'important', 1)`)
      .bind(recipient.realmsId),
    worker.db
      .prepare(
        `INSERT INTO "notification_push_subscriptions" ("id", "owner", "endpoint", "p256dh", "auth", "revocationHash", "directMessagesEnabledAt", "createdAt") VALUES ('device-1', ?, ?, ?, ?, 'x', ?, ?)`,
      )
      .bind(recipient.realmsId, PUSH_ENDPOINT, device.p256dh, device.auth, Date.now(), Date.now()),
  ]);
  const blocks = (method: string, path = "", body?: unknown) =>
    worker.mf
      .dispatchFetch(`${ORIGIN}/api/chat/blocks${path}`, {
        method,
        headers: { cookie: recipient.cookie, origin: ORIGIN, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      .then((response) => response.json() as Promise<{ blocked: string[] }>);
  expect(await blocks("POST", "", { realmsId: sender.realmsId })).toEqual({ blocked: [sender.realmsId] });

  const outbox = await connect(worker, sender.cookie, "/api/chat/inbox");
  await waitUntil(() => ofType(outbox.received, "connected").length > 0, 5_000);
  const send = (content: string) =>
    outbox.socket!.send(
      JSON.stringify({ type: "direct:message", payload: { recipientId: recipient.realmsId, content } }),
    );
  const echoes = () => ofType(outbox.received, "direct:message").length;

  // Blocked, with the recipient's socket open and then with only its device: nothing arrives, and the sender sees the
  // same echo it always does.
  const inbox = await connect(worker, recipient.cookie, "/api/chat/inbox");
  await waitUntil(() => ofType(inbox.received, "connected").length > 0, 5_000);
  send("are you there");
  await waitUntil(() => echoes() >= 1, 5_000);
  inbox.socket!.close();
  send("answer me");
  await waitUntil(() => echoes() >= 2, 5_000);
  await pause(1_500);
  expect(echoes()).toBe(2);
  expect(ofType(inbox.received, "direct:message")).toEqual([]);
  expect(pushes).toEqual([]);

  expect(await blocks("DELETE", `/${encodeURIComponent(sender.realmsId)}`)).toEqual({ blocked: [] });
  send("sorry");
  await waitUntil(() => pushes.length >= 1, 10_000);
  expect(pushes).toEqual([PUSH_ENDPOINT]);
  const reopened = await connect(worker, recipient.cookie, "/api/chat/inbox");
  await waitUntil(() => ofType(reopened.received, "connected").length > 0, 5_000);
  send("hello again");
  await waitUntil(() => ofType(reopened.received, "direct:message").length > 0, 5_000);
  expect(ofType(reopened.received, "direct:message")[0]!.message).toMatchObject({ content: "hello again" });

  await worker.dispose();
}, 120_000);
