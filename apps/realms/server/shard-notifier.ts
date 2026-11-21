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
  buildRingOpenNotification,
  buildSiteVulnerableNotification,
  includesKind,
  buildDayOpen,
  buildStoryNotification,
  type DayOpenPush,
  gamePath,
  includesArmyRestedNotification,
  includesStoryNotification,
  kindTag,
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
import { followDeepSites } from "./deep-site-stream";
import { ShardReleaseMismatchError } from "@bibliothecadao/eternum/game-client";
import { readReleaseCatalogue, type ReleaseCatalogue } from "./game-facts";
import { readDeepAlerts, type DeepRingOpening, type DeepSiteWatch } from "./deep-site-watch";
import { decodeIdentityEnv, type IdentityEnv } from "./env";
import { planDayOpenings, readEnrolledAccounts, type DayOpening } from "./day-open";
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
  siteWatch?: DeepSiteWatch;
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
  private readonly siteStreams = new Map<number, Map<string | undefined, () => void>>();
  private readonly changedSiteGames = new Set<number>();

  private closeSiteStreams(): void {
    for (const streams of this.siteStreams.values()) for (const stop of streams.values()) stop();
    this.siteStreams.clear();
    this.changedSiteGames.clear();
  }

  /** Called by the directory's cron for every listed shard; starting an already running notifier changes nothing. */
  async watch(shard: { url: string; chainId: string }): Promise<void> {
    const current = await this.ctx.storage.get<WatchedShard>("shard");
    // Its cursor, wake times and outbox belong to one chain: a new chain at this URL is read from its own head.
    if (current && BigInt(current.chainId) !== BigInt(shard.chainId)) {
      this.closeSiteStreams();
      await this.ctx.storage.deleteAll();
    }
    if (current?.url !== shard.url || current.chainId !== shard.chainId) await this.ctx.storage.put("shard", shard);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now());
  }

  async stop(): Promise<void> {
    this.closeSiteStreams();
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
      await runStage(shard, "sites", () => this.watchDeepSites(env, watched));
      await runStage(shard, "wake", () => this.wakeRestedArmies(env, watched));
      await runStage(shard, "deliver", () => this.deliverDue(env, shard));
      morePages = (await runStage(shard, "stories", () => this.readStories(env, watched))) ?? false;
    }
    await this.scheduleNextAlarm(morePages, dayOpenWake);
  }

  private async scheduleNextAlarm(morePages: boolean, dayOpenWake: number | null): Promise<void> {
    const now = Date.now();
    let next = now + (morePages ? 0 : POLL_MS);
    if (dayOpenWake !== null && dayOpenWake > now) next = Math.min(next, dayOpenWake);
    for (const watch of (await this.ctx.storage.list<DeepSiteWatch>({ prefix: "site-watch:" })).values())
      next = Math.min(next, watch.dueAt);
    for (const entry of (await this.ctx.storage.list<OutboxEntry>({ prefix: "outbox:" })).values())
      next = Math.min(next, entry.dueAt);
    await this.ctx.storage.setAlarm(Math.max(now, next));
  }

  private async prepareDayOpens(env: IdentityEnv, shard: Required<WatchedShard>): Promise<number | null> {
    const directory = await readShard<HeraldGameDirectory>(shard.url, "/games");
    if (BigInt(directory.chain) !== BigInt(shard.chainId)) throw new Error(`${shard.url} changed chain`);
    await this.syncSiteStreams(shard, directory);
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
    let resting: { actor: RestingActor; watches: RestWatch[] }[] = [];
    try {
      entries = cursor ? await planAlerts(env, shard, page) : [];
      resting = cursor ? await watchRestingArmies(env, shard, page) : [];
    } catch (error) {
      if (!(await this.givesUpPage(shard, cursor!, page, error))) return false;
    }
    await this.ctx.storage.transaction(async (txn) => {
      for (const entry of entries) await putNewest(txn, entry);
      // A player's action replaces every wake time of theirs (a moved army gets a new one, a gone army none) and ends a
      // rested alert still waiting to go: its armies are no longer resting.
      for (const { actor, watches } of resting) {
        await txn.delete([...(await txn.list({ prefix: restWatchKey(actor) })).keys()]);
        await txn.delete([...(await txn.list({ prefix: restedOutboxPrefix(shard, actor) })).keys()]);
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

  private async syncSiteStreams(shard: WatchedShard, directory: HeraldGameDirectory): Promise<void> {
    const running = new Set(
      directory.games
        .filter((game) => game.mode === "frontier" && game.status !== "Ended" && game.status !== "Settled")
        .map((game) => game.game_id),
    );
    for (const [gameId, streams] of this.siteStreams) {
      if (running.has(gameId)) continue;
      for (const stop of streams.values()) stop();
      this.siteStreams.delete(gameId);
      this.changedSiteGames.delete(gameId);
    }
    for (const gameId of running) {
      if (this.siteStreams.has(gameId)) continue;
      const stop = followDeepSites(shard.url, gameId, () => {
        this.changedSiteGames.add(gameId);
      });
      this.siteStreams.set(gameId, new Map([[undefined, stop]]));
    }
    await this.ctx.storage.transaction(async (txn) => {
      for (const [key, watch] of await txn.list<DeepSiteWatch>({ prefix: "site-watch:" }))
        if (!running.has(watch.gameId) || watch.until <= Date.now()) await txn.delete(key);
      for (const prefix of ["site-notified:", "ring-notified:"])
        for (const [key, until] of await txn.list<number>({ prefix })) if (until <= Date.now()) await txn.delete(key);
    });
  }

  private syncPlayerSiteStreams(shard: WatchedShard, gameId: number, actors: Set<string>): void {
    const streams = this.siteStreams.get(gameId)!;
    for (const [actor, stop] of streams) {
      if (actor === undefined || actors.has(actor)) continue;
      stop();
      streams.delete(actor);
    }
    for (const actor of actors) {
      if (streams.has(actor)) continue;
      streams.set(
        actor,
        followDeepSites(
          shard.url,
          gameId,
          () => {
            this.changedSiteGames.add(gameId);
          },
          actor,
        ),
      );
    }
  }

  /** Public rivals and private research/army changes refresh the eligible cohort, including idle players. */
  private async watchDeepSites(env: IdentityEnv, shard: Required<WatchedShard>): Promise<void> {
    for (const gameId of [...this.changedSiteGames]) {
      this.changedSiteGames.delete(gameId);
      try {
        const { watches, rings, actors } = await siteWatchesForGame(env, shard, gameId);
        this.syncPlayerSiteStreams(shard, gameId, actors);
        const now = Date.now();
        const ringAlerts = await Promise.all(
          rings.map(async (ring) => ({ ring, alerts: await ringOpenAlerts(env, shard, ring, now) })),
        );
        await this.ctx.storage.transaction(async (txn) => {
          await txn.delete([...(await txn.list({ prefix: `site-watch:${gameId}:` })).keys()]);
          for (const watch of watches)
            if ((await txn.get(siteNotifiedKey(watch))) === undefined) await txn.put(siteWatchKey(watch), watch);
          for (const { ring, alerts } of ringAlerts) {
            if ((await txn.get(ringNotifiedKey(ring))) !== undefined) continue;
            for (const entry of alerts) await putNewest(txn, entry);
            await txn.put(ringNotifiedKey(ring), ring.until);
          }
        });
        console.info("deep_site_watches", shard.url, gameId, watches.length);
      } catch (error) {
        this.changedSiteGames.add(gameId);
        throw error;
      }
    }
    const now = Date.now();
    const due = [...(await this.ctx.storage.list<DeepSiteWatch>({ prefix: "site-watch:" })).values()].filter(
      (watch) => watch.dueAt <= now,
    );
    for (const watch of due) {
      try {
        await this.wakeSite(env, shard, watch, now);
      } catch (error) {
        const attempts = watch.attempts + 1;
        console.error(
          attempts >= MAX_ATTEMPTS ? "deep_site_watch_dropped" : "deep_site_watch_retry",
          shard.url,
          siteWatchKey(watch),
          attempts,
          error,
        );
        if (attempts >= MAX_ATTEMPTS) await this.ctx.storage.delete(siteWatchKey(watch));
        else
          await this.ctx.storage.put(siteWatchKey(watch), {
            ...watch,
            attempts,
            dueAt: now + backoffMs(attempts - 1, POLL_MS),
          });
      }
    }
  }

  private async wakeSite(env: IdentityEnv, shard: Required<WatchedShard>, watch: DeepSiteWatch, now: number) {
    const fresh = (await readDeepAlerts(shard.url, watch, now, await readReleaseCatalogue(shard.url))).sites
      .filter((candidate) => siteWatchKey(candidate) === siteWatchKey(watch))
      .sort((left, right) => left.dueAt - right.dueAt)[0];
    const ready = fresh && fresh.dueAt <= now;
    const alerts = ready ? await siteAlerts(env, shard, fresh, now) : [];
    await this.ctx.storage.transaction(async (txn) => {
      await txn.delete(siteWatchKey(watch));
      if (!fresh) return;
      if (!ready) {
        await txn.put(siteWatchKey(fresh), fresh);
        return;
      }
      if ((await txn.get(siteNotifiedKey(fresh))) !== undefined) return;
      for (const entry of alerts) await putNewest(txn, entry);
      await txn.put(siteNotifiedKey(fresh), fresh.until);
    });
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
        await this.retryWatches(shard, watches, now, error);
      }
    }
  }

  private async wakeActor(env: IdentityEnv, shard: Required<WatchedShard>, watches: RestWatch[], now: number) {
    const { gameId, actor } = watches[0]!;
    const armies = await readActorArmies(shard.url, gameId, actor, now, await readReleaseCatalogue(shard.url));
    const rested = watches.flatMap((watch) => {
      const army = armies.find((army) => army.armyId === watch.armyId);
      return army?.full && army.fullAt !== null ? [{ ...watch, fullAt: army.fullAt }] : [];
    });
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
    const running = due.some(([, entry]) => isDayOpen(entry) || entry.siteWatch)
      ? await runningFrontierGames(shard).catch((error: unknown) => {
          console.error("shard_notifier_day_open_unchecked", shard.url, error);
          return null;
        })
      : new Set<string>();
    for (const [key, entry] of due) {
      if (!isDayOpen(entry) && !entry.siteWatch) await this.deliverEntry(env, key, entry);
      else if (!running) await this.ctx.storage.put(key, { ...entry, dueAt: now + POLL_MS });
      else {
        const target = entry.siteWatch
          ? gamePath({ chainId: shard.chainId, gameId: entry.siteWatch.gameId })
          : entry.envelope.notification.target;
        if (!running.has(target)) await this.ctx.storage.delete(key);
        else await this.deliverCurrentSite(env, shard, key, entry, now);
      }
    }
  }

  private async deliverCurrentSite(
    env: IdentityEnv,
    shard: WatchedShard,
    key: string,
    entry: OutboxEntry,
    now: number,
  ): Promise<void> {
    try {
      if (entry.siteWatch && !(await siteStillReady(shard, entry.siteWatch, now))) {
        await this.ctx.storage.delete(key);
        return;
      }
    } catch (error) {
      console.error("deep_site_delivery_unchecked", shard.url, key, error);
      const outcome = retryOrExpire(entry, now);
      if ("next" in outcome) await this.ctx.storage.put(key, outcome.next);
      else await this.ctx.storage.delete(key);
      return;
    }
    await this.deliverEntry(env, key, entry);
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
      const push: DayOpenPush = {
        ...opening,
        chainId: shard.chainId,
        worldAddress: shard.worldAddress,
        owner,
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
      let catalogue: ReleaseCatalogue | undefined;
      const armiesOf = async ({ gameId, actor }: RestingActor) => {
        catalogue ??= await readReleaseCatalogue(shard.url);
        try {
          return await readActorArmies(shard.url, gameId, actor, now, catalogue);
        } catch (error) {
          if (!(error instanceof ShardReleaseMismatchError)) throw error;
          catalogue = await readReleaseCatalogue(shard.url);
          return readActorArmies(shard.url, gameId, actor, now, catalogue);
        }
      };
      // A player whose armies cannot be read keeps the watches they had; the rest of the page goes on.
      const watched = yield* Effect.forEach(resting, (actor) =>
        Effect.promise(async () => {
          try {
            return [{ actor, watches: restWatchesOf(actor, await armiesOf(actor)) }];
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
    scheduledEndAt: game.clock.scheduled_end_at,
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

const siteWatchKey = (watch: DeepSiteWatch) => `site-watch:${watch.gameId}:${watch.owner}:${watch.kind}:${watch.day}`;
const siteNotifiedKey = (watch: DeepSiteWatch) =>
  `site-notified:${watch.gameId}:${watch.owner}:${watch.kind}:${watch.day}`;
const ringNotifiedKey = (ring: DeepRingOpening) =>
  `ring-notified:${ring.gameId}:${ring.owner}:${ring.ring}:${ring.day}`;

/** Enrollment, consent and current realm facts are read before planning the next threshold. */
async function siteWatchesForGame(
  env: IdentityEnv,
  shard: WatchedShard,
  gameId: number,
): Promise<{ watches: DeepSiteWatch[]; rings: DeepRingOpening[]; actors: Set<string> }> {
  const accounts = await readEnrolledAccounts(shard.url, gameId);
  let catalogue: ReleaseCatalogue | undefined;
  const planned = new Map<string, DeepSiteWatch>();
  const rings = new Map<string, DeepRingOpening>();
  const actors = new Set<string>();
  for (let offset = 0; offset < accounts.length; offset += 100) {
    const owners = await realmsIdsOfAccounts(env.DB, accounts.slice(offset, offset + 100));
    const wanted = await Effect.runPromise(
      Effect.gen(function* () {
        const ids = [...new Set(owners.values())];
        const levels = yield* (yield* NotificationPreferenceStore).levels(ids);
        const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices(ids);
        return new Set(
          ids.filter(
            (owner) =>
              includesKind(levels.get(owner) ?? "off", "site-vulnerable") &&
              devices.some((device) => device.owner === owner),
          ),
        );
      }).pipe(
        Effect.provide(NotificationPreferenceStore.layer(env.DB)),
        Effect.provide(PushSubscriptionStore.layer(env.DB)),
      ),
    );
    for (const [actor, owner] of owners) {
      if (!wanted.has(owner)) continue;
      actors.add(actor);
      catalogue ??= await readReleaseCatalogue(shard.url);
      const alerts = await readDeepAlerts(shard.url, { gameId, actor, owner }, Date.now(), catalogue);
      for (const watch of alerts.sites) {
        const previous = planned.get(siteWatchKey(watch));
        if (!previous || previous.dueAt > watch.dueAt) planned.set(siteWatchKey(watch), watch);
      }
      for (const ring of alerts.rings) rings.set(ringNotifiedKey(ring), ring);
    }
  }
  return { watches: [...planned.values()], rings: [...rings.values()], actors };
}

async function siteAlerts(
  env: IdentityEnv,
  shard: WatchedShard,
  watch: DeepSiteWatch,
  now: number,
): Promise<OutboxEntry[]> {
  const notification = buildSiteVulnerableNotification({ ...watch, chainId: shard.chainId, now });
  return (await deepAlerts(env, watch.owner, notification, now)).map((entry) => ({ ...entry, siteWatch: watch }));
}

async function ringOpenAlerts(
  env: IdentityEnv,
  shard: WatchedShard,
  ring: DeepRingOpening,
  now: number,
): Promise<OutboxEntry[]> {
  return deepAlerts(env, ring.owner, buildRingOpenNotification({ ...ring, chainId: shard.chainId, now }), now);
}

async function deepAlerts(
  env: IdentityEnv,
  owner: string,
  notification: LocalNotificationPayload | null,
  now: number,
): Promise<OutboxEntry[]> {
  if (!notification) return [];
  return Effect.runPromise(
    Effect.gen(function* () {
      const levels = yield* (yield* NotificationPreferenceStore).levels([owner]);
      if (!includesKind(levels.get(owner) ?? "off", "site-vulnerable")) return [];
      const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices([owner]);
      return alertsForDevices(owner, devices, notification, now);
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );
}

async function siteStillReady(shard: WatchedShard, watch: DeepSiteWatch, now: number): Promise<boolean> {
  return (await readDeepAlerts(shard.url, watch, now, await readReleaseCatalogue(shard.url))).sites.some(
    (fresh) => siteWatchKey(fresh) === siteWatchKey(watch) && fresh.siteId === watch.siteId && fresh.dueAt <= now,
  );
}
