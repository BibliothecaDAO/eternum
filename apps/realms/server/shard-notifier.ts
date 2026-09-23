import { DurableObject } from "cloudflare:workers";
import { Effect } from "effect";
import {
  encodeStoryHistoryCursor,
  storyEventIdentity,
  storyEventScopeKey,
  type HeraldGameDirectory,
  type HeraldHistoryEvent,
  type HeraldStoryHistoryPage,
  type ShardManifest,
  type StoryEventScope,
} from "@bibliothecadao/eternum/game-sync";
import {
  buildArmyRestedNotification,
  buildStoryNotification,
  gamePath,
  includesArmyRestedNotification,
  includesStoryNotification,
  readHistoryStory,
  storyRecipients,
  type LocalNotificationPayload,
  type PushEnvelope,
} from "@bibliothecadao/notifications";

import {
  actorsWhoActed,
  readActorArmies,
  restWatchesOf,
  restWatchKey,
  type RestingActor,
  type RestWatch,
} from "./army-rest";
import { decodeIdentityEnv, vapidKeysOf, type IdentityEnv } from "./env";
import { NotificationPreferenceStore } from "./notification-preference-store";
import { PushSubscriptionStore, type PushSubscriptionRow } from "./push-subscription-store";
import { realmsIdsOfAccounts } from "./realms-accounts";
import { sendPush } from "./web-push";

/** The shard this notifier reads, as the directory lists it and as its manifest names its Games contract. */
interface WatchedShard {
  url: string;
  chainId: string;
  worldAddress?: string;
}

/** One game alert waiting for one device. It is written together with the cursor that produced it. */
interface OutboxEntry {
  owner: string;
  subscriptionId: string;
  envelope: PushEnvelope;
  attempts: number;
  dueAt: number;
}

const POLL_MS = 3_000;
const STORY_PAGE = 100;
const MAX_ATTEMPTS = 5;
const SHARD_TIMEOUT_MS = 10_000;

/**
 * Game alerts for one shard in our directory. On its alarm it delivers what is due, then reads the next page of the
 * shard's confirmed stories and turns each into alerts for the recipients' devices. The outbox and the story cursor
 * are written in one storage transaction, so a restart neither skips a story nor alerts twice for one; a device that
 * receives a repeated id drops it by its own claim.
 */
export class ShardNotifier extends DurableObject<Record<string, unknown>> {
  /** Called by the directory's cron for every listed shard; starting an already running notifier changes nothing. */
  async watch(shard: { url: string; chainId: string }): Promise<void> {
    const current = await this.ctx.storage.get<WatchedShard>("shard");
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
    let morePages = false;
    try {
      const watched = await this.withWorldAddress(shard);
      await this.wakeRestedArmies(env, watched);
      await this.deliverDue(env);
      morePages = await this.readStories(env, watched);
    } catch (error) {
      console.error("shard_notifier_failed", shard.url, error);
    }
    await this.ctx.storage.setAlarm(Date.now() + (morePages ? 0 : POLL_MS));
  }

  private async withWorldAddress(shard: WatchedShard): Promise<Required<WatchedShard>> {
    if (shard.worldAddress) return shard as Required<WatchedShard>;
    const manifest = await readShard<ShardManifest>(shard.url, "/manifest");
    if (BigInt(manifest.chainId) !== BigInt(shard.chainId)) throw new Error(`${shard.url} changed chain`);
    const worldAddress = manifest.contracts.season;
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
    const entries = cursor ? await planAlerts(env, shard, page) : [];
    const resting = cursor ? await watchRestingArmies(env, shard, page) : [];
    await this.ctx.storage.transaction(async (txn) => {
      for (const entry of entries) await txn.put(outboxKey(entry), entry);
      // A player's action replaces every wake time of theirs: a moved army gets a new one, a gone army none.
      for (const { actor, watches } of resting) {
        await txn.delete([...(await txn.list({ prefix: restWatchKey(actor) })).keys()]);
        for (const watch of watches) await txn.put(restWatchKey(watch), watch);
      }
      await txn.put("cursor", encodeStoryHistoryCursor(page.next_cursor));
    });
    return cursor !== undefined && page.items.length === STORY_PAGE;
  }

  /**
   * Each army whose wake time has come is read again: still there and full, it gets one alert; still recovering, a new
   * wake time; gone, nothing.
   */
  private async wakeRestedArmies(env: IdentityEnv, shard: Required<WatchedShard>): Promise<void> {
    const now = Date.now();
    const due = [...(await this.ctx.storage.list<RestWatch>({ prefix: "rest:" })).values()].filter(
      (watch) => watch.fullAt <= now,
    );
    const byActor = new Map<string, RestWatch[]>();
    for (const watch of due) byActor.set(restWatchKey(watch), [...(byActor.get(restWatchKey(watch)) ?? []), watch]);
    for (const watches of byActor.values()) {
      const armies = await readActorArmies(shard.url, watches[0]!.gameId, watches[0]!.actor, now);
      const alerts: OutboxEntry[] = [];
      const renewed: RestWatch[] = [];
      for (const watch of watches) {
        const army = armies.find((candidate) => candidate.armyId === watch.armyId);
        if (army?.full) alerts.push(...(await restedAlerts(env, shard, watch, now)));
        else if (army?.fullAt) renewed.push({ ...watch, fullAt: army.fullAt });
      }
      await this.ctx.storage.transaction(async (txn) => {
        for (const watch of watches) await txn.delete(restWatchKey(watch));
        for (const watch of renewed) await txn.put(restWatchKey(watch), watch);
        for (const entry of alerts) await txn.put(outboxKey(entry), entry);
      });
    }
  }

  private async deliverDue(env: IdentityEnv): Promise<void> {
    const now = Date.now();
    const due = [...(await this.ctx.storage.list<OutboxEntry>({ prefix: "outbox:" }))].filter(
      ([, entry]) => entry.dueAt <= now,
    );
    for (const [key, entry] of due) {
      const next = await deliver(env, entry, now);
      if (next) await this.ctx.storage.put(key, next);
      else await this.ctx.storage.delete(key);
    }
  }
}

/** Every alert a page of stories owes: each story's recipients, by their level, to their opted-in devices. */
const planAlerts = (env: IdentityEnv, shard: Required<WatchedShard>, page: HeraldStoryHistoryPage) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const recipientsByStory = page.items.flatMap((item) => {
        try {
          const read = readHistoryStory(item.model, item.value);
          if (!read) return [];
          return [{ item, story: read.story, recipients: storyRecipients(read.story, item.value.owner, read.payload) }];
        } catch (error) {
          // One story the policy cannot read must not hold back every story after it.
          console.error("shard_notifier_unreadable_story", shard.url, item.transaction_hash, item.event_index, error);
          return [];
        }
      });
      const realmsIds = yield* Effect.promise(() =>
        realmsIdsOfAccounts(env.DB, [...new Set(recipientsByStory.flatMap((entry) => entry.recipients))]),
      );
      const owners = [...new Set(realmsIds.values())];
      const levels = yield* (yield* NotificationPreferenceStore).levels(owners);
      const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices(owners);
      const games = owners.length > 0 ? yield* Effect.promise(() => gameNames(shard.url)) : new Map<number, string>();
      const now = Date.now();
      return recipientsByStory.flatMap(({ item, story, recipients }) =>
        recipients.flatMap((account) => {
          const owner = realmsIds.get(account);
          if (!owner || !includesStoryNotification(levels.get(owner) ?? "off", story)) return [];
          const gameId = Number(item.value.game_id);
          const notification = buildStoryNotification({
            sourceId: historyStoryIdentity({ chainId: shard.chainId, worldAddress: shard.worldAddress, gameId }, item),
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
      );
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/**
 * Sends one alert unless its moment has passed or the device no longer wants it: revoked, in the foreground, or its
 * account now off. Returns the entry to keep for a retry, or null when it is done.
 */
const deliver = (env: IdentityEnv, entry: OutboxEntry, now: number) =>
  Effect.runPromise(
    Effect.gen(function* () {
      if (entry.envelope.notification.expiresAt <= now) return null;
      const store = yield* PushSubscriptionStore;
      const device = yield* store.find(entry.owner, entry.subscriptionId);
      const levels = yield* (yield* NotificationPreferenceStore).levels([entry.owner]);
      if (!device || !wantsGameAlerts(device, now) || (levels.get(entry.owner) ?? "off") === "off") return null;
      const outcome = yield* Effect.promise(() => sendPush(vapidKeysOf(env), device, entry.envelope));
      if (outcome === "expired") yield* store.expire(entry.owner, entry.subscriptionId);
      if (outcome !== "retry" || entry.attempts + 1 >= MAX_ATTEMPTS) return null;
      return { ...entry, attempts: entry.attempts + 1, dueAt: now + 2 ** entry.attempts * 1_000 };
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/**
 * A StoryEvent keeps the identity the live page gives it, so a push and a page alert for one story are one alert. A
 * native battle or raid is named by where it sits in the chain.
 */
const historyStoryIdentity = (scope: StoryEventScope, item: HeraldHistoryEvent) =>
  item.model === "StoryEvent"
    ? storyEventIdentity(scope, item.value)
    : `${storyEventScopeKey(scope)}:0x${BigInt(item.transaction_hash).toString(16)}:${item.model}:${item.event_index}`;

const outboxKey = (entry: OutboxEntry) => `outbox:${entry.envelope.notification.id}:${entry.subscriptionId}`;

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

/** Players who acted in this page and want rested-army alerts, each with fresh wake times for their armies. */
const watchRestingArmies = (env: IdentityEnv, shard: Required<WatchedShard>, page: HeraldStoryHistoryPage) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const acted = actorsWhoActed(page);
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
      return yield* Effect.forEach(resting, (actor) =>
        Effect.promise(async () => ({
          actor,
          watches: restWatchesOf(actor, await readActorArmies(shard.url, actor.gameId, actor.actor, now)),
        })),
      );
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

/** The rested-army alert for one watch, if the owner still wants it, to each of their opted-in devices. */
const restedAlerts = (env: IdentityEnv, shard: Required<WatchedShard>, watch: RestWatch, now: number) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const levels = yield* (yield* NotificationPreferenceStore).levels([watch.owner]);
      if (!includesArmyRestedNotification(levels.get(watch.owner) ?? "off")) return [];
      const devices = yield* (yield* PushSubscriptionStore).gameAlertDevices([watch.owner]);
      const games = yield* Effect.promise(() => gameNames(shard.url));
      const notification = buildArmyRestedNotification({
        chainId: shard.chainId,
        gameId: watch.gameId,
        armyId: watch.armyId,
        fullAt: watch.fullAt,
        owner: watch.owner,
        gameName: games.get(watch.gameId) ?? `Game ${watch.gameId}`,
        now,
      });
      return notification ? alertsForDevices(watch.owner, devices, notification, now) : [];
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
    ),
  );

const wantsGameAlerts = (device: PushSubscriptionRow, now: number) =>
  device.gameAlertsEnabledAt !== null && (device.gameForegroundUntil === null || device.gameForegroundUntil <= now);

const gameNames = async (url: string) => {
  const directory = await readShard<HeraldGameDirectory>(url, "/games");
  return new Map(directory.games.map((game) => [game.game_id, game.name]));
};

const readShard = async <T>(url: string, path: string): Promise<T> => {
  const response = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(SHARD_TIMEOUT_MS), redirect: "manual" });
  if (!response.ok) throw new Error(`${url}${path} answered ${response.status}`);
  return (await response.json()) as T;
};
