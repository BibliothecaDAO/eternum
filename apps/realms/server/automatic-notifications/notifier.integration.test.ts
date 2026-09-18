import * as schema from "@realms-world/db/schema";
import webpush from "web-push";
import { randomUUID } from "node:crypto";
import { Effect, Layer } from "effect";
import { drizzle } from "drizzle-orm/node-postgres";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  notificationCheckpoints,
  notificationDeliveries,
  notificationPreferences,
  notificationPushSubscriptions,
} from "@realms-world/db";
import { endOfStoryBlock, type HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { buildStoryNotification } from "@bibliothecadao/notifications";
import { storyEventIdentity } from "@bibliothecadao/eternum/game-sync";
import { createNotificationTestDatabase } from "../notification-test-database";
vi.mock("@realms-world/db/client", () => ({ db: {} }));
vi.mock("../env", () => ({ serverEnv: {} }));
import { NotificationOutbox, createNotificationOutbox } from "./outbox";
import { PushSubscriptionStore, createPushSubscriptionStore } from "../push-subscription-store";
import { WebPushSender, createWebPushSender } from "../web-push-sender";
import { createAutomaticNotifier } from "./notifier";
import { createNotificationSource } from "./source";
const url = process.env.IDENTITY_TEST_DATABASE_URL;
describe.skipIf(!url)("automatic notifications through PostgreSQL", () => {
  let database: Awaited<ReturnType<typeof createNotificationTestDatabase>>;
  let outbox: ReturnType<typeof createNotificationOutbox>;
  let subscriptions: ReturnType<typeof createPushSubscriptionStore>;
  let now: number, head: number, events: HeraldHistoryEvent[];
  const config = { url: "https://herald.test", chain: "madara", worldAddress: "0x123" };
  const sent = vi.fn();
  let providerStatus = 201;
  const vapid = webpush.generateVAPIDKeys();
  const sender = createWebPushSender(
    { ...vapid, subject: "mailto:ops@realms.party" },
    async () => new Response(null, { status: providerStatus }),
  );
  const deviceIds = [randomUUID(), randomUUID()];
  const source = createNotificationSource(config, async (url) => {
    if (url.pathname.endsWith("/games"))
      return Response.json({
        chain: "madara",
        world_address: "0x123",
        games: [{ game_id: 7, name: "ended-game", status: "Ended" }],
      });
    return Response.json({
      chain: "madara",
      world_address: "0x123",
      complete_through_block: head,
      next_cursor: endOfStoryBlock(head),
      items: url.searchParams.has("after")
        ? events.filter((event) => event.block_number > Number(url.searchParams.get("after")!.split(":")[0]))
        : [],
    });
  });
  let chainUnavailable = false;
  const ownerOf = vi.fn(async (account: string) => (account === "0xa" ? "0x1" : account === "0xb" ? "0x2" : null));
  const notifier = createAutomaticNotifier({
    config,
    source,
    ownerOf,
    verifyChain: async () => {
      if (chainUnavailable) throw new Error("RPC offline");
    },
    now: () => now,
  });
  const tick = () =>
    Effect.runPromise(
      notifier.tick.pipe(
        Effect.provide(Layer.succeed(NotificationOutbox, outbox)),
        Effect.provide(Layer.succeed(PushSubscriptionStore, subscriptions)),
        Effect.provide(
          Layer.succeed(WebPushSender, {
            configuration: () => ({ enabled: true, publicKey: "key" }),
            send: (subscription, envelope) => {
              sent(subscription, envelope);
              return sender.send(subscription, envelope);
            },
          }),
        ),
      ),
    );
  function battle(id: number, owner = "0xa", entity = 11): HeraldHistoryEvent {
    return {
      block_number: 11,
      transaction_index: 0,
      event_index: id,
      game_id: "7",
      model: "StoryEvent",
      transaction_hash: "0xabc",
      value: {
        game_id: 7,
        id,
        owner,
        entity_id: entity,
        tx_hash: "0xabc",
        timestamp: Math.floor(now / 1000),
        story: {
          BattleStory: {
            attacker_id: 11,
            defender_id: 22,
            attacker_owner_address: "0xa",
            defender_owner_address: "0xb",
          },
        },
      },
    };
  }
  const candidate = () => {
    const event = battle(100);
    return {
      story: "BattleStory",
      notification: buildStoryNotification({
        sourceId: storyEventIdentity({ chain: "madara", worldAddress: "0x123", gameId: 7 }, event.value),
        value: event.value,
        owner: "0x1",
        gameName: "ended-game",
        target: "/enter/madara/ended-game",
        now,
      })!,
    };
  };
  beforeAll(async () => {
    database = await createNotificationTestDatabase(url!, {
      notificationPreferences,
      notificationPushSubscriptions,
      notificationCheckpoints,
      notificationDeliveries,
    });
    const db = drizzle(database.pool, { schema });
    outbox = createNotificationOutbox(db);
    subscriptions = createPushSubscriptionStore(db);
  });
  afterAll(async () => {
    await database?.close();
  });
  beforeEach(async () => {
    now = Date.now();
    head = 10;
    events = [];
    providerStatus = 201;
    chainUnavailable = false;
    sent.mockClear();
    ownerOf.mockClear();
    await database.pool.query(
      "TRUNCATE notification_checkpoints,notification_deliveries,notification_push_subscriptions,notification_preferences",
    );
    for (const [index, id] of deviceIds.entries()) {
      await Effect.runPromise(
        subscriptions.register({
          owner: `0x${index + 1}`,
          id,
          token: randomUUID(),
          gameAlerts: true,
          source: { chain: "madara", worldAddress: "0x123" },
          subscription: {
            endpoint: `https://fcm.googleapis.com/fcm/send/${index}`,
            keys: { p256dh: vapid.publicKey, auth: "A".repeat(22) },
          },
        }),
      );
    }
    await database.pool.query(
      "UPDATE notification_push_subscriptions SET game_alerts_enabled_at=now()-interval '1 minute'",
    );
    await database.pool.query(
      "INSERT INTO notification_preferences (owner,level,revision) VALUES ('0x1','important',1),('0x2','important',1)",
    );
  });
  it("starts at the head, notifies both battle owners once, and drains ended games after restart", async () => {
    await tick();
    head = 11;
    events = [battle(100), battle(101, "0xb", 22)];
    const result = await tick();
    expect(result.accepted).toBe(2);
    expect(sent).toHaveBeenCalledTimes(2);
    expect(sent.mock.calls.map((call) => call[1].notification.owner).sort()).toEqual(["0x1", "0x2"]);
    expect(new Set(sent.mock.calls.map((call) => call[1].notification.id)).size).toBe(1);
    expect(sent.mock.calls[0]![1]).toMatchObject({
      kind: "game",
      notification: { target: "/enter/madara/ended-game" },
    });
    expect(ownerOf).toHaveBeenCalledTimes(2);
    outbox = createNotificationOutbox(drizzle(database.pool, { schema }));
    await tick();
    expect(sent).toHaveBeenCalledTimes(2);
    expect(await Effect.runPromise(outbox.checkpoint(source.key))).toEqual(endOfStoryBlock(11));
  });
  it("rolls back enqueue and checkpoint together if the checkpoint write fails", async () => {
    await tick();
    await database.pool.query(
      "CREATE FUNCTION reject_cursor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test checkpoint failure'; END $$",
    );
    await database.pool.query(
      "CREATE TRIGGER reject_cursor BEFORE UPDATE ON notification_checkpoints FOR EACH ROW EXECUTE FUNCTION reject_cursor()",
    );
    try {
      await expect(
        Effect.runPromise(outbox.commit(source.key, endOfStoryBlock(10), endOfStoryBlock(11), [candidate()], now)),
      ).rejects.toThrow();
      expect((await database.pool.query("SELECT * FROM notification_deliveries")).rows).toHaveLength(0);
      expect(await Effect.runPromise(outbox.checkpoint(source.key))).toEqual(endOfStoryBlock(10));
    } finally {
      await database.pool.query("DROP TRIGGER reject_cursor ON notification_checkpoints");
      await database.pool.query("DROP FUNCTION reject_cursor()");
    }
  });
  it("claims across two workers, recovers abandoned leases, and fences stale acknowledgments", async () => {
    await tick();
    await Effect.runPromise(outbox.commit(source.key, endOfStoryBlock(10), endOfStoryBlock(11), [candidate()], now));
    const other = createNotificationOutbox(drizzle(database.pool, { schema }));
    const [a, b] = await Promise.all([
      Effect.runPromise(outbox.claim(source.key, now)),
      Effect.runPromise(other.claim(source.key, now)),
    ]);
    expect(a.length + b.length).toBe(1);
    const old = [...a, ...b][0]!;
    const [reclaimed] = await Effect.runPromise(other.claim(source.key, now + 30001));
    expect(reclaimed!.attempts).toBe(2);
    await Effect.runPromise(outbox.finish(old, "accepted", now));
    expect((await database.pool.query("SELECT outcome FROM notification_deliveries")).rows[0].outcome).toBeNull();
    await Effect.runPromise(other.finish(reclaimed!, null, now + 40000));
    expect(await Effect.runPromise(other.claim(source.key, now + 35000))).toEqual([]);
    expect(await Effect.runPromise(other.claim(source.key, now + 40000))).toHaveLength(1);
  });
  it("rechecks Off and revocation after enqueue, and excludes tests-only devices", async () => {
    await tick();
    await Effect.runPromise(outbox.commit(source.key, endOfStoryBlock(10), endOfStoryBlock(11), [candidate()], now));
    const [lease] = await Effect.runPromise(outbox.claim(source.key, now));
    await database.pool.query("UPDATE notification_preferences SET level='off' WHERE owner='0x1'");
    expect(await Effect.runPromise(outbox.eligible(lease!, now))).toBeNull();
    await database.pool.query("UPDATE notification_preferences SET level='important' WHERE owner='0x1'");
    await Effect.runPromise(subscriptions.expire("0x1", deviceIds[0]!));
    expect(await Effect.runPromise(outbox.eligible(lease!, now))).toBeNull();
    await database.pool.query("UPDATE notification_push_subscriptions SET game_alerts_enabled_at=NULL");
    head = 12;
    events = [{ ...battle(100, "0xb", 22), block_number: 12 }];
    await tick();
    expect(sent).not.toHaveBeenCalled();
  });
  it("excludes events predating consent at enqueue and after renewed consent before sending", async () => {
    await tick();
    const event = candidate();
    await database.pool.query("UPDATE notification_push_subscriptions SET game_alerts_enabled_at=$1", [
      new Date(event.notification.createdAt + 1),
    ]);
    expect(
      await Effect.runPromise(outbox.commit(source.key, endOfStoryBlock(10), endOfStoryBlock(11), [event], now)),
    ).toBe(0);
    expect(await Effect.runPromise(outbox.checkpoint(source.key))).toEqual(endOfStoryBlock(11));
    await database.pool.query("UPDATE notification_push_subscriptions SET game_alerts_enabled_at=$1", [
      new Date(event.notification.createdAt),
    ]);
    expect(
      await Effect.runPromise(outbox.commit(source.key, endOfStoryBlock(11), endOfStoryBlock(12), [event], now)),
    ).toBe(1);
    const [lease] = await Effect.runPromise(outbox.claim(source.key, now));
    expect(await Effect.runPromise(outbox.eligible(lease!, now))).not.toBeNull();
    await database.pool.query("UPDATE notification_push_subscriptions SET game_alerts_enabled_at=$1", [
      new Date(event.notification.createdAt + 1),
    ]);
    expect(await Effect.runPromise(outbox.eligible(lease!, now))).toBeNull();
  });

  it("suppresses a foreground device both at enqueue and immediately before delivery", async () => {
    await tick();
    await Effect.runPromise(subscriptions.setGameForeground("0x1", deviceIds[0]!, true, now));
    head = 11;
    events = [battle(100), battle(101, "0xb", 22)];
    const foregroundTick = await tick();
    expect(foregroundTick.accepted).toBe(1);
    expect(sent.mock.calls.map((call) => call[1].notification.owner)).toEqual(["0x2"]);

    await Effect.runPromise(subscriptions.setGameForeground("0x1", deviceIds[0]!, false, now));
    expect(
      await Effect.runPromise(outbox.commit(source.key, endOfStoryBlock(11), endOfStoryBlock(12), [candidate()], now)),
    ).toBe(1);
    const [lease] = await Effect.runPromise(outbox.claim(source.key, now));
    await Effect.runPromise(subscriptions.setGameForeground("0x1", deviceIds[0]!, true, now));
    expect(await Effect.runPromise(outbox.eligible(lease!, now))).toBeNull();
  });

  it("commits a page once when independent consumers race the same checkpoint", async () => {
    await tick();
    const other = createNotificationOutbox(drizzle(database.pool, { schema }));
    const results = await Promise.all(
      [outbox, other].map((store) =>
        Effect.runPromise(store.commit(source.key, endOfStoryBlock(10), endOfStoryBlock(11), [candidate()], now)),
      ),
    );
    expect(results.sort()).toEqual([0, 1]);
    expect((await database.pool.query("SELECT * FROM notification_deliveries")).rows).toHaveLength(1);
    expect(await Effect.runPromise(outbox.checkpoint(source.key))).toEqual(endOfStoryBlock(11));
  });

  it("keeps the checkpoint under capacity pressure and resumes after expired rows are pruned", async () => {
    await tick();
    const event = candidate();
    await database.pool.query(
      `INSERT INTO notification_deliveries (id,owner,source,subscription_id,story,notification,expires_at)
       SELECT 'capacity-' || n, '0x1', $1, $2, $3, $4::jsonb, $5 FROM generate_series(1,10000) n`,
      [source.key, deviceIds[0], event.story, JSON.stringify(event.notification), now + 1],
    );
    const commit = () =>
      Effect.runPromise(outbox.commit(source.key, endOfStoryBlock(10), endOfStoryBlock(11), [event], now));
    await expect(commit()).rejects.toThrow();
    expect(await Effect.runPromise(outbox.checkpoint(source.key))).toEqual(endOfStoryBlock(10));
    expect(
      (await database.pool.query("SELECT count(*)::int AS count FROM notification_deliveries")).rows[0].count,
    ).toBe(10000);
    now += 2;
    expect(await Effect.runPromise(outbox.prune(now))).toBe(10000);
    expect(await commit()).toBe(1);
    expect(await Effect.runPromise(outbox.checkpoint(source.key))).toEqual(endOfStoryBlock(11));
    expect(await Effect.runPromise(outbox.claim(source.key, now))).toHaveLength(1);
  });

  it("retries transient provider failures with the same identity and stops after acceptance", async () => {
    await tick();
    head = 11;
    events = [battle(100)];
    providerStatus = 503;
    expect((await tick()).retry).toBe(2);
    const ids = sent.mock.calls.map((call) => call[1].notification.id);
    providerStatus = 201;
    chainUnavailable = false;
    now += 1001;
    expect((await tick()).accepted).toBe(2);
    expect(sent.mock.calls.slice(2).map((call) => call[1].notification.id)).toEqual(ids);
    await tick();
    expect(sent).toHaveBeenCalledTimes(4);
  });
  it("does not retry permanent provider rejection and removes expired subscriptions", async () => {
    await tick();
    head = 11;
    events = [battle(100)];
    providerStatus = 403;
    expect((await tick()).failed).toBe(2);
    now += 1001;
    await tick();
    expect(sent).toHaveBeenCalledTimes(2);
    head = 12;
    events = [{ ...battle(102), block_number: 12 }];
    providerStatus = 410;
    expect((await tick()).suppressed).toBe(2);
    expect((await database.pool.query("SELECT * FROM notification_push_subscriptions")).rows).toHaveLength(0);
  });
  it("does not enqueue or claim deliveries belonging to a different automatic source", async () => {
    await tick();
    await database.pool.query(
      "UPDATE notification_push_subscriptions SET game_alerts_source='appchain:0x123' WHERE owner='0x1'",
    );
    head = 11;
    events = [battle(100)];
    expect((await tick()).accepted).toBe(1);
    expect(sent.mock.calls[0]![1].notification.owner).toBe("0x2");
    expect(await Effect.runPromise(outbox.claim("appchain:0x123", now))).toEqual([]);
  });
  it("delivers already-queued work while registry verification is unavailable", async () => {
    await tick();
    await Effect.runPromise(outbox.commit(source.key, endOfStoryBlock(10), endOfStoryBlock(11), [candidate()], now));
    head = 11;
    chainUnavailable = true;
    const result = await tick();
    expect(result.history).toMatchObject({ unavailable: true, operation: "chain_verification" });
    expect(result.accepted).toBe(1);
  });
  it("stops retrying after five failed attempts", async () => {
    await tick();
    head = 11;
    events = [battle(100)];
    providerStatus = 503;
    for (let attempt = 1; attempt <= 5; attempt++) {
      await tick();
      now += 1000 * 2 ** attempt;
    }
    await tick();
    expect(sent).toHaveBeenCalledTimes(10);
    expect((await Effect.runPromise(outbox.metrics(source.key, now))).pending).toBe(0);
  });
  it("does not deliver old history after a long outage and prunes expired claims", async () => {
    await tick();
    head = 11;
    events = [battle(100)];
    now += 120001;
    await tick();
    expect(sent).not.toHaveBeenCalled();
    expect(await Effect.runPromise(outbox.checkpoint(source.key))).toEqual(endOfStoryBlock(11));
    expect((await Effect.runPromise(outbox.metrics(source.key, now))).pending).toBe(0);
  });
});
