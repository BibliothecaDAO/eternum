import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeAll, expect, it } from "vitest";

import type { ChatInbox } from "./chat-inbox";
import { CHAT_RETENTION_MS } from "./retention";

import {
  buildWorkerBundle,
  migrationStatements,
  newStorage,
  OPERATOR_TOKEN,
  ORIGIN,
  pause,
  startWorker,
  vapidKeys,
  waitUntil,
} from "../workerd-harness";

/**
 * Chat's thirty days, as Cloudflare runs them: a message older than that is gone from a room and from an inbox, from
 * its answers and from its storage, and an object nobody opens again deletes its next expired message by its alarm.
 * workerd's clock cannot be moved, so the Worker is stopped, its messages made older in the object's own storage, and
 * started again over it.
 */
let bundle: string;
beforeAll(() => {
  bundle = buildWorkerBundle();
}, 180_000);

type Worker = Awaited<ReturnType<typeof startWorker>>;
const GLOBAL = "world:global";
const DAY_MS = 24 * 60 * 60 * 1000;
/** How long after its storage is changed the second message turns thirty days: time to restart and read before it. */
const EXPIRES_IN_MS = 20_000;
/** How long an alarm may take to run once due, on a loaded machine. */
const ALARM_MS = 30_000;

/** The Worker over `storage`, kept from an earlier start when it has one. */
const startOver = async (storage: string) =>
  startWorker({ bundle, storage, vapid: await vapidKeys(), outbound: () => new Response(null, { status: 599 }) });

/** A Durable Object's own SQLite storage, as workerd keeps it under the test's storage directory. */
const objectStorage = (storage: string, className: string, id: string) => {
  const file = join(storage, "do", `identity-${className}`, `${id}.sqlite`);
  expect(existsSync(file)).toBe(true);
  return file;
};

const withStorage = <T>(file: string, read: (db: DatabaseSync) => T): T => {
  const db = new DatabaseSync(file);
  try {
    return read(db);
  } finally {
    db.close();
  }
};

/** Sets each message's time, in its order of writing: the first is past thirty days, the next turns thirty soon. */
const ageMessages = (file: string, createdAt: number[]) =>
  withStorage(file, (db) => {
    const ids = db.prepare("SELECT id FROM messages ORDER BY createdAt, rowid").all() as { id: string }[];
    expect(ids).toHaveLength(createdAt.length);
    for (const [index, time] of createdAt.entries())
      db.prepare("UPDATE messages SET createdAt = ? WHERE id = ?").run(time, ids[index]?.id ?? "");
  });

const storedContents = (file: string) =>
  withStorage(file, (db) =>
    (db.prepare("SELECT content FROM messages ORDER BY createdAt").all() as { content: string }[]).map(
      ({ content }) => content,
    ),
  );

const send = async (worker: Worker, cookie: string, path: string, frames: string[]) => {
  const response = await worker.mf.dispatchFetch(`${ORIGIN}${path}`, {
    headers: { upgrade: "websocket", cookie, origin: ORIGIN },
  });
  const socket = response.webSocket;
  if (!socket) throw new Error(`no socket at ${path}: ${response.status}`);
  socket.accept();
  const received: { type: string }[] = [];
  socket.addEventListener("message", (event) => received.push(JSON.parse(event.data as string) as { type: string }));
  for (const frame of frames) socket.send(frame);
  return { socket, received };
};

it("deletes a room's messages at thirty days without another message: on its next read, then by its alarm", async () => {
  const storage = newStorage();
  let worker = await startOver(storage);
  await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
  const player = await worker.signInWithEmailCode("speaker@realms.test");
  const contents = ["past thirty days", "thirty days soon", "this week"];
  const room = await send(
    worker,
    player.cookie,
    `/api/chat/rooms/${encodeURIComponent(GLOBAL)}`,
    contents.map((content) =>
      JSON.stringify({ type: "world:publish", zoneId: GLOBAL, payload: { zoneId: GLOBAL, content } }),
    ),
  );
  await waitUntil(() => room.received.filter(({ type }) => type === "world:message").length === 3, 5_000);
  room.socket.close();
  const rooms = await worker.mf.getDurableObjectNamespace("CHAT_ROOM");
  const id = rooms.idFromName(GLOBAL).toString();
  await worker.dispose();

  const file = objectStorage(storage, "ChatRoom", id);
  const now = Date.now();
  ageMessages(file, [now - 31 * DAY_MS, now - CHAT_RETENTION_MS + EXPIRES_IN_MS, now - 7 * DAY_MS]);

  worker = await startOver(storage);
  try {
    const history = (await (
      await worker.mf.dispatchFetch(`${ORIGIN}/api/chat/world?zoneId=${encodeURIComponent(GLOBAL)}`, {
        headers: { cookie: player.cookie },
      })
    ).json()) as { messages: { content: string }[] };
    expect(history.messages.map(({ content }) => content)).toEqual(["this week", "thirty days soon"]);
    expect(storedContents(file)).toEqual(["thirty days soon", "this week"]);

    // Nobody reads or writes the room again: its alarm deletes the next message when it turns thirty days.
    await pause(now + EXPIRES_IN_MS - Date.now());
    await waitUntil(() => storedContents(file).length === 1, ALARM_MS);
    expect(storedContents(file)).toEqual(["this week"]);
  } finally {
    await worker.dispose();
  }
}, 180_000);

it("deletes an inbox's old messages inside a thread that goes on, recounts its unread, and empties a quiet one by its alarm", async () => {
  const storage = newStorage();
  let worker = await startOver(storage);
  await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
  const writer = await worker.signInWithEmailCode("writer@realms.test");
  const reader = await worker.signInWithEmailCode("reader@realms.test");
  const contents = ["past thirty days", "thirty days soon", "this week"];
  const own = await send(
    worker,
    writer.cookie,
    "/api/chat/inbox",
    contents.map((content) =>
      JSON.stringify({ type: "direct:message", payload: { recipientId: reader.realmsId, content } }),
    ),
  );
  await waitUntil(() => own.received.filter(({ type }) => type === "direct:message").length === 3, 5_000);
  const thread = (
    own.received.find(({ type }) => type === "direct:message") as unknown as { message: { threadId: string } }
  ).message.threadId;
  own.socket.close();
  const inboxes = await worker.mf.getDurableObjectNamespace("CHAT_INBOX");
  const readerId = inboxes.idFromName(reader.realmsId).toString();
  const writerId = inboxes.idFromName(writer.realmsId).toString();
  await worker.dispose();

  const now = Date.now();
  const readerFile = objectStorage(storage, "ChatInbox", readerId);
  const writerFile = objectStorage(storage, "ChatInbox", writerId);
  ageMessages(readerFile, [now - 31 * DAY_MS, now - CHAT_RETENTION_MS + EXPIRES_IN_MS, now - 7 * DAY_MS]);
  // The writer's copy is all near thirty days: once it turns, that inbox holds nothing.
  ageMessages(writerFile, [
    now - 31 * DAY_MS,
    now - CHAT_RETENTION_MS + EXPIRES_IN_MS,
    now - CHAT_RETENTION_MS + EXPIRES_IN_MS,
  ]);

  worker = await startOver(storage);
  try {
    const namespace = await worker.mf.getDurableObjectNamespace("CHAT_INBOX");
    const readerInbox = namespace.get(namespace.idFromName(reader.realmsId)) as unknown as Pick<
      ChatInbox,
      "threadMessages"
    >;
    const writerInbox = namespace.get(namespace.idFromName(writer.realmsId)) as unknown as Pick<
      ChatInbox,
      "threadMessages"
    >;
    const page = await readerInbox.threadMessages(thread, undefined, 10);
    expect(page?.messages.map(({ content }) => content)).toEqual(["this week", "thirty days soon"]);
    expect(storedContents(readerFile)).toEqual(["thirty days soon", "this week"]);
    // The reader never read: what is unread is what stays.
    const opened = await send(worker, reader.cookie, "/api/chat/inbox", []);
    await waitUntil(() => opened.received.some(({ type }) => type === "connected"), 5_000);
    const connected = opened.received.find(({ type }) => type === "connected") as unknown as {
      threads: { thread: { unreadCounts: Record<string, number> } }[];
    };
    expect(connected.threads.map(({ thread }) => thread.unreadCounts[reader.realmsId])).toEqual([2]);
    opened.socket.close();
    expect((await writerInbox.threadMessages(thread, undefined, 10))?.messages).toHaveLength(2);

    // Nobody opens either inbox again: their alarms delete what turns thirty days, and the writer's thread with it.
    await pause(now + EXPIRES_IN_MS - Date.now());
    await waitUntil(() => storedContents(readerFile).length === 1 && storedContents(writerFile).length === 0, ALARM_MS);
    expect(storedContents(readerFile)).toEqual(["this week"]);
    expect(storedContents(writerFile)).toEqual([]);
    expect(withStorage(writerFile, (db) => db.prepare("SELECT COUNT(*) AS n FROM threads").get())).toEqual({ n: 0 });
  } finally {
    await worker.dispose();
  }
}, 180_000);

/** The object's alarm time, as workerd keeps it (in nanoseconds) in the object's storage; null: none set. */
const alarmOf = (file: string) =>
  withStorage(
    file,
    (db) =>
      (db.prepare("SELECT value / 1000000 AS at FROM _cf_METADATA WHERE key = 1").get() as { at: number } | undefined)
        ?.at ?? null,
  );

/** The object as chat kept it before retention existed: its messages, and no alarm. */
const withoutAlarm = (file: string) =>
  withStorage(file, (db) => db.prepare("DELETE FROM _cf_METADATA WHERE key = 1").run());

/** The deploy's call for one class of chat object (deploy/first/publish.ts `keepChatRetention`). */
const keepRetention = (worker: Worker, className: string, ids: string[], token = OPERATOR_TOKEN) =>
  worker.mf.dispatchFetch(`${ORIGIN}/api/operator/chat-retention`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ className, ids }),
  });

it("gives chat written before retention existed its thirty days at the deploy's call, with no player opening it", async () => {
  const storage = newStorage();
  let worker = await startOver(storage);
  await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
  const writer = await worker.signInWithEmailCode("old-writer@realms.test");
  const reader = await worker.signInWithEmailCode("old-reader@realms.test");
  const contents = ["past thirty days", "thirty days soon", "this week"];
  const room = await send(
    worker,
    writer.cookie,
    `/api/chat/rooms/${encodeURIComponent(GLOBAL)}`,
    contents.map((content) =>
      JSON.stringify({ type: "world:publish", zoneId: GLOBAL, payload: { zoneId: GLOBAL, content } }),
    ),
  );
  const own = await send(
    worker,
    writer.cookie,
    "/api/chat/inbox",
    contents.map((content) =>
      JSON.stringify({ type: "direct:message", payload: { recipientId: reader.realmsId, content } }),
    ),
  );
  await waitUntil(
    () =>
      room.received.filter(({ type }) => type === "world:message").length === 3 &&
      own.received.filter(({ type }) => type === "direct:message").length === 3,
    5_000,
  );
  room.socket.close();
  own.socket.close();
  const rooms = await worker.mf.getDurableObjectNamespace("CHAT_ROOM");
  const inboxes = await worker.mf.getDurableObjectNamespace("CHAT_INBOX");
  const roomId = rooms.idFromName(GLOBAL).toString();
  const inboxIds = [writer.realmsId, reader.realmsId].map((realmsId) => inboxes.idFromName(realmsId).toString());
  await worker.dispose();

  const now = Date.now();
  const files = [
    objectStorage(storage, "ChatRoom", roomId),
    ...inboxIds.map((id) => objectStorage(storage, "ChatInbox", id)),
  ];
  for (const file of files) {
    ageMessages(file, [now - 31 * DAY_MS, now - CHAT_RETENTION_MS + EXPIRES_IN_MS, now - 7 * DAY_MS]);
    expect(alarmOf(file)).not.toBeNull();
    withoutAlarm(file);
    expect(alarmOf(file)).toBeNull();
  }

  worker = await startOver(storage);
  try {
    expect((await keepRetention(worker, "ChatRoom", [roomId], "not-the-operator")).status).toBe(401);
    expect((await keepRetention(worker, "ChatRoom", ["not-an-object"])).status).toBe(400);
    expect(files.map(storedContents)).toEqual(files.map(() => contents));

    // The deploy names every object; no player reads or writes any of them.
    expect(await (await keepRetention(worker, "ChatRoom", [roomId])).json()).toEqual({ kept: 1 });
    expect(await (await keepRetention(worker, "ChatInbox", inboxIds)).json()).toEqual({ kept: 2 });
    expect(files.map(storedContents)).toEqual(files.map(() => ["thirty days soon", "this week"]));
    expect(files.map(alarmOf)).toEqual(files.map(() => now + EXPIRES_IN_MS));
    // A second deploy changes nothing.
    expect((await keepRetention(worker, "ChatInbox", inboxIds)).status).toBe(200);
    expect(files.map(storedContents)).toEqual(files.map(() => ["thirty days soon", "this week"]));

    // Their alarms then delete each message as it turns thirty days.
    await pause(now + EXPIRES_IN_MS - Date.now());
    await waitUntil(() => files.every((file) => storedContents(file).length === 1), ALARM_MS);
    expect(files.map(storedContents)).toEqual(files.map(() => ["this week"]));
  } finally {
    await worker.dispose();
  }
}, 180_000);
