import { DurableObject } from "cloudflare:workers";
import { Effect } from "effect";
import {
  encodeStoryHistoryCursor,
  storyEventIdentity,
  type HeraldGameDirectory,
  type HeraldHistoryEvent,
  type HeraldRaceBoard,
  type HeraldStoryHistoryPage,
  type ShardManifest,
  type StoryEventScope,
} from "@bibliothecadao/eternum/game-sync";
import { dayOf } from "@bibliothecadao/eternum/expeditions";
import {
  buildArmyRestedNotification,
  buildDayOpen,
  buildDeepSiteNotification,
  buildStoryNotification,
  type DayOpenPush,
  gamePath,
  includesArmyRestedNotification,
  includesDeepSiteNotification,
  includesStoryNotification,
  kindTag,
  readHistoryStory,
  storyRecipients,
  type LocalNotificationPayload,
  type NotificationLevel,
  type PushEnvelope,
} from "@bibliothecadao/notifications";

import {
  actorArmies,
  actorsWhoActed,
  partitionByRunningGame,
  readActorGame,
  restWatchesOf,
  restWatchKey,
  type RestingActor,
  type RestWatch,
} from "./army-rest";
import {
  hasTheDeep,
  siteAlertedKey,
  siteChances,
  siteWatcherKey,
  siteWatchesOf,
  siteWatchKey,
  type SiteChance,
  type SiteWatch,
  type SiteWatcher,
} from "./site-alert";
import { decodeIdentityEnv, type IdentityEnv } from "./env";
import { planDayOpenings, readEnrolledAccounts, readHomeClaim, type DayOpening } from "./day-open";
import { NotificationPreferenceStore } from "./notification-preference-store";
import { PushSubscriptionStore, type PushSubscriptionRow } from "./push-subscription-store";
import { realmsIdsOfAccounts } from "./realms-accounts";
import { sendToDevice } from "./push-notifications";

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
  /** A Day open push's facts: it is worded again as it goes, by the phone's clock then. */
  dayOpen?: DayOpenPush;
  attempts: number;
  dueAt: number;
}

const STORY_PAGE = 100;
/** How often a page or a rested watch that cannot be read is tried before it is given up, loudly. */
const MAX_ATTEMPTS = 5;
/** The longest a failed delivery waits before its next attempt; it is tried for as long as the alert lives. */
const MAX_RETRY_SPACING_MS = 5 * 60_000;
const SHARD_TIMEOUT_MS = 10_000;
// Fetch confirmed enrollment before the trigger; delivery itself never depends on a shard read.
const DAY_OPEN_PREPARE_MS = 60_000;
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
    await runStage(shard, "deliver", () => this.deliverDue(env, shard));
    const watched = await runStage(shard, "manifest", () => this.withWorldAddress(shard));
    let morePages = false;
    let dayOpenWake: number | null = null;
    if (watched) {
      dayOpenWake = (await runStage(shard, "day-open", () => this.prepareDayOpens(env, watched))) ?? null;
      await runStage(shard, "wake", () => this.wakeRestedArmies(env, watched));
      await runStage(shard, "sites", () => this.rearmOnSiteChanges(watched));
      await runStage(shard, "site-wake", () => this.wakeSiteWatches(env, watched));
      await runStage(shard, "deliver", () => this.deliverDue(env, shard));
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
    await this.forgetPastPreparations();
    const plan = planDayOpenings(directory.games, Date.now(), DAY_OPEN_PREPARE_MS);
    for (const opening of plan.prepare) {
      const preparedKey = `day-open-prepared:${opening.gameId}:${opening.day}`;
      if ((await this.ctx.storage.get(preparedKey)) !== undefined) continue;
      const entries = await dayOpenAlerts(env, shard, opening);
      await this.ctx.storage.transaction(async (txn) => {
        // An enrollment read that finishes late must not resurrect an already opened day.
        if (Date.now() >= opening.opensAt || (await txn.get(preparedKey)) !== undefined) return;
        for (const entry of entries) await putNewest(txn, entry);
        // An empty cohort is prepared too; later polls must not admit later enrollments.
        await txn.put(preparedKey, opening.endsAt);
      });
    }
    return plan.nextAlarmAt;
  }

  /** A day's preparation is forgotten once the day is over. */
  private async forgetPastPreparations(): Promise<void> {
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
    let watched: ActorWatches = { resting: [], sites: [] };
    try {
      entries = cursor ? await planAlerts(env, shard, page) : [];
      watched = cursor ? await watchActors(env, shard, page) : watched;
    } catch (error) {
      if (!(await this.givesUpPage(shard, cursor!, page, error))) return false;
    }
    await this.ctx.storage.transaction(async (txn) => {
      for (const entry of entries) await putNewest(txn, entry);
      // A player's action replaces every wake time of theirs (a moved army gets a new one, a gone army none) and ends a
      // rested alert still waiting to go: its armies are no longer resting.
      for (const { actor, watches } of watched.resting) {
        await txn.delete([...(await txn.list({ prefix: restWatchKey(actor) })).keys()]);
        await txn.delete([...(await txn.list({ prefix: restedOutboxPrefix(shard, actor) })).keys()]);
        for (const watch of watches) await txn.put(restWatchKey(watch), watch);
      }
      // A player's action changes the army they would take a Deep site with: their site watches start again.
      for (const { watcher, chances } of watched.sites) await replaceSiteWatches(txn, watcher, chances);
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
   * Each army whose wake time has come is read again: still recovering, it gets a new wake time; gone, or its game over,
   * nothing. Once the last army the player left recovering is full, the player gets one alert for them all.
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
        await this.retryWatches(shard, watches, restWatchKey, error);
      }
    }
  }

  private async wakeActor(env: IdentityEnv, shard: Required<WatchedShard>, watches: RestWatch[], now: number) {
    const { gameId, actor } = watches[0]!;
    const armies = actorArmies(await readActorGame(shard.url, gameId, actor, now), gameId, actor, now);
    const rested = watches.filter((watch) => armies.find((army) => army.armyId === watch.armyId)?.full);
    const renewed = watches.flatMap((watch) => {
      const army = armies.find((candidate) => candidate.armyId === watch.armyId);
      return !army?.full && army?.fullAt ? [{ ...watch, fullAt: army.fullAt, attempts: 0 }] : [];
    });
    const due = new Set(watches.map(restWatchKey));
    const stillResting = [...(await this.ctx.storage.list({ prefix: restWatchKey({ gameId, actor }) })).keys()].some(
      (key) => !due.has(key),
    );
    const last = rested.length > 0 && renewed.length === 0 && !stillResting;
    const alert = last
      ? await restedAlerts(env, shard, latest(rested), armies.filter((army) => army.full).length, now)
      : [];
    await this.ctx.storage.transaction(async (txn) => {
      for (const watch of watches) await txn.delete(restWatchKey(watch));
      for (const watch of renewed) await txn.put(restWatchKey(watch), watch);
      for (const entry of alert) await putNewest(txn, entry);
    });
  }

  /** Watches a wake could not read wait and are tried again, then are dropped loudly: never retried forever. */
  private async retryWatches<Watch extends { gameId: number; actor: string; attempts: number }>(
    shard: WatchedShard,
    watches: Watch[],
    keyOf: (watch: Watch) => string,
    error: unknown,
  ) {
    const { gameId, actor, attempts } = watches[0]!;
    const exhausted = attempts + 1 >= MAX_ATTEMPTS;
    console.error(
      exhausted ? "shard_notifier_watch_dropped" : "shard_notifier_watch_retry",
      shard.url,
      `game ${gameId}`,
      `actor ${actor}`,
      `watches ${watches.map(keyOf).join(",")}`,
      `attempt ${attempts + 1}`,
      error,
    );
    await this.ctx.storage.transaction(async (txn) => {
      for (const watch of watches) {
        if (exhausted) await txn.delete(keyOf(watch));
        else await txn.put(keyOf(watch), { ...watch, attempts: watch.attempts + 1 });
      }
    });
  }

  /**
   * The Deep's sites changed (a site taken, a guard joined or left, a guard's troops settled): every player watching
   * that game is read again, their chances against the sites as they now stand. The race board's sites are the signal,
   * one read per game; a game whose sites are as last seen costs nothing more.
   */
  private async rearmOnSiteChanges(shard: Required<WatchedShard>): Promise<void> {
    const watchers = [...(await this.ctx.storage.list<SiteWatcher>({ prefix: "site-watcher:" })).values()];
    const { running, ended } = await partitionByRunningGame(shard.url, watchers);
    await this.ctx.storage.transaction(async (txn) => {
      for (const watcher of ended) {
        await txn.delete(siteWatcherKey(watcher));
        await txn.delete([...(await txn.list({ prefix: siteWatchKey(watcher) })).keys()]);
      }
      for (const [key, dayEndsAt] of await txn.list<number>({ prefix: "site-alerted:" }))
        if (dayEndsAt <= Date.now()) await txn.delete(key);
    });
    for (const gameId of new Set(running.map((watcher) => watcher.gameId))) {
      const board = await readShard<HeraldRaceBoard>(shard.url, `/games/${gameId}/race`);
      const signature = JSON.stringify(board.sites);
      if ((await this.ctx.storage.get<string>(`site-signature:${gameId}`)) === signature) continue;
      const now = Date.now();
      const replanned = await Promise.all(
        running
          .filter((watcher) => watcher.gameId === gameId)
          .map(async (watcher) => {
            try {
              const store = await readActorGame(shard.url, gameId, watcher.actor, now);
              return [{ watcher, chances: siteChances(store, gameId, watcher.actor, now) }];
            } catch (error) {
              console.error(
                "shard_notifier_sites_unread",
                shard.url,
                `game ${gameId}`,
                `actor ${watcher.actor}`,
                error,
              );
              return [];
            }
          }),
      );
      await this.ctx.storage.transaction(async (txn) => {
        for (const { watcher, chances } of replanned.flat()) await replaceSiteWatches(txn, watcher, chances);
        await txn.put(`site-signature:${gameId}`, signature);
      });
    }
  }

  /**
   * Each site watch whose time has come is read again: the site within the player's reach now, they get its one alert
   * of the day; still out of reach but coming, a new wake time; out of reach for the rest of the day, nothing.
   */
  private async wakeSiteWatches(env: IdentityEnv, shard: Required<WatchedShard>): Promise<void> {
    const now = Date.now();
    const due = [...(await this.ctx.storage.list<SiteWatch>({ prefix: "site:" })).values()].filter(
      (watch) => siteWakeAt(watch, POLL_MS) <= now,
    );
    const byActor = new Map<string, SiteWatch[]>();
    for (const watch of due) {
      const key = siteWatchKey({ gameId: watch.gameId, actor: watch.actor });
      byActor.set(key, [...(byActor.get(key) ?? []), watch]);
    }
    for (const watches of byActor.values()) {
      try {
        await this.wakeSiteActor(env, shard, watches, now);
      } catch (error) {
        await this.retryWatches(shard, watches, siteWatchKey, error);
      }
    }
  }

  private async wakeSiteActor(env: IdentityEnv, shard: Required<WatchedShard>, watches: SiteWatch[], now: number) {
    const { gameId, actor } = watches[0]!;
    const chances = siteChances(await readActorGame(shard.url, gameId, actor, now), gameId, actor, now);
    const read = watches.map((watch) => ({
      watch,
      chance: chances.find((chance) => chance.siteId === watch.siteId && chance.day === watch.day),
    }));
    const takeable = read.flatMap(({ watch, chance }) =>
      chance && isWithinReach(chance, now) ? [{ watch, chance }] : [],
    );
    const alerts = (
      await Promise.all(takeable.map(({ watch, chance }) => deepSiteAlerts(env, shard, watch, chance, now)))
    ).flat();
    await this.ctx.storage.transaction(async (txn) => {
      for (const { watch, chance } of read) {
        await txn.delete(siteWatchKey(watch));
        if (chance && isWithinReach(chance, now)) await txn.put(siteAlertedKey(watch), chance.dayEndsAt);
        else if (chance?.takeableAt != null)
          await txn.put(siteWatchKey(watch), { ...watch, wakeAt: chance.takeableAt, attempts: 0 });
      }
      for (const entry of alerts) await putNewest(txn, entry);
    });
  }

  /**
   * Sends every due alert. A Day open push goes only while its game still runs, as the shard says now: one prepared
   * before a restart is dropped if its game ended meanwhile, and waits if the shard cannot answer. Other alerts never
   * wait on the shard.
   */
  private async deliverDue(env: IdentityEnv, shard: WatchedShard): Promise<void> {
    const now = Date.now();
    const due = [...(await this.ctx.storage.list<OutboxEntry>({ prefix: "outbox:" }))].filter(
      ([, entry]) => entry.dueAt <= now,
    );
    const running = due.some(([, entry]) => isDayOpen(entry))
      ? await runningFrontierGames(shard).catch((error: unknown) => {
          console.error("shard_notifier_day_open_unchecked", shard.url, error);
          return null;
        })
      : new Set<string>();
    for (const [key, entry] of due) {
      if (!isDayOpen(entry)) await this.deliverEntry(env, key, entry);
      else if (!running) await this.ctx.storage.put(key, { ...entry, dueAt: now + POLL_MS });
      else if (running.has(entry.envelope.notification.target)) await this.deliverEntry(env, key, entry);
      else await this.ctx.storage.delete(key);
    }
  }

  /** One attempt: sent, tried again later while the alert lives, or ended with its reason, logged when it is a loss. */
  private async deliverEntry(env: IdentityEnv, key: string, entry: OutboxEntry): Promise<void> {
    const outcome = await deliver(env, entry, Date.now()).catch((error: unknown): Delivery => {
      console.error(
        "shard_notifier_delivery_failed",
        entry.envelope.notification.id,
        `device ${entry.subscriptionId}`,
        error,
      );
      return retryOrExpire(entry, Date.now());
    });
    if ("next" in outcome) {
      console.warn(
        "shard_notifier_delivery_retry",
        entry.envelope.notification.id,
        `device ${entry.subscriptionId}`,
        `attempt ${outcome.next.attempts}`,
      );
      await this.ctx.storage.put(key, outcome.next);
      return;
    }
    await this.ctx.storage.delete(key);
    if (LOST.has(outcome.ended))
      console.error(
        "shard_notifier_delivery_ended",
        outcome.ended,
        entry.envelope.notification.id,
        `device ${entry.subscriptionId}`,
        `after ${entry.attempts + 1} attempts`,
      );
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
      const games = owners.length > 0 ? yield* Effect.promise(() => gameDirectory(shard.url)) : new Map<number, Game>();
      const now = Date.now();
      return recipientsByStory.flatMap(({ item, story, recipients }) =>
        perStory(shard, item, () =>
          recipients.flatMap((account) => {
            const owner = realmsIds.get(account);
            const gameId = Number(item.value.game_id);
            const game = games.get(gameId);
            if (!owner || !includesStoryNotification(levels.get(owner) ?? "off", story, game?.mode ?? null)) return [];
            const notification = buildStoryNotification({
              sourceId: historyStoryIdentity(
                { chainId: shard.chainId, worldAddress: shard.worldAddress, gameId },
                item,
              ),
              model: item.model,
              recipient: account,
              value: item.value,
              owner,
              game,
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

/** What one attempt left: the alert to try again later, or how it ended. */
type Delivery = { next: OutboxEntry } | { ended: "sent" | "unwanted" | "expired" | "refused" | "device-gone" };
/** Endings where the player never got news they wanted: logged, never silent. */
const LOST = new Set(["expired", "refused", "device-gone"]);

/**
 * Checks current consent, expiry and the game in view before sending; the phone's own night setting decides whether
 * it sounds. A push service that asks to wait (429, 5xx) is tried again while the alert lives.
 */
const deliver = (env: IdentityEnv, entry: OutboxEntry, now: number): Promise<Delivery> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const notification = entry.envelope.notification;
      if (notification.expiresAt <= now) return { ended: "expired" } as const;
      const store = yield* PushSubscriptionStore;
      const device = yield* store.find(entry.owner, entry.subscriptionId);
      const levels = yield* (yield* NotificationPreferenceStore).levels([entry.owner]);
      if (!device || device.gameAlertsEnabledAt === null || device.gameAlertsEnabledAt > notification.createdAt)
        return { ended: "unwanted" } as const;
      if (!wantsGameAlerts(device, now) || (levels.get(entry.owner) ?? "off") === "off")
        return { ended: "unwanted" } as const;
      const outcome = yield* Effect.promise(() => sendToDevice(env, device, envelopeAt(entry, now, device)));
      if (outcome === "expired") yield* store.expire(entry.owner, entry.subscriptionId);
      return outcome === "retry"
        ? retryOrExpire(entry, now)
        : ({ ended: outcome === "accepted" ? "sent" : outcome === "expired" ? "device-gone" : "refused" } as const);
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

/** What the push says as it goes: a Day open push names its day's end on the phone's clock at this moment. */
const envelopeAt = (entry: OutboxEntry, now: number, device: PushSubscriptionRow): PushEnvelope =>
  entry.dayOpen
    ? { ...entry.envelope, notification: buildDayOpen({ ...entry.dayOpen, sendAt: now, timeZone: device.timeZone }) }
    : entry.envelope;

const isDayOpen = (entry: OutboxEntry) => entry.envelope.notification.kind === "day-open";

/** The Frontier games of this shard still running, by their notification target. */
const runningFrontierGames = async (shard: WatchedShard): Promise<Set<string>> => {
  const directory = await readShard<HeraldGameDirectory>(shard.url, "/games");
  if (BigInt(directory.chain) !== BigInt(shard.chainId)) throw new Error(`${shard.url} changed chain`);
  return new Set(
    directory.games
      .filter((game) => game.mode === "frontier" && game.status !== "Ended" && game.status !== "Settled")
      .map((game) => gamePath({ chainId: shard.chainId, gameId: game.game_id })),
  );
};

/**
 * One outbox place per player, collapse tag and device: the phone keeps one alert per tag, so only the newest waiting
 * for it may go. An alert with no tag is its own.
 */
const outboxKey = (entry: OutboxEntry) =>
  `outbox:${entry.owner}:${entry.envelope.notification.tag ?? entry.envelope.notification.id}:${entry.subscriptionId}`;

/** Queues an alert in its place unless a newer one of its tag already waits there: an older retry never replaces news. */
const putNewest = async (txn: DurableObjectTransaction, entry: OutboxEntry) => {
  const waiting = await txn.get<OutboxEntry>(outboxKey(entry));
  if (waiting && waiting.envelope.notification.createdAt > entry.envelope.notification.createdAt) return;
  await txn.put(outboxKey(entry), entry);
};

/** Where a player's rested alert for one game waits, on each of their devices. */
const restedOutboxPrefix = (shard: WatchedShard, actor: RestingActor) =>
  `outbox:${actor.owner}:${kindTag("army-rested", gamePath({ chainId: shard.chainId, gameId: actor.gameId }))}:`;

/** The watch whose army was full last: the moment the player's armies were all rested. */
const latest = (watches: RestWatch[]) => watches.reduce((last, watch) => (watch.fullAt > last.fullAt ? watch : last));

/**
 * A failed attempt waits 1, 2, 4… polls, never more than MAX_RETRY_SPACING_MS, and is tried again for as long as the
 * alert lives; one whose next attempt would fall past its life has expired.
 */
const retryOrExpire = (entry: OutboxEntry, now: number): Delivery => {
  const dueAt = now + Math.min(backoffMs(entry.attempts, POLL_MS), MAX_RETRY_SPACING_MS);
  return dueAt < entry.envelope.notification.expiresAt
    ? { next: { ...entry, attempts: entry.attempts + 1, dueAt } }
    : { ended: "expired" };
};

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
      const push: DayOpenPush = {
        ...opening,
        chainId: shard.chainId,
        worldAddress: shard.worldAddress,
        owner,
        claim,
      };
      for (const device of owned) {
        const notification = buildDayOpen({ ...push, sendAt: push.opensAt, timeZone: device.timeZone });
        entries.push(
          ...alertsForDevices(owner, [device], notification, push.opensAt).map((entry) => ({
            ...entry,
            dayOpen: push,
          })),
        );
      }
    }
  }
  return entries;
};

/** What a page's players left to watch: fresh wake times for their recovering armies, and their Deep site chances. */
interface ActorWatches {
  resting: { actor: RestingActor; watches: RestWatch[] }[];
  sites: { watcher: SiteWatcher; chances: SiteChance[] }[];
}

/**
 * Players who acted in this page and want rested-army or Deep site alerts: one read of each player's game gives both,
 * fresh wake times for their armies and their chances at the Deep's sites.
 */
const watchActors = (
  env: IdentityEnv,
  shard: Required<WatchedShard>,
  page: HeraldStoryHistoryPage,
): Promise<ActorWatches> =>
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
      const wants = (owner: string, includes: (level: NotificationLevel) => boolean) =>
        includes(levels.get(owner) ?? "off") && devices.some((device) => device.owner === owner);
      const now = Date.now();
      // A player whose game cannot be read keeps the watches they had; the rest of the page goes on.
      const watched = yield* Effect.forEach(acted, ({ gameId, actor }) =>
        Effect.promise(async (): Promise<ActorWatches> => {
          const owner = realmsIds.get(actor);
          const rests = owner !== undefined && wants(owner, includesArmyRestedNotification);
          const sites = owner !== undefined && wants(owner, includesDeepSiteNotification);
          if (!owner || (!rests && !sites)) return { resting: [], sites: [] };
          const player = { gameId, actor, owner };
          try {
            const store = await readActorGame(shard.url, gameId, actor, now);
            return {
              resting: rests
                ? [{ actor: player, watches: restWatchesOf(player, actorArmies(store, gameId, actor, now)) }]
                : [],
              sites:
                sites && hasTheDeep(store, gameId)
                  ? [{ watcher: player, chances: siteChances(store, gameId, actor, now) }]
                  : [],
            };
          } catch (error) {
            console.error("shard_notifier_armies_unread", shard.url, `game ${gameId}`, `actor ${actor}`, error);
            return { resting: [], sites: [] };
          }
        }),
      );
      return {
        resting: watched.flatMap((entry) => entry.resting),
        sites: watched.flatMap((entry) => entry.sites),
      };
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/**
 * A player's site watches start again from their chances as they now stand: one per site within reach today and not
 * yet told; the player stays a watcher of the game, so a change at the sites reads them again.
 */
const replaceSiteWatches = async (txn: DurableObjectTransaction, watcher: SiteWatcher, chances: SiteChance[]) => {
  await txn.delete([...(await txn.list({ prefix: siteWatchKey(watcher) })).keys()]);
  await txn.put(siteWatcherKey(watcher), watcher);
  const told = new Set<string>();
  for (const chance of chances) {
    const key = siteAlertedKey({ ...watcher, siteId: chance.siteId, day: chance.day });
    if ((await txn.get(key)) !== undefined) told.add(key);
  }
  for (const watch of siteWatchesOf(watcher, chances, (watch) => told.has(siteAlertedKey(watch))))
    await txn.put(siteWatchKey(watch), watch);
};

/** Whether the site's guard is within the player's reach at this moment. */
const isWithinReach = (chance: SiteChance, now: number): boolean =>
  chance.takeableAt !== null && chance.takeableAt <= now;

/** A site watch wakes when its guard comes within reach; after each failed read later, by the delivery backoff. */
const siteWakeAt = (watch: SiteWatch, pollMs: number) =>
  watch.wakeAt + (watch.attempts === 0 ? 0 : backoffMs(watch.attempts - 1, pollMs));

/** The Deep site push for the player of one watch, if they still want it, to each of their opted-in devices. */
const deepSiteAlerts = (
  env: IdentityEnv,
  shard: Required<WatchedShard>,
  watch: SiteWatch,
  chance: SiteChance,
  now: number,
): Promise<OutboxEntry[]> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const levels = yield* (yield* NotificationPreferenceStore).levels([watch.owner]);
      if (!includesDeepSiteNotification(levels.get(watch.owner) ?? "off")) return [];
      const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices([watch.owner]);
      const game = (yield* Effect.promise(() => gameDirectory(shard.url))).get(watch.gameId);
      const notification = buildDeepSiteNotification({
        chainId: shard.chainId,
        gameId: watch.gameId,
        site: { id: chance.siteId, name: chance.name },
        day: chance.day,
        at: chance.takeableAt!,
        until: chance.dayEndsAt,
        guard: chance.guard,
        army: chance.army,
        owner: watch.owner,
        game,
        now,
      });
      return notification ? alertsForDevices(watch.owner, devices, notification, now) : [];
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/** The rested push for the player of one watch, if they still want it, to each of their opted-in devices. */
const restedAlerts = (
  env: IdentityEnv,
  shard: Required<WatchedShard>,
  watch: RestWatch,
  armies: number,
  now: number,
): Promise<OutboxEntry[]> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const levels = yield* (yield* NotificationPreferenceStore).levels([watch.owner]);
      if (!includesArmyRestedNotification(levels.get(watch.owner) ?? "off")) return [];
      const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices([watch.owner]);
      const game = (yield* Effect.promise(() => gameDirectory(shard.url))).get(watch.gameId);
      const notification = buildArmyRestedNotification({
        chainId: shard.chainId,
        gameId: watch.gameId,
        fullAt: watch.fullAt,
        until: restedUntil(game, watch.fullAt),
        armies,
        owner: watch.owner,
        game,
        now,
      });
      return notification ? alertsForDevices(watch.owner, devices, notification, now) : [];
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/**
 * Until when rested armies stay true news: the end of their Frontier game day (an army of an earlier day is no army),
 * else of their UTC date, and never past the game's end.
 */
const restedUntil = (game: Game | undefined, fullAt: number): number => {
  const gameEnd = game ? game.clock.end_at * 1000 : Infinity;
  if (!game?.expedition || fullAt / 1000 < game.clock.start_main_at)
    return Math.min((Math.floor(fullAt / DAY_MS) + 1) * DAY_MS, gameEnd);
  const calendar = {
    seed: BigInt(game.expedition.seed),
    startMainAt: game.clock.start_main_at,
    endAt: game.clock.end_at,
    dayUnitSeconds: game.expedition.day_unit_seconds,
  };
  return Math.min((dayOf(calendar, fullAt / 1000)?.end ?? 0) * 1000, gameEnd);
};

const wantsGameAlerts = (device: PushSubscriptionRow, now: number) =>
  device.gameAlertsEnabledAt !== null && (device.gameForegroundUntil === null || device.gameForegroundUntil <= now);

type Game = HeraldGameDirectory["games"][number];

const gameDirectory = async (url: string) => {
  const directory = await readShard<HeraldGameDirectory>(url, "/games");
  return new Map(directory.games.map((game) => [game.game_id, game]));
};

const readShard = async <T>(url: string, path: string): Promise<T> => {
  const response = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(SHARD_TIMEOUT_MS), redirect: "manual" });
  if (!response.ok) throw new Error(`${url}${path} answered ${response.status}`);
  return (await response.json()) as T;
};
