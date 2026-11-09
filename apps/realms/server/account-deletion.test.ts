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
