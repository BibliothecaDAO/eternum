import { beforeAll, expect, it } from "vitest";

import type { ChatInbox } from "./chat/chat-inbox";

import {
  buildWorkerBundle,
  migrationStatements,
  newStorage,
  ORIGIN,
  startWorker,
  vapidKeys,
  waitUntil,
} from "./workerd-harness";

/**
 * Deleting an account as Cloudflare runs it: the Worker, its D1 and the chat inboxes in workerd. The emailed code is
 * the account's confirmation; once it is spent, the old session opens nothing and the account's rows are gone, except
 * the ledger's and the campaign's, which stay keyed to an anonymous tombstone.
 */
let bundle: string;
beforeAll(() => {
  bundle = buildWorkerBundle();
}, 180_000);

type Worker = Awaited<ReturnType<typeof startWorker>>;

const LEAVING = "leaving@realms.test";

const request = (worker: Worker, cookie: string, path: string, init: { method?: string; body?: unknown } = {}) =>
  worker.mf.dispatchFetch(`${ORIGIN}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

const deleteAccount = (worker: Worker, cookie: string, otp: string) =>
  request(worker, cookie, "/api/account", { method: "DELETE", body: { otp } });

/** A fresh deletion code, sent to the account's email as the Settings row asks for it. */
const deletionCode = async (worker: Worker, cookie: string) => {
  const sent = await request(worker, cookie, "/api/auth/email-otp/send-verification-otp", {
    body: { email: LEAVING, type: "sign-in" },
  });
  expect(sent.status).toBe(200);
  return worker.sentCode(LEAVING)!;
};

/** What the leaving account owns and what the deletion keeps, written as the services that own each row write it. */
const seedAccount = (worker: Worker, realmsId: string) =>
  worker.db.batch([
    worker.db
      .prepare(`INSERT INTO "notification_preferences" ("owner", "level", "revision") VALUES (?, 'all', 1)`)
      .bind(realmsId),
    worker.db
      .prepare(
        `INSERT INTO "notification_push_subscriptions" ("id", "owner", "endpoint", "p256dh", "auth", "revocationHash", "createdAt")
         VALUES ('leaving-phone', ?, 'https://fcm.googleapis.com/fcm/send/leaving-phone', 'p', 'a', 'x', ?)`,
      )
      .bind(realmsId, Date.now()),
    worker.db.prepare(`INSERT INTO "build_order_books" ("owner", "book") VALUES (?, '{}')`).bind(realmsId),
    worker.db.prepare(
      `INSERT INTO "campaign_codes" ("campaign", "code_hash", "tier") VALUES ('devcon-2026', 'golden-hash', 'golden')`,
    ),
    worker.db
      .prepare(
        `INSERT INTO "campaign_tickets" ("campaign", "owner", "code_hash", "tier", "redeemed_at")
         VALUES ('devcon-2026', ?, 'golden-hash', 'golden', 1)`,
      )
      .bind(realmsId),
    worker.db
      .prepare(`INSERT INTO "wallet_link_history" ("account", "wallet", "linked_at") VALUES (?, '0xabc', 1)`)
      .bind(realmsId),
  ]);

const countOf = async (worker: Worker, table: string, column: string, value: string) =>
  (await worker.db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE "${column}" = ?`).bind(value).first<{
    n: number;
  }>())!.n;

it("deletes an account only with its emailed code: its old session opens nothing and its push rows are gone", async () => {
  const worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: () => new Response(null, { status: 599 }),
  });
  await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
  const leaving = await worker.signInWithEmailCode(LEAVING);
  const friend = await worker.signInWithEmailCode("friend@realms.test");
  await seedAccount(worker, leaving.realmsId);
  const threadId = await directMessage(worker, friend.cookie, leaving.realmsId);
  const inboxes = await worker.mf.getDurableObjectNamespace("CHAT_INBOX");
  // Miniflare's namespace is untyped; the inbox is the Worker's own ChatInbox.
  const inbox = inboxes.get(inboxes.idFromName(leaving.realmsId)) as unknown as Pick<ChatInbox, "threadMessages">;
  expect(await inbox.threadMessages(threadId, undefined, 10)).not.toBeNull();

  // No session, or a wrong code: nothing is deleted.
  expect((await deleteAccount(worker, "", "123456")).status).toBe(401);
  const code = await deletionCode(worker, leaving.cookie);
  const wrong = await deleteAccount(worker, leaving.cookie, String((Number(code) + 1) % 1_000_000).padStart(6, "0"));
  expect(wrong.status).toBe(400);
  expect(await wrong.json()).toMatchObject({ code: "INVALID_OTP" });
  expect(await sessionOf(worker, leaving.cookie)).not.toBeNull();

  const deleted = await deleteAccount(worker, leaving.cookie, code);
  expect(deleted.status).toBe(200);
  expect(await deleted.json()).toEqual({ deleted: true });

  // The old session opens nothing, the code is spent, and the account's rows are gone.
  expect(await sessionOf(worker, leaving.cookie)).toBeNull();
  expect((await request(worker, leaving.cookie, "/api/notifications/preferences")).status).toBe(401);
  expect((await request(worker, leaving.cookie, "/api/chat/blocks")).status).toBe(401);
  expect((await deleteAccount(worker, leaving.cookie, code)).status).toBe(401);
  expect(await countOf(worker, "notification_push_subscriptions", "owner", leaving.realmsId)).toBe(0);
  expect(await countOf(worker, "notification_preferences", "owner", leaving.realmsId)).toBe(0);
  expect(await countOf(worker, "build_order_books", "owner", leaving.realmsId)).toBe(0);
  expect(await countOf(worker, "user", "email", LEAVING)).toBe(0);
  expect(await inbox.threadMessages(threadId, undefined, 10)).toBeNull();
  expect(
    await worker.db
      .prepare(`SELECT "chat_closed_at" IS NOT NULL AS closed FROM "account_deletions" WHERE "realms_id" = ?`)
      .bind(leaving.realmsId)
      .first(),
  ).toEqual({ closed: 1 });

  // The ledger's and the campaign's rows stay, with an anonymous tombstone their Realms id still names.
  expect(await countOf(worker, "campaign_tickets", "owner", leaving.realmsId)).toBe(1);
  expect(
    await worker.db
      .prepare(`SELECT "replaced_at" IS NOT NULL AS closed FROM "wallet_link_history" WHERE "account" = ?`)
      .bind(leaving.realmsId)
      .first(),
  ).toEqual({ closed: 1 });
  expect(
    await worker.db
      .prepare(`SELECT "email", "emailVerified", "name" = "id" AS unnamed FROM "user" WHERE "realmsId" = ?`)
      .bind(leaving.realmsId)
      .first(),
  ).toMatchObject({ emailVerified: 0, unnamed: 1, email: expect.stringMatching(/^deleted:/) });

  // The same email signs in later to a new account, with a new Realms id.
  const returning = await worker.signInWithEmailCode(LEAVING);
  expect(returning.realmsId).not.toBe(leaving.realmsId);

  await worker.dispose();
}, 120_000);

const sessionOf = async (worker: Worker, cookie: string) =>
  (await request(worker, cookie, "/api/auth/get-session")).json();

/** The friend writes to the leaving account, so its inbox holds a conversation; the thread's id. */
const directMessage = async (worker: Worker, cookie: string, recipientId: string) => {
  const response = await worker.mf.dispatchFetch(`${ORIGIN}/api/chat/inbox`, {
    headers: { upgrade: "websocket", cookie, origin: ORIGIN },
  });
  const socket = response.webSocket!;
  socket.accept();
  const echoes: { message: { threadId: string } }[] = [];
  socket.addEventListener("message", (event) => {
    const frame = JSON.parse(event.data as string) as { type: string; message: { threadId: string } };
    if (frame.type === "direct:message") echoes.push(frame);
  });
  socket.send(JSON.stringify({ type: "direct:message", payload: { recipientId, content: "farewell" } }));
  await waitUntil(() => echoes.length > 0, 5_000);
  socket.close();
  return echoes[0]!.message.threadId;
};

type Frame = Record<string, unknown> & { type: string };

/** A chat socket opened with a session, and its frames. */
const openChat = async (worker: Worker, cookie: string, path: string) => {
  const response = await worker.mf.dispatchFetch(`${ORIGIN}${path}`, {
    headers: { upgrade: "websocket", cookie, origin: ORIGIN },
  });
  const socket = response.webSocket;
  if (!socket) throw new Error(`no socket at ${path}: ${response.status}`);
  socket.accept();
  const frames: Frame[] = [];
  socket.addEventListener("message", (event) => frames.push(JSON.parse(event.data as string) as Frame));
  await waitUntil(() => frames.length > 0, 5_000);
  return { socket, frames };
};

const ofType = (frames: Frame[], type: string) => frames.filter((frame) => frame.type === type);

const publish = (socket: { send(data: string): void }, room: string, content: string) =>
  socket.send(JSON.stringify({ type: "world:publish", zoneId: room, payload: { zoneId: room, content } }));

/** Waits a while for frames of a type that should not come. */
const noneArrive = async (frames: Frame[], type: string) => {
  await waitUntil(() => ofType(frames, type).length > 0, 2_000);
  expect(ofType(frames, type)).toEqual([]);
};

const roomPath = (room: string) => `/api/chat/rooms/${encodeURIComponent(room)}`;
const GLOBAL = "world:global";

it("review: a deleted account cannot publish through an already-open room socket", async () => {
  const worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: () => new Response(null, { status: 599 }),
  });
  let socket: { send(data: string): void; close(): void } | undefined;
  try {
    await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
    const leaving = await worker.signInWithEmailCode(LEAVING);
    const room = await openChat(worker, leaving.cookie, roomPath(GLOBAL));
    socket = room.socket;
    const sent = room.socket;
    const deleted = await deleteAccount(worker, leaving.cookie, await deletionCode(worker, leaving.cookie));
    expect(deleted.status).toBe(200);
    expect(await sessionOf(worker, leaving.cookie)).toBeNull();
    sent.send(
      JSON.stringify({
        type: "world:publish",
        zoneId: GLOBAL,
        clientMessageId: "after-delete",
        payload: { zoneId: GLOBAL, content: "published after account deletion" },
      }),
    );
    await waitUntil(() => room.frames.some((frame) => frame.type === "world:message"), 2000);
    expect(room.frames.filter((frame) => frame.type === "world:message")).toEqual([]);
  } finally {
    socket?.close();
    await worker.dispose();
  }
}, 120_000);

it("review: another player cannot recreate the deleted account's private inbox", async () => {
  const worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: () => new Response(null, { status: 599 }),
  });
  try {
    await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
    const leaving = await worker.signInWithEmailCode(LEAVING);
    const friend = await worker.signInWithEmailCode("peer-after-delete@realms.test");
    const oldThread = await directMessage(worker, friend.cookie, leaving.realmsId);
    const inboxes = await worker.mf.getDurableObjectNamespace("CHAT_INBOX");
    const inbox = inboxes.get(inboxes.idFromName(leaving.realmsId)) as unknown as Pick<ChatInbox, "threadMessages">;
    expect((await deleteAccount(worker, leaving.cookie, await deletionCode(worker, leaving.cookie))).status).toBe(200);
    expect((await inbox.threadMessages(oldThread, undefined, 10)) === null).toBe(true);
    await directMessage(worker, friend.cookie, leaving.realmsId);
    expect((await inbox.threadMessages(oldThread, undefined, 10)) === null).toBe(true);
  } finally {
    await worker.dispose();
  }
}, 120_000);

const SHARD = "https://shard-a.test";
const CHAIN_ID = "0xa";
const GAME_ROOM = `game:${CHAIN_ID}:1`;
const LOBBY = "slot:0xa:blitz-noon";

/** The shard's Herald, which places every account in game 1, live; and the launch directory's slot for the lobby. */
const gameAndLobby = {
  outbound: (request: Request) => {
    const url = new URL(request.url);
    if (url.origin !== SHARD || url.pathname !== "/games") return new Response(null, { status: 599 });
    return Response.json({
      chain: CHAIN_ID,
      confirmed_block: 1,
      games: [
        {
          game_id: 1,
          name: "blitz-a",
          mode: "blitz",
          status: "Live",
          player_state: {
            registered: true,
            settled: false,
            roster_wallet: "0x123",
            held_realm_id: null,
            has_home_source: false,
            taken_realm_ids: [],
          },
        },
      ],
    });
  },
  launchDirectory: () => Response.json({ name: "blitz-noon", chainId: CHAIN_ID, slotId: 7 }),
};

it("closes a deleted account's open sockets in Global, its game's room and a lobby, and admits none again", async () => {
  const worker = await startWorker({ bundle, storage: newStorage(), vapid: await vapidKeys(), ...gameAndLobby });
  try {
    await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
    await worker.db
      .prepare(`INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES (?, ?, 'active', ?)`)
      .bind(SHARD, CHAIN_ID, Date.now())
      .run();
    const leaving = await worker.signInWithEmailCode(LEAVING);
    const watcher = await worker.signInWithEmailCode("watcher@realms.test");
    for (const [player, address] of [
      [leaving, "0xa1"],
      [watcher, "0xb2"],
    ] as const) {
      await worker.db
        .prepare(`INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?)`)
        .bind(address, player.realmsId)
        .run();
    }
    const rooms = [GLOBAL, GAME_ROOM, LOBBY];
    const watching = await Promise.all(rooms.map((room) => openChat(worker, watcher.cookie, roomPath(room))));
    const open = await Promise.all(
      rooms.map(async (room) => ({ room, ...(await openChat(worker, leaving.cookie, roomPath(room))) })),
    );
    await waitUntil(() => watching.every(({ frames }) => ofType(frames, "presence:update").length > 0), 5_000);
    const code = await deletionCode(worker, leaving.cookie);

    expect((await deleteAccount(worker, leaving.cookie, code)).status).toBe(200);
    // Each room closed the account's socket, and everyone still there is told it left, once.
    await waitUntil(() => watching.every(({ frames }) => ofType(frames, "presence:remove").length > 0), 5_000);
    for (const { frames } of watching)
      expect(ofType(frames, "presence:remove")).toEqual([{ type: "presence:remove", playerId: leaving.realmsId }]);
    // What the old sockets still send reaches nobody.
    for (const { socket, room } of open) publish(socket, room, "after deletion");
    for (const { frames } of watching) await noneArrive(frames, "world:message");
    // Its old session opens no room again.
    for (const room of rooms) {
      const again = await worker.mf.dispatchFetch(`${ORIGIN}${roomPath(room)}`, {
        headers: { upgrade: "websocket", cookie: leaving.cookie, origin: ORIGIN },
      });
      expect(again.status).toBe(401);
    }
    for (const { socket } of [...watching, ...open]) socket.close();
  } finally {
    await worker.dispose();
  }
}, 120_000);

it("finishes a deletion stopped between its transaction and chat: the cron closes chat once, and peers' messages stay out", async () => {
  const worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: () => new Response(null, { status: 599 }),
  });
  try {
    await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
    const leaving = await worker.signInWithEmailCode(LEAVING);
    const friend = await worker.signInWithEmailCode("friend@realms.test");
    const thread = await directMessage(worker, friend.cookie, leaving.realmsId);
    const friendRoom = await openChat(worker, friend.cookie, roomPath(GLOBAL));
    const friendInbox = await openChat(worker, friend.cookie, "/api/chat/inbox");
    const room = await openChat(worker, leaving.cookie, roomPath(GLOBAL));
    const own = await openChat(worker, leaving.cookie, "/api/chat/inbox");
    await waitUntil(() => ofType(friendRoom.frames, "presence:update").length > 0, 5_000);
    // What the deletion's transaction leaves when the Worker stops before its chat step: no session, the deletion
    // recorded, chat still open.
    await worker.db.batch([
      worker.db
        .prepare(`DELETE FROM "session" WHERE "userId" = (SELECT "id" FROM "user" WHERE "realmsId" = ?)`)
        .bind(leaving.realmsId),
      worker.db
        .prepare(`INSERT INTO "account_deletions" ("realms_id", "deleted_at") VALUES (?, ?)`)
        .bind(leaving.realmsId, Date.now()),
    ]);
    const inboxes = await worker.mf.getDurableObjectNamespace("CHAT_INBOX");
    const inbox = inboxes.get(inboxes.idFromName(leaving.realmsId)) as unknown as Pick<ChatInbox, "threadMessages">;
    expect((await inbox.threadMessages(thread, undefined, 10)) === null).toBe(false);
    const closedAt = () =>
      worker.db
        .prepare(`SELECT "chat_closed_at" FROM "account_deletions" WHERE "realms_id" = ?`)
        .bind(leaving.realmsId)
        .first<{ chat_closed_at: number | null }>();

    await worker.runCron();
    expect((await inbox.threadMessages(thread, undefined, 10)) === null).toBe(true);
    const closed = await closedAt();
    expect(closed?.chat_closed_at).toEqual(expect.any(Number));
    await waitUntil(() => ofType(friendRoom.frames, "presence:remove").length > 0, 5_000);
    expect(ofType(friendRoom.frames, "presence:remove")).toEqual([
      { type: "presence:remove", playerId: leaving.realmsId },
    ]);
    // The old room and inbox sockets reach nobody.
    publish(room.socket, GLOBAL, "after deletion");
    own.socket.send(
      JSON.stringify({ type: "direct:message", payload: { recipientId: friend.realmsId, content: "after deletion" } }),
    );
    await noneArrive(friendRoom.frames, "world:message");
    await noneArrive(friendInbox.frames, "direct:message");

    // Run again: nothing changes, and a peer's later message is not stored for the deleted account.
    await worker.runCron();
    expect(await closedAt()).toEqual(closed);
    await directMessage(worker, friend.cookie, leaving.realmsId);
    expect((await inbox.threadMessages(thread, undefined, 10)) === null).toBe(true);
  } finally {
    await worker.dispose();
  }
}, 120_000);
