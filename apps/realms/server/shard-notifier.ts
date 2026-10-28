import { DurableObject } from "cloudflare:workers";
import { Effect } from "effect";
import {
  encodeStoryHistoryCursor,
  storyEventIdentity,
  type HeraldGameDirectory,
  type HeraldHistoryEvent,
  type HeraldStoryHistoryPage,
  type ShardManifest,
  type StoryEventScope,
} from "@bibliothecadao/eternum/game-sync";
import { dayOf } from "@bibliothecadao/eternum/expeditions";
import {
  buildArmyRestedNotification,
  buildDayOpen,
  buildStoryNotification,
  gamePath,
  includesArmyRestedNotification,
  includesStoryNotification,
  isQuietAt,
  readHistoryStory,
  storyRecipients,
  type LocalNotificationPayload,
  type PushEnvelope,
} from "@bibliothecadao/notifications";

import {
  actorsWhoActed,
  partitionByRunningGame,
  readActorArmies,
  restWatchesOf,
  restWatchKey,
  type RestingActor,
  type RestWatch,
} from "./army-rest";
import { decodeIdentityEnv, vapidKeysOf, type IdentityEnv } from "./env";
import { planDayOpenings, readEnrolledAccounts, readHomeClaim, type DayOpening } from "./day-open";
import { NotificationPreferenceStore } from "./notification-preference-store";
import { PushSubscriptionStore, type PushSubscriptionRow } from "./push-subscription-store";
import { realmsIdsOfAccounts } from "./realms-accounts";
import { sendPush } from "./web-push";

const POLL_MS = 3_000;

/** The shard this notifier reads, as the directory lists it and as its manifest names its Games contract. */
interface WatchedShard {
  url: string;
  chainId: string;
  worldAddress?: string;
}

/** One game alert waiting for one device, from confirmed history, a rested army or the seeded day schedule. */
interface OutboxEntry {
  owner: string;
  subscriptionId: string;
  envelope: PushEnvelope;
  attempts: number;
  dueAt: number;
}

const STORY_PAGE = 100;
const MAX_ATTEMPTS = 5;
const SHARD_TIMEOUT_MS = 10_000;
// Fetch confirmed enrollment before the trigger; delivery itself never depends on a shard read.
const DAY_OPEN_PREPARE_MS = 60_000;
/** The most game pushes one player gets in any 24 hours; the rest wait in the Feed. Direct messages are not counted. */
const DAILY_PUSH_CEILING = 6;
const DAY_MS = 86_400_000;

/**
 * Game alerts for one shard in our directory. Alarms deliver due entries, prepare each Frontier day's Day open push and
 * read confirmed stories. Story entries commit with their cursor; a day's pushes are prepared once, before it opens, and
 * never recreated after. A device that receives a repeated id drops it by its own durable claim.
 */
export class ShardNotifier extends DurableObject<Record<string, unknown>> {
  /** Called by the directory's cron for every listed shard; starting an already running notifier changes nothing. */
  async watch(shard: { url: string; chainId: string }): Promise<void> {
    const current = await this.ctx.storage.get<WatchedShard>("shard");
    // Its cursor, wake times and outbox belong to one chain: a new chain at this URL is read from its own head.
    if (current && BigInt(current.chainId) !== BigInt(shard.chainId)) await this.ctx.storage.deleteAll();
    if (current?.url !== shard.url || current.chainId !== shard.chainId) await this.ctx.storage.put("shard", shard);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now());
  }

  /** A retired shard sends nothing more. */
  async stop(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  override async alarm(): Promise<void> {
    const shard = await this.ctx.storage.get<WatchedShard>("shard");
    if (!shard) return;
    const env = decodeIdentityEnv(this.env);
    // Each stage stands alone: one that fails is logged and the others still run.
    await runStage(shard, "deliver", () => this.deliverDue(env));
    const watched = await runStage(shard, "manifest", () => this.withWorldAddress(shard));
    let morePages = false;
    let dayOpenWake: number | null = null;
    if (watched) {
      dayOpenWake = (await runStage(shard, "day-open", () => this.prepareDayOpens(env, watched))) ?? null;
      await runStage(shard, "wake", () => this.wakeRestedArmies(env, watched));
      await runStage(shard, "deliver", () => this.deliverDue(env));
      morePages = (await runStage(shard, "stories", () => this.readStories(env, watched))) ?? false;
    }
    await this.scheduleNextAlarm(morePages, dayOpenWake);
  }

  private async scheduleNextAlarm(morePages: boolean, dayOpenWake: number | null): Promise<void> {
    const now = Date.now();
    let next = now + (morePages ? 0 : POLL_MS);
    if (dayOpenWake !== null && dayOpenWake > now) next = Math.min(next, dayOpenWake);
    for (const entry of (await this.ctx.storage.list<OutboxEntry>({ prefix: "outbox:" })).values())
      next = Math.min(next, entry.dueAt);
    await this.ctx.storage.setAlarm(Math.max(now, next));
  }

  private async prepareDayOpens(env: IdentityEnv, shard: Required<WatchedShard>): Promise<number | null> {
    const directory = await readShard<HeraldGameDirectory>(shard.url, "/games");
    if (BigInt(directory.chain) !== BigInt(shard.chainId)) throw new Error(`${shard.url} changed chain`);
    await this.forgetEndedDayOpens(shard, directory);
    const plan = planDayOpenings(directory.games, Date.now(), DAY_OPEN_PREPARE_MS);
    for (const opening of plan.prepare) {
      const preparedKey = `day-open-prepared:${opening.gameId}:${opening.day}`;
      if ((await this.ctx.storage.get(preparedKey)) !== undefined) continue;
      const entries = await dayOpenAlerts(env, shard, opening);
      await this.ctx.storage.transaction(async (txn) => {
        // An enrollment read that finishes late must not resurrect an already opened day.
        if (Date.now() >= opening.opensAt || (await txn.get(preparedKey)) !== undefined) return;
        for (const entry of entries) await txn.put(outboxKey(entry), entry);
        // An empty cohort is prepared too; later polls must not admit later enrollments.
        await txn.put(preparedKey, opening.endsAt);
      });
    }
    return plan.nextAlarmAt;
  }

  /** A game that ended sends no more Day open pushes; a day's preparation is forgotten once the day is over. */
  private async forgetEndedDayOpens(shard: Required<WatchedShard>, directory: HeraldGameDirectory): Promise<void> {
    const running = new Set(
      directory.games
        .filter((game) => game.mode === "frontier" && game.status !== "Ended" && game.status !== "Settled")
        .map((game) => gamePath({ chainId: shard.chainId, gameId: game.game_id })),
    );
    for (const [key, entry] of await this.ctx.storage.list<OutboxEntry>({ prefix: "outbox:" })) {
      if (entry.envelope.notification.kind === "day-open" && !running.has(entry.envelope.notification.target))
        await this.ctx.storage.delete(key);
    }
    for (const [key, endsAt] of await this.ctx.storage.list<number>({ prefix: "day-open-prepared:" }))
      if (endsAt <= Date.now()) await this.ctx.storage.delete(key);
  }

  private async withWorldAddress(shard: WatchedShard): Promise<Required<WatchedShard>> {
    if (shard.worldAddress) return shard as Required<WatchedShard>;
    const manifest = await readShard<ShardManifest>(shard.url, "/manifest");
    if (BigInt(manifest.chainId) !== BigInt(shard.chainId)) throw new Error(`${shard.url} changed chain`);
    const worldAddress = manifest.contracts.games;
    if (!worldAddress) throw new Error(`${shard.url} names no Games contract`);
    const watched = { ...shard, worldAddress };
    await this.ctx.storage.put("shard", watched);
    return watched;
  }

  /** Reads one page after the cursor and queues its alerts; true when more stories are waiting. */
  private async readStories(env: IdentityEnv, shard: Required<WatchedShard>): Promise<boolean> {
    const cursor = await this.ctx.storage.get<string>("cursor");
    // A new notifier starts at the shard's head: it alerts on what happens from now on, never on old history.
    const page = await readShard<HeraldStoryHistoryPage>(
      shard.url,
      cursor ? `/history/story-events?limit=${STORY_PAGE}&after=${cursor}` : "/history/story-events?limit=1",
    );
    if (BigInt(page.chain) !== BigInt(shard.chainId)) throw new Error(`${shard.url} served chain ${page.chain}`);
    let entries: OutboxEntry[] = [];
    let resting: { actor: RestingActor; watches: RestWatch[] }[] = [];
    try {
      entries = cursor ? await planAlerts(env, shard, page) : [];
      resting = cursor ? await watchRestingArmies(env, shard, page) : [];
    } catch (error) {
      if (!(await this.givesUpPage(shard, cursor!, page, error))) return false;
    }
    await this.ctx.storage.transaction(async (txn) => {
      for (const entry of entries) await txn.put(outboxKey(entry), entry);
      // A player's action replaces every wake time of theirs: a moved army gets a new one, a gone army none.
      for (const { actor, watches } of resting) {
        await txn.delete([...(await txn.list({ prefix: restWatchKey(actor) })).keys()]);
        for (const watch of watches) await txn.put(restWatchKey(watch), watch);
      }
      await txn.put("cursor", encodeStoryHistoryCursor(page.next_cursor));
      await txn.delete("pageAttempts");
    });
    return cursor !== undefined && page.items.length === STORY_PAGE;
  }

  /**
   * A page whose alerts cannot be planned is read again on the next polls; after MAX_ATTEMPTS it is skipped, loudly,
   * so one bad page never holds back every story after it. True when the page is given up.
   */
  private async givesUpPage(
    shard: WatchedShard,
    cursor: string,
    page: HeraldStoryHistoryPage,
    error: unknown,
  ): Promise<boolean> {
    const previous = await this.ctx.storage.get<{ cursor: string; attempts: number }>("pageAttempts");
    const attempts = (previous?.cursor === cursor ? previous.attempts : 0) + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    console.error(
      exhausted ? "shard_notifier_page_dropped" : "shard_notifier_page_retry",
      shard.url,
      `after ${cursor}`,
      `${page.items.length} stories`,
      `attempt ${attempts}`,
      error,
    );
    if (!exhausted) await this.ctx.storage.put("pageAttempts", { cursor, attempts });
    return exhausted;
  }

  /**
   * Each army whose wake time has come is read again: still there and full, it gets one alert; still recovering, a new
   * wake time; gone, or its game over, nothing.
   */
  private async wakeRestedArmies(env: IdentityEnv, shard: Required<WatchedShard>): Promise<void> {
    const now = Date.now();
    const { running: due, ended } = await partitionByRunningGame(
      shard.url,
      [...(await this.ctx.storage.list<RestWatch>({ prefix: "rest:" })).values()].filter(
        (watch) => wakeAt(watch, POLL_MS) <= now,
      ),
    );
    await this.ctx.storage.transaction(async (txn) => {
      for (const watch of ended) await txn.delete(restWatchKey(watch));
    });
    const byActor = new Map<string, RestWatch[]>();
    for (const watch of due) {
      const actorKey = restWatchKey({ gameId: watch.gameId, actor: watch.actor });
      byActor.set(actorKey, [...(byActor.get(actorKey) ?? []), watch]);
    }
    for (const watches of byActor.values()) {
      try {
        await this.wakeActor(env, shard, watches, now);
      } catch (error) {
        await this.retryWatches(shard, watches, now, error);
      }
    }
  }

  private async wakeActor(env: IdentityEnv, shard: Required<WatchedShard>, watches: RestWatch[], now: number) {
    const armies = await readActorArmies(shard.url, watches[0]!.gameId, watches[0]!.actor, now);
    const rested = watches.find((watch) => armies.find((army) => army.armyId === watch.armyId)?.full);
    const renewed = watches.flatMap((watch) => {
      const army = armies.find((candidate) => candidate.armyId === watch.armyId);
      return !army?.full && army?.fullAt ? [{ ...watch, fullAt: army.fullAt, attempts: 0 }] : [];
    });
    const alert = rested ? await restedAlerts(env, shard, rested, now) : null;
    await this.ctx.storage.transaction(async (txn) => {
      for (const watch of watches) await txn.delete(restWatchKey(watch));
      for (const watch of renewed) await txn.put(restWatchKey(watch), watch);
      // One rested push a day per player, however many of their armies rest that day.
      if (!alert || (await txn.get(alert.sentKey)) !== undefined) return;
      for (const entry of alert.entries) await txn.put(outboxKey(entry), entry);
      await txn.put(alert.sentKey, now + 2 * DAY_MS);
    });
  }

  /** Watches a wake could not read wait and are tried again, then are dropped loudly: never retried forever. */
  private async retryWatches(shard: WatchedShard, watches: RestWatch[], now: number, error: unknown) {
    const { gameId, actor, attempts } = watches[0]!;
    const exhausted = attempts + 1 >= MAX_ATTEMPTS;
    console.error(
      exhausted ? "shard_notifier_watch_dropped" : "shard_notifier_watch_retry",
      shard.url,
      `game ${gameId}`,
      `actor ${actor}`,
      `armies ${watches.map(({ armyId }) => armyId).join(",")}`,
      `attempt ${attempts + 1}`,
      error,
    );
    await this.ctx.storage.transaction(async (txn) => {
      for (const watch of watches) {
        if (exhausted) await txn.delete(restWatchKey(watch));
        else await txn.put(restWatchKey(watch), { ...watch, attempts: watch.attempts + 1 });
      }
    });
  }

  private async deliverDue(env: IdentityEnv): Promise<void> {
    const now = Date.now();
    for (const [key, dueAt] of await this.ctx.storage.list<number>({ prefix: "rested-sent:" }))
      if (dueAt <= now) await this.ctx.storage.delete(key);
    for (const [key, entry] of await this.ctx.storage.list<OutboxEntry>({ prefix: "outbox:" })) {
      if (entry.dueAt <= now) await this.deliverEntry(env, key, entry);
    }
  }

  private async deliverEntry(env: IdentityEnv, key: string, entry: OutboxEntry): Promise<void> {
    const sentKey = `sent:${entry.owner}`;
    const sent = ((await this.ctx.storage.get<number[]>(sentKey)) ?? []).filter((at) => at > Date.now() - DAY_MS);
    const outcome = await deliver(env, entry, Date.now(), sent.length).catch((error: unknown) => {
      const retry = retryLater(entry, Date.now(), POLL_MS);
      console.error(
        retry ? "shard_notifier_delivery_retry" : "shard_notifier_delivery_dropped",
        entry.envelope.notification.id,
        `device ${entry.subscriptionId}`,
        `attempt ${entry.attempts + 1}`,
        error,
      );
      return { next: retry, accepted: false };
    });
    await this.ctx.storage.transaction(async (txn) => {
      if (outcome.next) await txn.put(key, outcome.next);
      else await txn.delete(key);
      if (outcome.accepted) await txn.put(sentKey, [...sent, Date.now()]);
    });
  }
}

type HistoryItem = HeraldStoryHistoryPage["items"][number];

/** One story the notifier cannot read or put into words must not hold back every story after it: it is logged and left. */
const perStory = <T>(shard: Required<WatchedShard>, item: HistoryItem, step: () => T[]): T[] => {
  try {
    return step();
  } catch (error) {
    console.error("shard_notifier_unreadable_story", shard.url, item.transaction_hash, item.event_index, error);
    return [];
  }
};

/** Every alert a page of stories owes: each story's recipients, by their level, to their opted-in devices. */
const planAlerts = (env: IdentityEnv, shard: Required<WatchedShard>, page: HeraldStoryHistoryPage) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const recipientsByStory = page.items.flatMap((item) =>
        perStory(shard, item, () => {
          const read = readHistoryStory(item.model, item.value);
          if (!read) return [];
          return [{ item, story: read.story, recipients: storyRecipients(read.story, item.value.owner, read.payload) }];
        }),
      );
      const realmsIds = yield* Effect.promise(() =>
        realmsIdsOfAccounts(env.DB, [...new Set(recipientsByStory.flatMap((entry) => entry.recipients))]),
      );
      const owners = [...new Set(realmsIds.values())];
      const levels = yield* (yield* NotificationPreferenceStore).levels(owners);
      const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices(owners);
      const games = owners.length > 0 ? yield* Effect.promise(() => gameNames(shard.url)) : new Map<number, string>();
      const now = Date.now();
      return recipientsByStory.flatMap(({ item, story, recipients }) =>
        perStory(shard, item, () =>
          recipients.flatMap((account) => {
            const owner = realmsIds.get(account);
            if (!owner || !includesStoryNotification(levels.get(owner) ?? "off", story)) return [];
            const gameId = Number(item.value.game_id);
            const notification = buildStoryNotification({
              sourceId: historyStoryIdentity(
                { chainId: shard.chainId, worldAddress: shard.worldAddress, gameId },
                item,
              ),
              model: item.model,
              recipient: account,
              value: item.value,
              owner,
              gameName: games.get(gameId) ?? `Game ${gameId}`,
              target: gamePath({ chainId: shard.chainId, gameId }),
              now,
            });
            return notification ? alertsForDevices(owner, devices, notification, now) : [];
          }),
        ),
      );
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/**
 * Checks current consent, expiry, the game in view, quiet hours and the player's 24-hour ceiling before sending. A Day
 * open push was already timed out of quiet hours. Returns the alert to retry (or null when it is done), and whether the
 * push service took it.
 */
const deliver = (env: IdentityEnv, entry: OutboxEntry, now: number, sentToday: number) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const done: { next: OutboxEntry | null; accepted: boolean } = { next: null, accepted: false };
      const notification = entry.envelope.notification;
      if (notification.expiresAt <= now) return done;
      const store = yield* PushSubscriptionStore;
      const device = yield* store.find(entry.owner, entry.subscriptionId);
      const levels = yield* (yield* NotificationPreferenceStore).levels([entry.owner]);
      if (!device || device.gameAlertsEnabledAt === null || device.gameAlertsEnabledAt > notification.createdAt)
        return done;
      if (!wantsGameAlerts(device, now) || (levels.get(entry.owner) ?? "off") === "off") return done;
      if (notification.kind !== "day-open" && isQuietAt(now, device.timeZone)) return done;
      if (sentToday >= DAILY_PUSH_CEILING) {
        console.warn("shard_notifier_daily_ceiling", notification.id, `owner ${entry.owner}`);
        return done;
      }
      const outcome = yield* Effect.promise(() => sendPush(vapidKeysOf(env), device, entry.envelope));
      if (outcome === "expired") yield* store.expire(entry.owner, entry.subscriptionId);
      return { next: outcome === "retry" ? retryLater(entry, now, POLL_MS) : null, accepted: outcome === "accepted" };
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/**
 * History and the live page use one identity for stories, battles and raids: the event's transaction and its index in
 * the receipt, read from the history row's own position.
 */
const historyStoryIdentity = (scope: StoryEventScope, item: HeraldHistoryEvent) =>
  storyEventIdentity(scope, {
    ...item.value,
    event_position: { transaction_hash: item.transaction_hash, event_index: item.event_index },
  });

const outboxKey = (entry: OutboxEntry) => `outbox:${entry.envelope.notification.id}:${entry.subscriptionId}`;

/** A failed attempt waits 1, 2, 4, then 8 polls; after MAX_ATTEMPTS the entry is dropped (null). */
const retryLater = (entry: OutboxEntry, now: number, pollMs: number): OutboxEntry | null =>
  entry.attempts + 1 >= MAX_ATTEMPTS
    ? null
    : { ...entry, attempts: entry.attempts + 1, dueAt: now + backoffMs(entry.attempts, pollMs) };

const backoffMs = (attempts: number, pollMs: number) => 2 ** attempts * pollMs;

/** A watch wakes at its army's full time; after each failed read it wakes later, by the delivery backoff, from then. */
const wakeAt = (watch: RestWatch, pollMs: number) =>
  watch.fullAt + (watch.attempts === 0 ? 0 : backoffMs(watch.attempts - 1, pollMs));

/** Runs one stage of the alarm; a failure is logged with its shard and stage, and returns undefined. */
const runStage = async <T>(shard: WatchedShard, stage: string, run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run();
  } catch (error) {
    console.error("shard_notifier_stage_failed", shard.url, stage, error);
    return undefined;
  }
};

/** An alert for each of the owner's opted-in devices that consented before the moment it reports. */
const alertsForDevices = (
  owner: string,
  devices: readonly PushSubscriptionRow[],
  notification: LocalNotificationPayload,
  now: number,
): OutboxEntry[] =>
  devices
    .filter((device) => device.owner === owner && (device.gameAlertsEnabledAt ?? Infinity) <= notification.createdAt)
    .map((device) => ({
      owner,
      subscriptionId: device.id,
      envelope: { version: 1, kind: "game", subscriptionId: device.id, notification },
      attempts: 0,
      dueAt: now,
    }));

/**
 * Every enrolled player who wants game alerts gets the day's push on each opted-in device, timed and worded by the
 * device's own clock, with what their home claims that day. The level is checked again at dispatch.
 */
const dayOpenAlerts = async (env: IdentityEnv, shard: Required<WatchedShard>, opening: DayOpening) => {
  // Eligibility ends at this confirmed enrollment read. Later joins hear of the next day, never this one.
  const accounts = await readEnrolledAccounts(shard.url, opening.gameId);
  const entries: OutboxEntry[] = [];
  // D1 permits 100 bound parameters. Enrollment can be larger than a story page.
  for (let offset = 0; offset < accounts.length; offset += 100) {
    const realmsIds = await realmsIdsOfAccounts(env.DB, accounts.slice(offset, offset + 100));
    const { levels, devices } = await Effect.runPromise(
      Effect.gen(function* () {
        const owners = [...new Set(realmsIds.values())];
        return {
          levels: yield* (yield* NotificationPreferenceStore).levels(owners),
          devices: yield* (yield* PushSubscriptionStore).gameAlertDevices(owners),
        };
      }).pipe(
        Effect.provide(NotificationPreferenceStore.layer(env.DB)),
        Effect.provide(PushSubscriptionStore.layer(env.DB)),
      ),
    );
    for (const [account, owner] of realmsIds) {
      const owned = devices.filter((device) => device.owner === owner);
      if (owned.length === 0 || (levels.get(owner) ?? "off") === "off") continue;
      const claim = await readHomeClaim(shard.url, opening.gameId, account);
      for (const device of owned) {
        const notification = buildDayOpen({
          ...opening,
          chainId: shard.chainId,
          worldAddress: shard.worldAddress,
          owner,
          claim,
          timeZone: device.timeZone,
        });
        if (notification) entries.push(...alertsForDevices(owner, [device], notification, notification.createdAt));
      }
    }
  }
  return entries;
};

/** Players who acted in this page and want rested-army alerts, each with fresh wake times for their armies. */
const watchRestingArmies = (env: IdentityEnv, shard: Required<WatchedShard>, page: HeraldStoryHistoryPage) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { running: acted } = yield* Effect.promise(() => partitionByRunningGame(shard.url, actorsWhoActed(page)));
      const realmsIds = yield* Effect.promise(() =>
        realmsIdsOfAccounts(
          env.DB,
          acted.map(({ actor }) => actor),
        ),
      );
      const owners = [...new Set(realmsIds.values())];
      const levels = yield* (yield* NotificationPreferenceStore).levels(owners);
      const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices(owners);
      const wanted = new Set(
        owners.filter(
          (owner) =>
            includesArmyRestedNotification(levels.get(owner) ?? "off") &&
            devices.some((device) => device.owner === owner),
        ),
      );
      const now = Date.now();
      const resting = acted.flatMap(({ gameId, actor }): RestingActor[] => {
        const owner = realmsIds.get(actor);
        return owner && wanted.has(owner) ? [{ gameId, actor, owner }] : [];
      });
      // A player whose armies cannot be read keeps the watches they had; the rest of the page goes on.
      const watched = yield* Effect.forEach(resting, (actor) =>
        Effect.promise(async () => {
          try {
            return [
              {
                actor,
                watches: restWatchesOf(actor, await readActorArmies(shard.url, actor.gameId, actor.actor, now)),
              },
            ];
          } catch (error) {
            console.error(
              "shard_notifier_armies_unread",
              shard.url,
              `game ${actor.gameId}`,
              `actor ${actor.actor}`,
              error,
            );
            return [];
          }
        }),
      );
      return watched.flat();
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/**
 * The rested push for the player of one watch, if they still want it, to each of their opted-in devices; with the key
 * that holds it to one a day.
 */
const restedAlerts = (env: IdentityEnv, shard: Required<WatchedShard>, watch: RestWatch, now: number) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const levels = yield* (yield* NotificationPreferenceStore).levels([watch.owner]);
      if (!includesArmyRestedNotification(levels.get(watch.owner) ?? "off")) return null;
      const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices([watch.owner]);
      const game = (yield* Effect.promise(() => gameDirectory(shard.url))).get(watch.gameId);
      const day = restedDay(game, watch.fullAt);
      const notification = buildArmyRestedNotification({
        chainId: shard.chainId,
        gameId: watch.gameId,
        day,
        fullAt: watch.fullAt,
        owner: watch.owner,
        gameName: game?.name ?? `Game ${watch.gameId}`,
        now,
      });
      if (!notification) return null;
      return {
        entries: alertsForDevices(watch.owner, devices, notification, now),
        sentKey: `rested-sent:${watch.owner}:${watch.gameId}:${day}`,
      };
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/** The day a rested army counts against: its Frontier game day, else its UTC date. */
const restedDay = (game: HeraldGameDirectory["games"][number] | undefined, fullAt: number): number => {
  if (!game?.expedition || fullAt / 1000 < game.clock.start_main_at) return Math.floor(fullAt / DAY_MS);
  const calendar = {
    seed: BigInt(game.expedition.seed),
    startMainAt: game.clock.start_main_at,
    dayUnitSeconds: game.expedition.day_unit_seconds,
  };
  return dayOf(calendar, fullAt / 1000)!.index;
};

const wantsGameAlerts = (device: PushSubscriptionRow, now: number) =>
  device.gameAlertsEnabledAt !== null && (device.gameForegroundUntil === null || device.gameForegroundUntil <= now);

const gameDirectory = async (url: string) => {
  const directory = await readShard<HeraldGameDirectory>(url, "/games");
  return new Map(directory.games.map((game) => [game.game_id, game]));
};

const gameNames = async (url: string) =>
  new Map([...(await gameDirectory(url))].map(([gameId, game]) => [gameId, game.name]));

const readShard = async <T>(url: string, path: string): Promise<T> => {
  const response = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(SHARD_TIMEOUT_MS), redirect: "manual" });
  if (!response.ok) throw new Error(`${url}${path} answered ${response.status}`);
  return (await response.json()) as T;
};
