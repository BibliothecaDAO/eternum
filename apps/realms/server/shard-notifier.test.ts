import {
  type ArmyState,
  snapshot,
  siteSnapshot,
  siteGuardTroops,
  type DeepSiteFixture,
  mistFacts,
  GAME_ID,
  RELEASE,
  PLAYER_ACCOUNT,
  HOME,
  ARMY,
  ARMIES_TICK_SECONDS,
  DAY_UNIT_SECONDS,
  REST_TICKS,
  SEASON_START,
  TODAY,
} from "./fixtures/shard-world";
import { dayOf } from "@bibliothecadao/eternum/expeditions";
import { nativeBaneConstants, nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import type { PushEnvelope } from "@bibliothecadao/notifications";
import { Response as SocketResponse, WebSocketPair } from "miniflare";
import { beforeAll, describe, expect, it } from "vitest";

import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import recordedPages from "./fixtures/staging-story-pages.json";
import { realmsIdOf } from "./realms-id";
import {
  apnsKey,
  buildWorkerBundle,
  deviceKeys,
  migrationStatements,
  newStorage,
  ORIGIN,
  pause,
  startWorker,
  vapidKeys,
  waitUntil,
} from "./workerd-harness";
import { releaseLine } from "../../../packages/core/src/test-support/releases";
import type { NativeReleases } from "@bibliothecadao/eternum/game-sync";

/**
 * The shard notifier runs as it does on Cloudflare: the bundled Worker with its Durable Object, alarms and D1 in
 * workerd. Only the network is faked: one shard's Herald and one push service.
 */
const SHARD = "https://shard-a.test";
const CHAIN_ID = "0xa";
const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/player-device";
const APNS_DEVICE = "https://api.push.apple.com/3/device/";
const DEVICE_ID = "00000000-0000-4000-8000-000000000001";
const OWNER = realmsIdOf("player-one");
/** The notifier uses its deployed three-second interval; its retries wait 1, 2, 4, then 8 polls. */
const POLL_MS = 3_000;
const polls = (count: number) => count * POLL_MS;
const ticks = (count: number) => count * ARMIES_TICK_SECONDS * 1000;

let bundle: string;

beforeAll(() => {
  bundle = buildWorkerBundle();
}, 180_000);

const armiesTick = () => Math.floor(Date.now() / 1000 / ARMIES_TICK_SECONDS);

/**
 * Story history as staging's Herald served it: every row the fake Herald serves is a recorded row with only the game,
 * players, entities and times changed. The fake node supplies the current action order and story index.
 */
type RecordedItem = (typeof recordedPages.pages)[number]["page"]["items"][number];
const recordedItem = (model: string, story?: string): RecordedItem => {
  const item = recordedPages.pages
    .flatMap(({ page }) => page.items)
    .find((row) => row.model === model && (!story || story in ((row.value as { story?: object }).story ?? {})));
  if (!item) throw new Error(`No recorded ${model}${story ? ` ${story}` : ""} in the staging pages`);
  return structuredClone(item);
};

/**
 * One shard's Herald: a history log that grows, the game's phase, and the player's army as its snapshot shows it now.
 * Like Herald, it no longer serves a settled game's armies.
 */
const createHerald = () => {
  const log: HeraldHistoryEvent[] = [];
  const state = {
    army: null as null | ArmyState,
    site: null as null | DeepSiteFixture,
    /** The neighbour's army, spent whenever the player acts, so it rests alongside the player's. */
    neighbourArmy: null as null | ArmyState,
    secondArmy: null as null | ArmyState,
    status: "Live" as "Live" | "Settled",
    /** The game's mode in the directory: fights between players push only outside Frontier. */
    mode: "frontier" as "frontier" | "blitz",
    chain: CHAIN_ID,
    /** Snapshot reads answered, and whether this Herald is failing them. */
    snapshotReads: 0,
    snapshotFails: false,
    /** Reads of /games, and how many manifest reads after the first game directory read fail with a 503. */
    /** Manifest and owner-scoped snapshot reads in the order they were answered. */
    reads: [] as string[],
    gamesReads: 0,
    manifestFailures: 0,
    mistEndedAt: undefined as number | undefined,
    todayBane: nativeBaneConstants.MIST_TIDE as number | null,
    requestedModels: [] as string[],
    seasonStart: SEASON_START,
    /** The season's end, when a test ends it early; else 420 day units after its start. */
    seasonEnd: null as number | null,
    members: [PLAYER_ACCOUNT],
    /** The players the snapshot reads were scoped to as actors, in order. */
    actorReads: [] as string[],
    /** The players whose scoped stream has been sent its whole snapshot. */
    streamedSnapshots: [] as string[],
    /** The releases the manifest lists. */
    catalogue: { [RELEASE]: releaseLine(bindings.schemaIdentity, [RELEASE - 1, RELEASE])[RELEASE]! } as NativeReleases,
    pins: new Map<string, { release_id: number; created_release_id: number }>(),
    /** Releases published into the catalogue once the player's own armies have been read. */
    publishAfterPlayerRead: null as null | NativeReleases,
  };
  const answer = (url: URL): unknown => {
    if (url.pathname === "/games") state.gamesReads++;
    if (url.pathname === "/manifest") {
      state.reads.push("manifest");
      if (state.gamesReads > 0 && state.manifestFailures > 0) {
        state.manifestFailures--;
        return new Response("unavailable", { status: 503 });
      }
    }
    if (url.pathname === "/manifest")
      return {
        version: 1,
        chainId: state.chain,
        contracts: { games: "0x5e45" },
        releases: state.catalogue,
      };
    if (url.pathname === "/games")
      return {
        chain: state.chain,
        games: [
          {
            game_id: GAME_ID,
            name: "frontier-1793451600",
            season_number: 0,
            status: state.status,
            mode: state.mode,
            clock: {
              start_main_at: state.seasonStart,
              scheduled_end_at: state.seasonEnd ?? state.seasonStart + 21 * 20 * DAY_UNIT_SECONDS,
              end_at: state.seasonEnd ?? state.seasonStart + 21 * 20 * DAY_UNIT_SECONDS,
            },
            expedition: { seed: "1", day_unit_seconds: DAY_UNIT_SECONDS },
          },
        ],
      };
    if (url.pathname === `/games/${GAME_ID}/snapshot`) {
      state.snapshotReads++;
      state.requestedModels.push(url.searchParams.get("models") ?? "");
      if (url.searchParams.get("actor")) {
        state.actorReads.push(url.searchParams.get("actor")!);
        state.reads.push("snapshot");
      }
    }
    if (url.pathname === `/games/${GAME_ID}/snapshot` && state.snapshotFails)
      return Response.json({ error: "snapshot unavailable" }, { status: 500 });
    if (url.pathname === `/games/${GAME_ID}/snapshot` && state.status === "Settled")
      return Response.json(
        { error: `Game ${GAME_ID} is finalized; its review snapshot holds GameRegistry` },
        { status: 409 },
      );
    if (url.pathname === `/games/${GAME_ID}/snapshot`) {
      const read = snapshot(
        state.army,
        state.neighbourArmy,
        url.searchParams.get("owner"),
        state.members,
        state.secondArmy,
      );
      const scoped = siteSnapshot(
        { ...read, models: [...read.models, ...mistFacts(state.mistEndedAt, state.todayBane)] },
        state.site,
        url.searchParams.get("owner"),
      );
      const pin = state.pins.get(url.searchParams.get("owner") ?? "");
      if (pin)
        scoped.models.find(({ model }) => model === "GameRelease")!.rows = [
          { key: "0x1", value: { game_id: GAME_ID, ...pin } },
        ];
      if (url.searchParams.get("owner") === PLAYER_ACCOUNT && state.publishAfterPlayerRead) {
        Object.assign(state.catalogue, state.publishAfterPlayerRead);
        state.publishAfterPlayerRead = null;
      }
      return scoped;
    }
    const page = { chain: state.chain, world_address: "0x5e45", complete_through_block: 10 + log.length };
    const after = url.searchParams.get("after");
    if (!after) return { ...page, next_cursor: { block: 10, transaction: 2147483647, event: 2147483647 }, items: [] };
    const [block, transaction, event] = after.split(":").map(Number);
    const items = log.filter((row) => row.block_number > block!);
    const last = items.at(-1);
    return {
      ...page,
      next_cursor: last
        ? { block: last.block_number, transaction: last.transaction_index, event: last.event_index }
        : { block, transaction, event },
      items,
    };
  };
  const append = (recorded: RecordedItem, value: Record<string, unknown>) => {
    const block = 11 + log.length;
    log.push({
      ...recorded,
      block_number: block,
      transaction_index: 0,
      game_id: String(GAME_ID),
      transaction_hash: `0x${block}`,
      value: { ...value, order: block, index: 0 },
    });
  };
  /** The player acts: an explore story on the next block, their army's stamina spent at this second. */
  const act = (stamina: number, day = TODAY) => {
    state.army = { amount: stamina, settledAt: Math.floor(Date.now() / 1000), day };
    state.neighbourArmy = { ...state.army };
    const explore = recordedItem("StoryEvent", "ExplorationReward");
    const reward = (explore.value as { story: { ExplorationReward: object } }).story.ExplorationReward;
    append(explore, {
      ...explore.value,
      game_id: GAME_ID,
      owner: PLAYER_ACCOUNT,
      timestamp: Math.floor(Date.now() / 1000),
      story: { ExplorationReward: { ...reward, explorer_id: ARMY, receiver: HOME } },
    });
  };
  /** A fight the player won, told at `at` (Unix seconds, now by default). */
  const battle = (at = Math.floor(Date.now() / 1000)) => {
    const recorded = recordedItem("BattleEvent");
    const fight = recorded.value as { attacker: object; defender: object };
    append(recorded, {
      ...recorded.value,
      game_id: GAME_ID,
      attacker_id: ARMY,
      defender_id: 9,
      winner_id: ARMY,
      attacker: { ...fight.attacker, player: PLAYER_ACCOUNT },
      defender: { ...fight.defender, player: "0x0" },
      timestamp: at,
    });
  };
  /** Any story of the player's on the next block, written as the explore story was recorded. */
  const story = (variant: string, payload: Record<string, unknown>, owner = PLAYER_ACCOUNT) => {
    const recorded = recordedItem("StoryEvent", "ExplorationReward");
    append(recorded, {
      ...recorded.value,
      game_id: GAME_ID,
      owner,
      timestamp: Math.floor(Date.now() / 1000),
      story: { [variant]: payload },
    });
  };
  /** The same host now serves a fresh chain: another chain id, and a history that starts again at block 11. */
  const newChain = (chain: string) => {
    state.chain = chain;
    log.length = 0;
  };
  const sockets = new Set<{ socket: InstanceType<typeof WebSocketPair>[0]; seq: number; actor: string | null }>();
  const stream = (actor: string | null) => {
    const pair = new WebSocketPair();
    const server = pair[1];
    server.accept();
    const connection = { socket: server, seq: 0, actor };
    sockets.add(connection);
    server.addEventListener("close", () => sockets.delete(connection));
    server.addEventListener("message", (event) => {
      if (JSON.parse(String(event.data)).type !== "resume") return;
      const snap = siteSnapshot(
        snapshot(state.army, state.neighbourArmy, null, state.members, state.secondArmy),
        state.site,
      );
      for (const model of snap.models)
        server.send(JSON.stringify({ type: "snapshot", epoch: "site-test", seq: connection.seq, ...model }));
      server.send(JSON.stringify({ type: "snapshot_end", epoch: "site-test", seq: connection.seq }));
      if (actor) state.streamedSnapshots.push(actor);
    });
    server.send(
      JSON.stringify({ type: "hello", epoch: "site-test", seq: 0, confirmed_block: 10, preconfirmed_block: null }),
    );
    return new SocketResponse(null, { status: 101, webSocket: pair[0] }) as unknown as Response;
  };
  const siteChanged = (preconfirmed = false) => {
    const snap = siteSnapshot(
      snapshot(state.army, state.neighbourArmy, null, state.members, state.secondArmy),
      state.site,
    );
    const held = snap.models.filter(({ model }) => model === "GarrisonSlot" || model === "Guard");
    for (const connection of sockets)
      connection.socket.send(
        JSON.stringify({
          type: "diff",
          epoch: "site-test",
          seq: ++connection.seq,
          block: 11,
          preconfirmed,
          set: held.flatMap((model) => model.rows.map((row) => ({ model: model.model, ...row }))),
          del: [],
        }),
      );
  };
  const researchChanged = () => {
    const snap = siteSnapshot(
      snapshot(state.army, state.neighbourArmy, null, state.members, state.secondArmy),
      state.site,
    );
    const model = snap.models.find(({ model }) => model === "RealmKnowledge")!;
    for (const connection of sockets) {
      if (connection.actor !== PLAYER_ACCOUNT) continue;
      connection.socket.send(
        JSON.stringify({
          type: "diff",
          epoch: "site-test",
          seq: ++connection.seq,
          block: 11,
          preconfirmed: false,
          set: model.rows.map((row) => ({ model: model.model, ...row })),
          del: [],
        }),
      );
    }
  };
  const heartbeat = () => {
    for (const connection of sockets)
      connection.socket.send(
        JSON.stringify({
          type: "head",
          epoch: "site-test",
          seq: ++connection.seq,
          block: 11,
          timestamp: Math.floor(Date.now() / 1000),
          preconfirmed: true,
        }),
      );
  };
  return { answer, act, battle, newChain, state, story, stream, siteChanged, researchChanged, heartbeat };
};

/** The game's rules with a short armies tick, the player's home realm, and their army if it still exists. */
/**
 * The Worker in workerd over storage that survives a restart, a fake Herald, and push services answering `status`: a
 * browser's, and APNs for the iOS app.
 */
const createHarness = async (level: "off" | "important" | "all") => {
  const storage = newStorage();
  const herald = createHerald();
  const device = await deviceKeys();
  const apns = {
    status: 200,
    received: [] as number[],
    tokens: [] as string[],
    collapseIds: [] as (string | null)[],
    bodies: [] as { envelope: PushEnvelope }[],
    /** Each alert the app received, as the envelope beside it carries it. */
    notifications: () => apns.bodies.map(({ envelope }) => envelope.notification),
  };
  const push = {
    status: 201,
    received: [] as number[],
    times: [] as number[],
    endpoints: [] as string[],
    /** The Topic each push was kept under at the push service: a newer push of the Topic replaces a waiting one. */
    topics: [] as (string | null)[],
    bodies: [] as ArrayBuffer[],
    stalledEndpoint: null as string | null,
    /** Each push the phones received, opened: every test device shares the first one's keys. */
    notifications: async () =>
      (await Promise.all(push.bodies.map((body) => device.open(body)))).map(
        (envelope) =>
          (envelope as { notification: { title: string; body: string; tag?: string; createdAt: number } }).notification,
      ),
    /** Each push the phones received, as their title and body. */
    words: async () => (await push.notifications()).map(({ title, body }) => `${title} / ${body}`),
    /** The tag each push carries: a newer push of the tag replaces the one the phone shows. */
    tags: async () => (await push.notifications()).map(({ tag }) => tag),
    apns,
  };
  const vapid = await vapidKeys();
  const { credentials } = await apnsKey();
  const start = () =>
    startWorker({
      bundle,
      storage,
      vapid,
      apns: credentials,
      outbound: async (request) => {
        const url = new URL(request.url);
        if (url.origin === SHARD) {
          if (request.headers.get("upgrade") === "websocket")
            return herald.stream(new URL(request.url).searchParams.get("actor"));
          const answer = herald.answer(url);
          return answer instanceof Response ? answer : Response.json(answer);
        }
        if (url.href.startsWith(PUSH_ENDPOINT)) {
          push.bodies.push(await request.arrayBuffer());
          push.received.push(push.status);
          push.times.push(Date.now());
          push.endpoints.push(url.href);
          push.topics.push(request.headers.get("topic"));
          if (url.href === push.stalledEndpoint)
            return pause(1500).then(() => new Response(null, { status: push.status }));
          return new Response(null, { status: push.status });
        }
        if (url.href.startsWith(APNS_DEVICE)) {
          apns.bodies.push(await request.json());
          apns.received.push(apns.status);
          apns.tokens.push(url.href.slice(APNS_DEVICE.length));
          apns.collapseIds.push(request.headers.get("apns-collapse-id"));
          return new Response(null, { status: apns.status });
        }
        return new Response("unexpected outbound request", { status: 599 });
      },
    });
  const worker = await start();
  await seed(worker.db, level, device);
  return { herald, push, start, worker };
};

/** The player's account, level, opted-in device and the shard, as sign-in, /devices, settings and the operator leave them. */
const seed = async (db: D1Database, level: string, device: { p256dh: string; auth: string }) => {
  const statements = migrationStatements();
  const now = Date.now();
  await db.batch([
    ...statements.map((statement) => db.prepare(statement)),
    db
      .prepare(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId") VALUES ('player-one', 'player-one', 'p@x.test', 0, ?, ?, ?)`,
      )
      .bind(new Date(now).toISOString(), new Date(now).toISOString(), OWNER),
    db.prepare(`INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?)`).bind(PLAYER_ACCOUNT, OWNER),
    db
      .prepare(`INSERT INTO "notification_preferences" ("owner", "level", "revision") VALUES (?, ?, 1)`)
      .bind(OWNER, level),
    db
      .prepare(
        `INSERT INTO "notification_push_subscriptions" ("id", "owner", "endpoint", "p256dh", "auth", "revocationHash", "gameAlertsEnabledAt", "createdAt") VALUES (?, ?, ?, ?, ?, 'x', ?, ?)`,
      )
      .bind(DEVICE_ID, OWNER, PUSH_ENDPOINT, device.p256dh, device.auth, now - 60_000, now - 60_000),
    db.prepare(`INSERT INTO "shards" ("slot", "url", "chainId") VALUES (1, ?, ?)`).bind(SHARD, CHAIN_ID),
  ]);
};

// Each case owns its Worker, persistent storage and network fixtures.
describe.concurrent("shard notifications", () => {
  describe.each([
    ["just after a guard tick", (): boolean => Date.now() % ticks(1) < 500],
    ["just before a guard tick", (): boolean => Date.now() % ticks(1) > ticks(1) - 1_500],
  ])("private research completed %s", (_phase, atPhase) => {
    it("makes the idle army eligible: nothing before the first tick that clears the guards, one alert after it", async () => {
      const { herald, push, worker } = await createHarness("important");
      herald.state.site = { troops: siteGuardTroops(1), aspect: 2, lore: false, lastTick: armiesTick() };
      const heartbeat = setInterval(herald.heartbeat, 2000);
      try {
        await worker.runCron();
        await waitUntil(() => herald.state.streamedSnapshots.includes(PLAYER_ACCOUNT), 30_000);
        await waitUntil(atPhase, 15_000);
        const changedAt = Date.now();
        const earliest = (Math.floor(changedAt / ticks(1)) + 1) * ticks(1);
        herald.state.site.lore = true;
        herald.state.site.lastTick = armiesTick();
        herald.researchChanged();
        await waitUntil(() => Date.now() >= earliest - 100, 15_000);
        expect(push.received).toEqual([]);
        await waitUntil(() => push.received.length === 1, ticks(2) + polls(3));
        expect(Date.now()).toBeGreaterThanOrEqual(earliest);
        expect(await push.words()).toEqual(["Ethereal mine can be taken / Your army can take it today."]);
        await pause(polls(3));
        expect(push.received).toEqual([201]);
      } finally {
        clearInterval(heartbeat);
        await worker.dispose();
      }
    }, 90_000);
  });

  it("arms a quiet game's watches after one failed release check, with no fact change in between", async () => {
    const { herald, push, worker } = await createHarness("important");
    herald.state.site = { troops: siteGuardTroops(1), aspect: 2, lore: true, lastTick: armiesTick() };
    herald.state.manifestFailures = 1;
    const heartbeat = setInterval(herald.heartbeat, 2000);
    try {
      await worker.runCron();
      await waitUntil(() => push.received.length === 1, 20000);
      expect(herald.state.manifestFailures).toBe(0);
    } finally {
      clearInterval(heartbeat);
      await worker.dispose();
    }
  }, 60000);

  it("reads the release catalogue once for a planning pass over every enrolled actor", async () => {
    const { herald, worker } = await createHarness("important");
    const others = ["0x7a1", "0x7a2"];
    await worker.db.batch(
      others.map((address) =>
        worker.db.prepare(`INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?)`).bind(address, OWNER),
      ),
    );
    herald.state.members = [PLAYER_ACCOUNT, ...others];
    herald.state.site = { troops: siteGuardTroops(1), aspect: 2, lore: true, lastTick: armiesTick() };
    const heartbeat = setInterval(herald.heartbeat, 2000);
    try {
      await worker.runCron();
      await waitUntil(() => herald.state.actorReads.length >= 3, 20000);
      await pause(polls(1));
      expect(new Set(herald.state.actorReads.slice(0, 3)).size).toBe(3);
      const first = herald.state.reads.indexOf("snapshot");
      const third = herald.state.reads.indexOf("snapshot", first + 2);
      expect(herald.state.reads.slice(first, third + 1)).toEqual(["snapshot", "snapshot", "snapshot"]);
      expect(herald.state.reads.slice(0, first)).toContain("manifest");
    } finally {
      clearInterval(heartbeat);
      await worker.dispose();
    }
  }, 60000);

  it("pushes a Deep site opportunity on a rival's confirmed change for an idle player, once across restart", async () => {
    const { herald, push, worker, start } = await createHarness("important");
    herald.state.site = { troops: siteGuardTroops(1), aspect: 1, lore: true, lastTick: armiesTick() };
    await worker.runCron();
    await pause(polls(3));
    expect(push.received).toEqual([]);
    herald.state.site.aspect = 2;
    herald.siteChanged(true);
    await pause(polls(2));
    expect(push.received).toEqual([]);
    herald.state.site.lastTick = armiesTick();
    herald.siteChanged();
    await waitUntil(() => push.received.length === 1, 20000);
    expect(await push.words()).toEqual(["Ethereal mine can be taken / Your army can take it today."]);
    herald.siteChanged();
    await pause(polls(2));
    expect(push.received).toEqual([201]);
    await worker.dispose();
    const restarted = await start();
    try {
      await restarted.runCron();
      await pause(polls(3));
      expect(push.received).toEqual([201]);
    } finally {
      await restarted.dispose();
    }
  }, 90000);

  it("pushes a Deep site opportunity when a ring opens, once to a player who can reach it, across restart", async () => {
    const { herald, push, worker, start } = await createHarness("important");
    herald.state.site = { troops: siteGuardTroops(1), aspect: 1, lore: true, lastTick: armiesTick(), entered: 1 };
    await worker.runCron();
    await waitUntil(() => push.received.length === 1, 20000);
    expect(await push.words()).toEqual([
      `Ring 2 is open / ${nativeRuleConstants.DEEP_RING_SITES} new sites are open today.`,
    ]);
    herald.siteChanged();
    await pause(polls(2));
    expect(push.received).toEqual([201]);
    await worker.dispose();
    const restarted = await start();
    try {
      await restarted.runCron();
      await pause(polls(3));
      expect(push.received).toEqual([201]);
    } finally {
      await restarted.dispose();
    }
  }, 90000);

  it("wakes a Deep site opportunity at its computed drain tick without another player action", async () => {
    const { herald, push, worker } = await createHarness("important");
    herald.state.site = { troops: siteGuardTroops(6), aspect: 2, lore: true, lastTick: armiesTick() };
    try {
      await worker.runCron();
      await pause(polls(2));
      expect(push.received).toEqual([]);
      await waitUntil(() => push.received.length === 1, 60000);
      expect(await push.words()).toEqual(["Ethereal mine can be taken / Your army can take it today."]);
    } finally {
      await worker.dispose();
    }
  }, 90000);

  it("cancels a waiting Deep site opportunity when the rival reinforces before a delivery retry", async () => {
    const { herald, push, worker } = await createHarness("important");
    herald.state.site = { troops: siteGuardTroops(1), aspect: 2, lore: true, lastTick: armiesTick() };
    push.status = 503;
    try {
      await worker.runCron();
      await waitUntil(() => push.received.length === 1, 20000);
      herald.state.site.troops = 20000;
      herald.state.site.lastTick = armiesTick();
      herald.siteChanged();
      push.status = 201;
      await pause(polls(5));
      expect(push.received).toEqual([503]);
    } finally {
      await worker.dispose();
    }
  }, 60000);

  it("suppresses a Deep site opportunity on a foreground device", async () => {
    const { herald, push, worker } = await createHarness("important");
    herald.state.site = { troops: siteGuardTroops(1), aspect: 2, lore: true, lastTick: armiesTick() };
    await worker.db
      .prepare('UPDATE "notification_push_subscriptions" SET "gameForegroundUntil" = ?')
      .bind(Date.now() + 60000)
      .run();
    try {
      await worker.runCron();
      await pause(polls(5));
      expect(push.received).toEqual([]);
    } finally {
      await worker.dispose();
    }
  }, 60000);

  it("alerts the player's device once for a battle on a listed shard, and a restart resends nothing", async () => {
    const { herald, push, start, worker } = await createHarness("important");
    herald.state.mode = "blitz"; // a fight between players pushes in Blitz
    push.status = 503;
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the shard's head
    herald.battle();
    await waitUntil(() => push.received.length >= 1, 15_000);
    expect(push.received).toEqual([503]);
    await worker.dispose();

    push.status = 201;
    const restarted = await start();
    await restarted.runCron();
    await waitUntil(() => push.received.includes(201), 20_000);
    await pause(polls(10)); // more polls, and the retry window, pass quietly
    expect(push.received).toEqual([503, 201]);
    await restarted.dispose();
  }, 150_000);

  it("alerts each time the armies the player left are all rested, not if they acted again first, nor once gone or from an earlier day", async () => {
    const { herald, push, worker } = await createHarness("important");
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the shard's head

    herald.act(0);
    await pause(ticks(1));
    herald.state.army = null; // the army expires at rollover before it is rested
    herald.state.neighbourArmy = null;
    await pause(ticks(REST_TICKS + 1) + polls(10));
    expect(push.received).toEqual([]);

    herald.act(0, TODAY - 1); // An old army may still occupy a shared map tile on today's coordinates.
    herald.state.army!.mapDay = TODAY;
    await pause(ticks(REST_TICKS + 1) + polls(10));
    expect(push.received).toEqual([]);

    // Acting at the start of a tick puts the first wake exactly REST_TICKS on, and the second a whole tick after it.
    await pause(ticks(1) - (Date.now() % ticks(1)));
    herald.act(0);
    const firstWake = (armiesTick() + REST_TICKS) * ticks(1);
    await pause(ticks(1));
    herald.act(0); // the army spends its stamina again before it was rested
    await pause(ticks(1));
    // The player's second army is spent a tick later: when the first is full, it is still recovering.
    herald.state.secondArmy = { amount: 0, settledAt: Math.floor(Date.now() / 1000), day: TODAY };
    herald.story("ExplorationReward", {});
    // The first army is full while the second still recovers: nothing yet, the player's armies are not all rested.
    await waitUntil(() => Date.now() > firstWake + polls(2), 60_000);
    expect(push.received).toEqual([]);
    await waitUntil(() => push.received.length >= 1, 60_000);
    expect(await push.words()).toEqual(["Your armies are rested / Frontier: their stamina is full."]);
    await pause(polls(10));
    expect(push.received).toEqual([201]);

    herald.act(0); // spent and rested again the same game day: another alert, which replaces the first on the phone
    await waitUntil(() => push.received.length >= 2, ticks(REST_TICKS + 2) + polls(10));
    expect(push.received).toEqual([201, 201]);
    expect(new Set(await push.tags())).toEqual(new Set([`army-rested:/g/${CHAIN_ID}/${GAME_ID}`]));
    await worker.dispose();
  }, 420_000);

  describe("a release published while a story page's rested armies are read", () => {
    const NEIGHBOUR = "0x7e1";
    const play = async (published: NativeReleases) => {
      const harness = await createHarness("important");
      const { herald, worker } = harness;
      await worker.db
        .prepare(`INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?)`)
        .bind(NEIGHBOUR, OWNER)
        .run();
      await worker.runCron();
      await pause(polls(5));
      herald.state.army = null;
      herald.state.neighbourArmy = { amount: 0, settledAt: Math.floor(Date.now() / 1000), day: TODAY };
      herald.state.pins.set(NEIGHBOUR, { release_id: RELEASE, created_release_id: RELEASE - 1 });
      herald.state.publishAfterPlayerRead = published;
      herald.story("ExplorationReward", {});
      herald.story("ExplorationReward", {}, NEIGHBOUR);
      return harness;
    };

    it("alerts the second actor once the catalogue is read again, with no further action", async () => {
      const { herald, push, worker } = await play(releaseLine(bindings.schemaIdentity, [RELEASE - 1]));
      try {
        await waitUntil(() => push.received.length >= 1, 90_000);
        expect(herald.state.publishAfterPlayerRead).toBeNull();
        expect(await push.words()).toEqual(["Your army is rested / Frontier: its stamina is full."]);
        await pause(polls(5));
        expect(push.received).toEqual([201]);
      } finally {
        await worker.dispose();
      }
    }, 150_000);

    it("sends nothing when the release it names cannot be read", async () => {
      const { herald, push, worker } = await play(releaseLine("0x1", [RELEASE - 1]));
      try {
        await waitUntil(() => herald.state.publishAfterPlayerRead === null, 30_000);
        await pause(ticks(REST_TICKS + 3) + polls(5));
        expect(push.received).toEqual([]);
      } finally {
        await worker.dispose();
      }
    }, 150_000);
  });

  it("does not alert an exhausted army in the Deep", async () => {
    const { herald, push, worker } = await createHarness("important");
    try {
      await worker.runCron();
      await pause(polls(5));
      herald.act(0);
      herald.state.army!.deepTick = armiesTick();
      await pause(ticks(REST_TICKS + 1) + polls(3));
      expect(push.received).toEqual([]);
    } finally {
      await worker.dispose();
    }
  }, 180_000);

  it("rechecks Mist Tide when teammates can end it and alerts only after the actual bar is full", async () => {
    const { herald, push, worker } = await createHarness("important");
    try {
      await worker.runCron();
      await pause(polls(5));
      herald.state.mistEndedAt = 0;
      herald.act(0);
      const spentAt = herald.state.army!.settledAt;
      await pause(ticks(1));
      herald.state.mistEndedAt = Math.floor(Date.now() / 1000);
      const slowedSeconds = herald.state.mistEndedAt - spentAt;
      const fullAt = spentAt + Math.ceil(REST_TICKS * ARMIES_TICK_SECONDS + slowedSeconds / 2);
      await waitUntil(() => Date.now() / 1000 >= fullAt - 3, 45_000);
      expect(push.received).toEqual([]);
      await waitUntil(() => push.received.length > 0, 15_000);
      expect(Date.now() / 1000).toBeGreaterThanOrEqual(fullAt);
      expect(Date.now() / 1000).toBeLessThan(spentAt + 2 * REST_TICKS * ARMIES_TICK_SECONDS);
      expect(await push.words()).toEqual(["Your army is rested / Frontier: its stamina is full."]);
      expect(
        herald.state.requestedModels.some((models) => models.includes("BaneProgress") && models.includes("TriumphDay")),
      ).toBe(true);
    } finally {
      await worker.dispose();
    }
  }, 100_000);

  it("rechecks a day no command has rolled yet at its earliest and alerts once the rate the roll gave fills the bar", async () => {
    const { herald, push, worker } = await createHarness("important");
    try {
      await worker.runCron();
      await pause(polls(5));
      herald.state.todayBane = null;
      herald.state.mistEndedAt = 0;
      herald.act(0);
      const spentAt = herald.state.army!.settledAt;
      await pause(ticks(1));
      herald.state.todayBane = 0;
      await waitUntil(() => push.received.length > 0, 45_000);
      expect(Date.now() / 1000).toBeGreaterThanOrEqual(spentAt + REST_TICKS * ARMIES_TICK_SECONDS);
      expect(Date.now() / 1000).toBeLessThan(spentAt + 2 * REST_TICKS * ARMIES_TICK_SECONDS);
      expect(await push.words()).toEqual(["Your army is rested / Frontier: its stamina is full."]);
    } finally {
      await worker.dispose();
    }
  }, 100_000);

  it("a game that ends while an army rests alerts nothing for it, and every other alert still flows", async () => {
    const { herald, push, worker } = await createHarness("important");
    herald.state.mode = "blitz"; // a fight between players pushes in Blitz
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the shard's head

    herald.act(0);
    await pause(ticks(1));
    herald.state.status = "Settled"; // the game ends before the army is rested, and Herald drops its armies
    await pause(ticks(REST_TICKS + 1) + polls(10));
    expect(push.received).toEqual([]);

    herald.act(0); // an action folded late, in the ended game
    herald.battle();
    await waitUntil(() => push.received.length >= 1, 20_000);
    await pause(polls(10));
    expect(push.received).toEqual([201]);
    await worker.dispose();
  }, 150_000);

  it("a wake that keeps failing is retried, then dropped, and every other alert still flows", async () => {
    const { herald, push, worker } = await createHarness("important");
    herald.state.mode = "blitz"; // a fight between players pushes in Blitz
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the shard's head

    herald.act(0);
    await pause(polls(5)); // the action is read and its army watched
    herald.state.snapshotFails = true;
    await pause(ticks(REST_TICKS) + polls(15 + 10)); // the wake comes due, fails, and is retried up to its cap
    herald.battle();
    await waitUntil(() => push.received.length >= 1, 20_000);
    expect(push.received).toEqual([201]);

    const reads = herald.state.snapshotReads;
    await pause(polls(20));
    expect(herald.state.snapshotReads).toBe(reads); // the watch was given up, not retried forever
    await worker.dispose();
  }, 240_000);

  it("reads a new chain at the same URL from its own head, and sends nothing twice", async () => {
    const { herald, push, worker } = await createHarness("important");
    herald.state.mode = "blitz"; // a fight between players pushes in Blitz
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the shard's head
    herald.battle();
    herald.battle(); // the same game's newer fight replaces the first before it goes
    await waitUntil(() => push.received.length >= 1, 20_000);
    await pause(polls(5));
    expect(push.received).toEqual([201]);

    // The host now serves a fresh chain whose history restarts below the old chain's cursor, and the directory says so.
    herald.newChain("0xb");
    await worker.db.prepare('UPDATE "shards" SET "chainId" = ? WHERE "url" = ?').bind("0xb", SHARD).run();
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the new chain's head
    herald.battle();
    await waitUntil(() => push.received.length >= 2, 20_000);
    await pause(polls(10));
    expect(push.received).toEqual([201, 201]);
    await worker.dispose();
  }, 120_000);

  it("a story that cannot be put into words is left, the player's own taps send nothing, and what follows still alerts", async () => {
    const { herald, push, worker } = await createHarness("all");
    herald.state.mode = "blitz"; // a fight between players pushes in Blitz
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the shard's head
    herald.story("ResourceTransferStory", { to_entity_id: 11, travel_time: "soon" });
    herald.story("BuildingPlacementStory", { change: "Created" }); // the player's own build: the Feed tells it
    herald.story("ExplorationReward", {}); // the player's own find, likewise
    herald.story("ResourceReceiveArrivalStory", {});
    herald.battle();
    await waitUntil(() => push.received.length >= 2, 20_000);
    await pause(polls(5)); // nothing more comes for the page
    expect(push.received).toEqual([201, 201]);
    await worker.dispose();
  }, 120_000);

  /** Open a day of the shared calendar a few seconds from now (Day 2 by default); no player needs to have acted. */
  const openSoon = (herald: ReturnType<typeof createHerald>, seconds = 8, dayIndex = 1) => {
    const opensAt = (Math.floor(Date.now() / 1000) + seconds) * 1000;
    const calendar = {
      seed: 1n,
      startMainAt: 0,
      scheduledEndAt: 21 * 20 * DAY_UNIT_SECONDS,
      endAt: 21 * 20 * DAY_UNIT_SECONDS,
      dayUnitSeconds: DAY_UNIT_SECONDS,
    };
    let start = 0;
    for (let index = 0; index < dayIndex; index++) start = dayOf(calendar, start)!.end;
    herald.state.seasonStart = opensAt / 1000 - start;
    return opensAt;
  };

  /** Zones where it is now night (22:00 to 08:00) and day, so a test runs at any hour. */
  const ZONES = ["UTC", "Asia/Kolkata", "America/New_York", "Asia/Tokyo", "Europe/Paris", "America/Los_Angeles"];
  const hourIn = (zone: string) =>
    Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const nightZone = () => ZONES.find((zone) => hourIn(zone) >= 22 || hourIn(zone) < 7)!;
  const dayZone = () => ZONES.find((zone) => hourIn(zone) >= 9 && hourIn(zone) < 21)!;
  /** Two zones in their day whose clocks read differently now. */
  const twoDayZones = (): [string, string] => {
    const awake = ZONES.filter((zone) => hourIn(zone) >= 9 && hourIn(zone) < 20);
    const first = awake[0]!;
    return [first, awake.find((zone) => clockIn(zone, Date.now()) !== clockIn(first, Date.now()))!];
  };
  const clockIn = (zone: string, at: number) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
      new Date(at),
    );

  it.each(["important", "all"] as const)(
    "Day open sends one push to an inactive %s player when the day opens",
    async (level) => {
      const { herald, push, worker, start } = await createHarness(level);
      const opensAt = openSoon(herald);
      await worker.runCron();
      await waitUntil(() => push.received.length > 0, 15_000);
      expect(push.received).toEqual([201]);
      expect(push.times[0]).toBeGreaterThanOrEqual(opensAt);
      expect(push.times[0]).toBeLessThan(opensAt + 1000);
      expect(await push.words()).toEqual([
        expect.stringMatching(/^Day 2 is open \/ Frontier: day ends at \d\d:\d\d UTC\.$/),
      ]);
      await worker.dispose();
      const restarted = await start();
      await restarted.runCron();
      await pause(2000);
      expect(push.received).toEqual([201]);
      await restarted.dispose();
    },
    45_000,
  );

  it("Day open is not sent to a phone that has the game in view", async () => {
    const { herald, push, worker } = await createHarness("important");
    const opensAt = openSoon(herald);
    await worker.db
      .prepare('UPDATE "notification_push_subscriptions" SET "gameForegroundUntil" = ?')
      .bind(opensAt + 60_000)
      .run();
    await worker.runCron();
    await pause(Math.max(0, opensAt + 2000 - Date.now()));
    expect(push.received).toEqual([]);
    await worker.dispose();
  }, 45_000);

  it("Day open goes at the opening to every phone, whatever its clock: the phone's own night setting silences it", async () => {
    const { herald, push, worker } = await createHarness("important");
    const awake = `${PUSH_ENDPOINT}/awake`;
    const now = Date.now();
    await worker.db.batch([
      worker.db.prepare('UPDATE "notification_push_subscriptions" SET "timeZone" = ?').bind(nightZone()),
      worker.db
        .prepare(
          `INSERT INTO "notification_push_subscriptions"
        ("id", "owner", "endpoint", "p256dh", "auth", "revocationHash", "gameAlertsEnabledAt", "createdAt", "timeZone")
        SELECT '00000000-0000-4000-8000-000000000002', "owner", ?, "p256dh", "auth", 'x', "gameAlertsEnabledAt", ?, ?
        FROM "notification_push_subscriptions" WHERE "id" = ?`,
        )
        .bind(awake, now, dayZone(), DEVICE_ID),
    ]);
    const opensAt = openSoon(herald);
    await worker.runCron();
    await pause(Math.max(0, opensAt + 3000 - Date.now()));
    expect(new Set(push.endpoints)).toEqual(new Set([PUSH_ENDPOINT, awake]));
    expect(push.endpoints).toHaveLength(2);
    await worker.dispose();
  }, 45_000);

  it("Day open covers enrollment beyond a story page, including another inactive player", async () => {
    const { herald, push, worker } = await createHarness("important");
    const account = "0xbeef";
    const owner = realmsIdOf("player-two");
    const endpoint = `${PUSH_ENDPOINT}/two`;
    const now = Date.now();
    // The first hundred accounts have never registered a notification device; recipients still include later rows.
    herald.state.members = [
      ...Array.from({ length: 101 }, (_, index) => `0x${(0x1000 + index).toString(16)}`),
      PLAYER_ACCOUNT,
      account,
    ];
    await worker.db.batch([
      worker.db
        .prepare(
          `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId")
        VALUES ('player-two', 'player-two', 'two@x.test', 0, ?, ?, ?)`,
        )
        .bind(new Date(now).toISOString(), new Date(now).toISOString(), owner),
      worker.db.prepare('INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?)').bind(account, owner),
      worker.db
        .prepare('INSERT INTO "notification_preferences" ("owner", "level", "revision") VALUES (?, ?, 1)')
        .bind(owner, "all"),
      worker.db
        .prepare(
          `INSERT INTO "notification_push_subscriptions"
        ("id", "owner", "endpoint", "p256dh", "auth", "revocationHash", "gameAlertsEnabledAt", "createdAt")
        SELECT '00000000-0000-4000-8000-000000000002', ?, ?, "p256dh", "auth", 'x', "gameAlertsEnabledAt", "createdAt"
        FROM "notification_push_subscriptions" WHERE "id" = ?`,
        )
        .bind(owner, endpoint, DEVICE_ID),
    ]);
    openSoon(herald);
    await worker.runCron();
    await waitUntil(() => push.received.length === 2, 15_000);
    expect(push.endpoints.sort()).toEqual([PUSH_ENDPOINT, endpoint]);
    await worker.dispose();
  }, 45_000);

  it("Day open drops a missed opening on a newly started notifier", async () => {
    const { herald, push, worker } = await createHarness("important");
    openSoon(herald, -2);
    await worker.runCron();
    await pause(2000);
    expect(push.received).toEqual([]);
    await worker.dispose();
  }, 45_000);

  it("Day open rechecks preferences after preparation and cancels a finished game's push", async () => {
    for (const cancelledBy of ["off", "settled"] as const) {
      const { herald, push, worker } = await createHarness("important");
      const opensAt = openSoon(herald);
      await worker.runCron();
      await waitUntil(() => herald.state.snapshotReads > 0, 4000);
      expect(herald.state.snapshotReads).toBeGreaterThan(0);
      if (cancelledBy === "off")
        await worker.db.prepare('UPDATE "notification_preferences" SET "level" = ?').bind("off").run();
      else herald.state.status = "Settled";
      await pause(Math.max(0, opensAt + 1500 - Date.now()));
      expect(push.received).toEqual([]);
      await worker.dispose();
    }
  }, 45_000);

  it("Day open never reaches Off or a device without game-alert consent", async () => {
    const { herald, push, worker } = await createHarness("off");
    const opensAt = openSoon(herald);
    await worker.runCron();
    await pause(Math.max(0, opensAt + 1500 - Date.now()));
    expect(push.received).toEqual([]);
    await worker.dispose();
    const other = await createHarness("important");
    const otherOpensAt = openSoon(other.herald);
    await other.worker.db.prepare('UPDATE "notification_push_subscriptions" SET "gameAlertsEnabledAt" = NULL').run();
    await other.worker.runCron();
    await pause(Math.max(0, otherOpensAt + 1500 - Date.now()));
    expect(other.push.received).toEqual([]);
    await other.worker.dispose();
  }, 45_000);

  it("Day open retries a lost delivery while its day is open, across a restart, and sends it once", async () => {
    const { herald, push, worker, start } = await createHarness("important");
    openSoon(herald);
    push.status = 503;
    await worker.runCron();
    await waitUntil(() => push.received.length > 0, 15_000);
    expect(push.received).toEqual([503]);
    await worker.dispose();
    const restarted = await start();
    push.status = 201;
    await restarted.runCron();
    await waitUntil(() => push.received.includes(201), 15_000);
    await pause(polls(5));
    expect(push.received).toEqual([503, 201]);
    await restarted.dispose();
  }, 45_000);

  /** Each extra player owns one eligible device, within the production per-owner cap. */
  const addDayOpenPlayers = async (worker: Awaited<ReturnType<typeof startWorker>>, count: number) => {
    const now = Date.now();
    const players = Array.from({ length: count }, (_, index) => {
      const id = `day-open-extra-${index}`;
      return {
        id,
        owner: realmsIdOf(id),
        account: `0x${(0x2000 + index).toString(16)}`,
        endpoint: `${PUSH_ENDPOINT}/${index}`,
        device: `00000000-0000-4000-8000-${(index + 2).toString().padStart(12, "0")}`,
      };
    });
    await worker.db.batch(
      players.flatMap((player) => [
        worker.db
          .prepare(
            `INSERT INTO "user" ("id","name","email","emailVerified","createdAt","updatedAt","realmsId") VALUES (?,?,?,1,?,?,?)`,
          )
          .bind(
            player.id,
            player.id,
            `${player.id}@x.test`,
            new Date(now).toISOString(),
            new Date(now).toISOString(),
            player.owner,
          ),
        worker.db
          .prepare('INSERT INTO "realms_accounts" ("address","realmsId") VALUES (?,?)')
          .bind(player.account, player.owner),
        worker.db
          .prepare(`INSERT INTO "notification_preferences" ("owner","level","revision") VALUES (?,'important',1)`)
          .bind(player.owner),
        worker.db
          .prepare(
            `INSERT INTO "notification_push_subscriptions" ("id","owner","endpoint","p256dh","auth","revocationHash","gameAlertsEnabledAt","createdAt")
        SELECT ?,?,?,"p256dh","auth",'x',"gameAlertsEnabledAt","createdAt" FROM "notification_push_subscriptions" WHERE "id"=?`,
          )
          .bind(player.device, player.owner, player.endpoint, DEVICE_ID),
      ]),
    );
    return players;
  };

  it("Day open reaches 101 devices in seconds while one endpoint stalls", async () => {
    const { herald, push, worker } = await createHarness("important");
    try {
      const players = await addDayOpenPlayers(worker, 100);
      herald.state.members.push(...players.map((player) => player.account));
      push.stalledEndpoint = players[0]!.endpoint;
      const opensAt = openSoon(herald, 15);
      await worker.runCron();
      await waitUntil(() => push.endpoints.length === 101, 20_000);
      expect(push.times.every((time) => time >= opensAt && time < opensAt + 5000)).toBe(true);
      await pause(polls(3));
      expect(new Set(push.endpoints).size).toBe(101);
      expect(push.endpoints).toHaveLength(101);
    } finally {
      await worker.dispose();
    }
  }, 60_000);

  it.each([false, true])(
    "Day open fixes eligibility at preparation (empty cohort: %s), then includes a late enrolment next day",
    async (initiallyEmpty) => {
      const { herald, push, worker } = await createHarness("important");
      try {
        const [late] = await addDayOpenPlayers(worker, 1);
        if (initiallyEmpty) herald.state.members = [];
        const opensAt = openSoon(herald, 8);
        await worker.runCron();
        await waitUntil(() => herald.state.snapshotReads > 0, 4000);
        expect(herald.state.snapshotReads).toBeGreaterThan(0);
        herald.state.members.push(late!.account);
        await pause(Math.max(0, opensAt + 1500 - Date.now()));
        expect(push.endpoints).toEqual(initiallyEmpty ? [] : [PUSH_ENDPOINT]);
        const nextOpensAt = openSoon(herald, 8, 2); // Advance the fake shard to the next seeded day.
        await worker.runCron();
        await waitUntil(() => push.endpoints.includes(late!.endpoint), 12_000);
        expect(push.endpoints.filter((endpoint) => endpoint === late!.endpoint)).toHaveLength(1);
        const attempt = push.endpoints.indexOf(late!.endpoint);
        expect(push.times[attempt]).toBeGreaterThanOrEqual(nextOpensAt);
        expect(push.times[attempt]).toBeLessThan(nextOpensAt + 1000);
      } finally {
        await worker.dispose();
      }
    },
    45_000,
  );

  it("a burst of fights in one game reaches the phone once, as the newest under the game's tag, never as a stack", async () => {
    const { herald, push, worker } = await createHarness("important");
    herald.state.mode = "blitz"; // a fight between players pushes in Blitz
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the shard's head
    for (let fight = 0; fight < 7; fight++) herald.battle();
    await waitUntil(() => push.received.length >= 1, 30_000);
    await pause(polls(10));
    expect(push.received).toEqual([201]);
    expect(await push.tags()).toEqual([`fights:/g/${CHAIN_ID}/${GAME_ID}`]);
    herald.battle(); // a later fight, once the first push went, buzzes again
    await waitUntil(() => push.received.length >= 2, 30_000);
    expect(push.received).toEqual([201, 201]);
    await worker.dispose();
  }, 90_000);

  it("the player's iOS app gets the same alert as their browser, replaced under the same tag, until APNs forgets its token", async () => {
    const { herald, push, worker } = await createHarness("important");
    const phone = { id: "00000000-0000-4000-8000-0000000000a5", token: "a5".repeat(32) };
    const devices = () =>
      worker.db
        .prepare('SELECT "kind" FROM "notification_push_subscriptions" WHERE "owner" = ? ORDER BY "kind"')
        .bind(OWNER)
        .all<{ kind: string }>()
        .then(({ results }) => results.map(({ kind }) => kind));
    try {
      await worker.db
        .prepare(
          `INSERT INTO "notification_push_subscriptions"
        ("id", "owner", "kind", "apnsToken", "revocationHash", "gameAlertsEnabledAt", "createdAt")
        SELECT ?, "owner", 'apns', ?, 'x', "gameAlertsEnabledAt", "createdAt"
        FROM "notification_push_subscriptions" WHERE "id" = ?`,
        )
        .bind(phone.id, phone.token, DEVICE_ID)
        .run();
      herald.state.mode = "blitz"; // a fight between players pushes in Blitz
      await worker.runCron();
      await pause(polls(5)); // the notifier reaches the shard's head
      for (let fight = 0; fight < 7; fight++) herald.battle();
      await waitUntil(() => push.received.length >= 1 && push.apns.received.length >= 1, 30_000);
      await pause(polls(10));
      // One alert on each, never a stack: the same words, the same tag, kept under the same name for replacement.
      expect(push.received).toEqual([201]);
      expect(push.apns.received).toEqual([200]);
      expect(push.apns.tokens).toEqual([phone.token]);
      expect(push.apns.notifications()).toEqual(await push.notifications());
      expect(await push.tags()).toEqual([`fights:/g/${CHAIN_ID}/${GAME_ID}`]);
      expect(push.apns.collapseIds).toEqual(push.topics);

      push.apns.status = 410; // the player deleted the app
      herald.battle();
      await waitUntil(() => push.apns.received.length >= 2, 30_000);
      await waitUntil(() => push.received.length >= 2, 30_000);
      await pause(1000);
      expect(await devices()).toEqual(["web"]);
      herald.battle();
      await waitUntil(() => push.received.length >= 3, 30_000);
      expect(push.apns.received).toEqual([200, 410]);
    } finally {
      await worker.dispose();
    }
  }, 120_000);

  it("a fight still being retried is replaced by a newer one, across a restart: the newer is the one that goes", async () => {
    const { herald, push, start, worker } = await createHarness("important");
    herald.state.mode = "blitz"; // a fight between players pushes in Blitz
    push.status = 503;
    await worker.runCron();
    await pause(polls(5)); // the notifier reaches the shard's head
    herald.battle();
    await waitUntil(() => push.received.length >= 2, 30_000); // the first fight fails and waits to be tried again
    await pause(1000);
    herald.battle(); // newer news under the same tag, while the first still waits
    const attempts = push.received.length;
    await waitUntil(() => push.received.length > attempts, 30_000);
    const [older, ...later] = await push.notifications();
    // Its next attempt already carries the newer fight: the older one no longer waits.
    expect(later.at(-1)!.createdAt).toBeGreaterThan(older!.createdAt);
    await worker.dispose();

    push.status = 201;
    const restarted = await start();
    try {
      await restarted.runCron();
      await waitUntil(() => push.received.includes(201), 60_000);
      await pause(polls(10));
      const sent = await push.notifications();
      const accepted = sent.filter((_, index) => push.received[index] === 201);
      // Only the newer fight goes once the service takes pushes again: the older one never lands over it.
      expect(accepted.map(({ createdAt }) => createdAt)).toEqual([Math.max(...sent.map(({ createdAt }) => createdAt))]);
    } finally {
      await restarted.dispose();
    }
  }, 180_000);

  it("a result the push service keeps refusing for a while still lands once it takes pushes again", async () => {
    const { herald, push, worker } = await createHarness("important");
    try {
      herald.state.mode = "blitz";
      push.status = 503;
      await worker.runCron();
      await pause(polls(5)); // the notifier reaches the shard's head
      herald.story("BlitzFinalized", {});
      await waitUntil(() => push.received.length >= 5, 90_000); // five refusals, past the old five-attempt cut
      push.status = 201;
      await waitUntil(() => push.received.includes(201), 120_000);
      expect(push.received).toEqual([503, 503, 503, 503, 503, 201]);
      expect(await push.words()).toContain("Your Blitz ended / Blitz: see where you finished.");
    } finally {
      await worker.dispose();
    }
  }, 240_000);

  it("a fight whose hour runs out while the push service refuses it ends there, and is not sent late", async () => {
    const { herald, push, worker } = await createHarness("important");
    try {
      herald.state.mode = "blitz"; // a fight between players pushes in Blitz
      push.status = 503;
      await worker.runCron();
      await pause(polls(5)); // the notifier reaches the shard's head
      herald.battle(Math.floor(Date.now() / 1000) - 3600 + 20); // twenty seconds of its hour left
      await pause(45_000); // its life ends between two attempts
      const tried = push.received.length;
      push.status = 201;
      await pause(polls(10));
      expect(push.received).toHaveLength(tried);
      expect(push.received).not.toContain(201);
    } finally {
      await worker.dispose();
    }
  }, 150_000);

  it("a phone that turns alerts on gets Alerts are on, and its game's lease keeps the phone's time zone", async () => {
    const { push, worker } = await createHarness("important");
    try {
      const { cookie, realmsId: owner } = await worker.signInWithEmailCode("alerts-on@x.test");
      const post = (action: string, body: unknown) =>
        worker.mf.dispatchFetch(`${ORIGIN}/api/notifications/push/${action}`, {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/json", cookie },
          body: JSON.stringify(body),
        });
      const id = "00000000-0000-4000-8000-0000000000aa";
      const endpoint = `${PUSH_ENDPOINT}/alerts-on`;
      const subscribed = await post("subscribe", {
        owner,
        id,
        token: "00000000-0000-4000-8000-0000000000ab",
        gameAlerts: true,
        subscription: { endpoint, keys: await deviceKeys() },
      });
      expect(subscribed.status).toBe(200);

      expect((await post("foreground", { owner, id, foreground: true, timeZone: "Asia/Kolkata" })).status).toBe(200);
      expect((await post("foreground", { owner, id, foreground: false })).status).toBe(200);
      const bad = await post("foreground", { owner, id, foreground: false, timeZone: "Mars/Olympus" });
      expect(await bad.json()).toEqual({ error: "invalid_time_zone" });
      const zone = await worker.db
        .prepare('SELECT "timeZone" FROM "notification_push_subscriptions" WHERE "id" = ?')
        .bind(id)
        .first<{ timeZone: string }>();
      expect(zone?.timeZone).toBe("Asia/Kolkata");

      const alertsOn = await post("alerts-on", { owner, id });
      expect(await alertsOn.json()).toEqual({ status: "accepted" });
      expect(push.endpoints).toEqual([endpoint]);
    } finally {
      await worker.dispose();
    }
  }, 45_000);

  it("the iOS app registers its APNs token for the signed-in account and gets Alerts are on through APNs", async () => {
    const { push, worker } = await createHarness("important");
    try {
      const { cookie, realmsId: owner } = await worker.signInWithEmailCode("ios-app@x.test");
      const post = (action: string, body: unknown, session = cookie) =>
        worker.mf.dispatchFetch(`${ORIGIN}/api/notifications/push/${action}`, {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/json", cookie: session },
          body: JSON.stringify(body),
        });
      const id = "00000000-0000-4000-8000-0000000000ba";
      const registration = { owner, id, token: "00000000-0000-4000-8000-0000000000bb", apnsToken: "ba".repeat(32) };
      expect((await post("subscribe", registration, "")).status).toBe(401);
      expect((await post("subscribe", { ...registration, gameAlerts: true })).status).toBe(200);
      expect(await (await post("status", { owner, id })).json()).toEqual({
        registered: true,
        gameAlerts: true,
        directMessages: false,
      });

      const alertsOn = await post("alerts-on", { owner, id });
      expect(await alertsOn.json()).toEqual({ status: "accepted" });
      expect(push.apns.tokens).toEqual([registration.apnsToken]);
      expect(push.apns.notifications().map(({ title }) => title)).toEqual(["Alerts are on"]);
      expect(push.endpoints).toEqual([]);
    } finally {
      await worker.dispose();
    }
  }, 45_000);

  it("Frontier pushes no fight to either side or to a second phone; the same fights in Blitz reach both", async () => {
    const { herald, push, worker } = await createHarness("important");
    try {
      const second = `${PUSH_ENDPOINT}/second`;
      await worker.db
        .prepare(
          `INSERT INTO "notification_push_subscriptions"
        ("id", "owner", "endpoint", "p256dh", "auth", "revocationHash", "gameAlertsEnabledAt", "createdAt")
        SELECT '00000000-0000-4000-8000-000000000002', "owner", ?, "p256dh", "auth", 'x', "gameAlertsEnabledAt", "createdAt"
        FROM "notification_push_subscriptions" WHERE "id" = ?`,
        )
        .bind(second, DEVICE_ID)
        .run();
      await worker.runCron();
      await pause(polls(5)); // the notifier reaches the shard's head
      herald.battle(); // the player attacks a beast camp's army: their own tap
      await pause(polls(5));
      expect(push.received).toEqual([]);

      herald.state.mode = "blitz";
      herald.battle();
      await waitUntil(() => push.received.length >= 2, 20_000);
      await pause(polls(3));
      expect(push.endpoints.sort()).toEqual([PUSH_ENDPOINT, second].sort());
      expect(await push.words()).toEqual([
        "You won a battle / Blitz: your army beat the enemy.",
        "You won a battle / Blitz: your army beat the enemy.",
      ]);
    } finally {
      await worker.dispose();
    }
  }, 60_000);

  it("a Day open prepared before a restart is not sent if its game settled while the notifier was down", async () => {
    const { herald, push, worker, start } = await createHarness("important");
    const opensAt = openSoon(herald, 8);
    await worker.runCron();
    await waitUntil(() => herald.state.requestedModels.includes("PlayerEntry"), 6000);
    await pause(1000);
    await worker.dispose();
    herald.state.status = "Settled";
    await pause(Math.max(0, opensAt + 1000 - Date.now()));
    const restarted = await start();
    try {
      await restarted.runCron();
      await pause(3000);
      expect(push.received).toEqual([]);
    } finally {
      await restarted.dispose();
    }
  }, 45_000);

  it.each([
    ["a day", false, (ends: string) => `Day 2 is open / Frontier: day ends at ${ends}.`],
    ["the season's last day", true, (ends: string) => `Last day is open / Frontier: season ends at ${ends}.`],
  ] as const)(
    "Day open names its day's end on the phone's clock as it is sent, after the phone changed zone: %s",
    async (_case, last, words) => {
      const { herald, push, worker } = await createHarness("important");
      try {
        const [prepared, sent] = twoDayZones();
        await worker.db.prepare('UPDATE "notification_push_subscriptions" SET "timeZone" = ?').bind(prepared).run();
        const opensAt = openSoon(herald, 8);
        const calendar = {
          seed: 1n,
          startMainAt: herald.state.seasonStart,
          scheduledEndAt: herald.state.seasonStart + 21 * 20 * DAY_UNIT_SECONDS,
          endAt: herald.state.seasonStart + 21 * 20 * DAY_UNIT_SECONDS,
          dayUnitSeconds: DAY_UNIT_SECONDS,
        };
        const dayEnd = dayOf(calendar, opensAt / 1000)!.end;
        if (last) herald.state.seasonEnd = dayEnd;
        await worker.runCron();
        await waitUntil(() => herald.state.requestedModels.includes("PlayerEntry"), 6000);
        await pause(1000);
        await worker.db.prepare('UPDATE "notification_push_subscriptions" SET "timeZone" = ?').bind(sent).run();
        await waitUntil(() => push.received.length > 0, 15_000);
        expect(await push.words()).toEqual([words(clockIn(sent, dayEnd * 1000))]);
      } finally {
        await worker.dispose();
      }
    },
    45_000,
  );
});
