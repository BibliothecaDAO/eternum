import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { beforeAll, expect, it } from "vitest";

import preset from "../../../contracts/l3/world-native/fixtures/preset-3.json";
import explorerFixture from "../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import recordedPages from "./fixtures/staging-story-pages.json";
import { realmsIdOf } from "./realms-id";
import {
  buildWorkerBundle,
  deviceKeys,
  migrationStatements,
  newStorage,
  pause,
  startWorker,
  vapidKeys,
  waitUntil,
} from "./workerd-harness";

/**
 * The shard notifier runs as it does on Cloudflare: the bundled Worker with its Durable Object, alarms and D1 in
 * workerd. Only the network is faked: one shard's Herald and one push service.
 */
const SHARD = "https://shard-a.test";
const CHAIN_ID = "0xa";
const GAME_ID = 1;
const PLAYER_ACCOUNT = "0x4b1d";
const HOME = 5;
const ARMY = 7;
/** Another player on the shard, with no devices, whose army rests too: only an owner-narrowed read leaves it out. */
const NEIGHBOUR_HOME = 6;
const NEIGHBOUR_ARMY = 8;
const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/player-device";
const DEVICE_ID = "00000000-0000-4000-8000-000000000001";
const OWNER = realmsIdOf("player-one");
/** The notifier polls every 200 ms here (every 3 s deployed); its retries wait 1, 2, 4, then 8 polls. */
const POLL_MS = 200;
const polls = (count: number) => count * POLL_MS;
/**
 * A one-second armies tick (the chain counts whole seconds) with the preset's knights (120) regaining 40 a tick: three
 * ticks from empty to rested, long enough that the notifier sees an army act again well before its first wake time.
 */
const ARMIES_TICK_SECONDS = 1;
const STAMINA_GAIN_PER_TICK = 40;
const REST_TICKS = 3;
const ticks = (count: number) => count * ARMIES_TICK_SECONDS * 1000;
/** A Frontier season that began yesterday: today is its second daily expedition, each day a row of 40-hex regions. */
const DAY_SECONDS = 86_400;
const REGION_SPACING = 40;
const SEASON_START = (Math.floor(Date.now() / 1000 / DAY_SECONDS) - 1) * DAY_SECONDS;
const TODAY = 1;

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
    army: null as null | { amount: number; updatedTick: number; day: number },
    /** The neighbour's army, spent whenever the player acts, so it rests alongside the player's. */
    neighbourArmy: null as null | { amount: number; updatedTick: number; day: number },
    status: "Live" as "Live" | "Settled",
    chain: CHAIN_ID,
    /** Snapshot reads answered, and whether this Herald is failing them. */
    snapshotReads: 0,
    snapshotFails: false,
  };
  const answer = (url: URL): unknown => {
    if (url.pathname === "/manifest") return { version: 1, chainId: state.chain, contracts: { games: "0x5e45" } };
    if (url.pathname === "/games")
      return { chain: state.chain, games: [{ game_id: GAME_ID, name: "frontier-a", status: state.status }] };
    if (url.pathname === `/games/${GAME_ID}/snapshot`) state.snapshotReads++;
    if (url.pathname === `/games/${GAME_ID}/snapshot` && state.snapshotFails)
      return Response.json({ error: "snapshot unavailable" }, { status: 500 });
    if (url.pathname === `/games/${GAME_ID}/snapshot` && state.status === "Settled")
      return Response.json(
        { error: `Game ${GAME_ID} is finalized; its review snapshot holds GameRegistry` },
        { status: 409 },
      );
    if (url.pathname === `/games/${GAME_ID}/snapshot`)
      return snapshot(state.army, state.neighbourArmy, url.searchParams.get("owner"));
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
  /** The player acts: an explore story on the next block, their army's stamina spent at this tick. */
  const act = (stamina: number, day = TODAY) => {
    state.army = { amount: stamina, updatedTick: armiesTick(), day };
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
  const battle = () => {
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
      timestamp: Math.floor(Date.now() / 1000),
    });
  };
  /** The same host now serves a fresh chain: another chain id, and a history that starts again at block 11. */
  const newChain = (chain: string) => {
    state.chain = chain;
    log.length = 0;
  };
  return { answer, act, battle, newChain, state };
};

/** The game's rules with a short armies tick, the player's home realm, and their army if it still exists. */
type ArmyState = { amount: number; updatedTick: number; day: number };

/** Structure owners, so the fake narrows armies to one account's as Herald's owner filter does. */
const STRUCTURE_OWNERS = new Map([
  [HOME, PLAYER_ACCOUNT],
  [NEIGHBOUR_HOME, "0x7e1"],
]);

const snapshot = (army: ArmyState | null, neighbour: ArmyState | null, owner: string | null) => ({
  confirmed_block: 10,
  game_id: String(GAME_ID),
  models: [
    {
      model: "SliceRules",
      rows: [
        {
          key: "0x1",
          value: {
            ...preset.rules,
            game_id: GAME_ID,
            tick_config: { ...preset.rules.tick_config, armies_tick_in_seconds: ARMIES_TICK_SECONDS },
            troop_stamina_config: {
              ...preset.rules.troop_stamina_config,
              stamina_gain_per_tick: STAMINA_GAIN_PER_TICK,
            },
            epoch_seconds: DAY_SECONDS,
          },
        },
      ],
    },
    {
      model: "SettlementRules",
      rows: [
        {
          key: "0x4",
          value: {
            game_id: GAME_ID,
            registration_start: 0,
            registration_limit: 0,
            mode: "Single",
            spacing: REGION_SPACING,
          },
        },
      ],
    },
    {
      model: "GameRegistry",
      rows: [
        {
          key: "0x5",
          value: {
            game_id: GAME_ID,
            name: "0x1",
            preset_id: 1,
            creator: "0x1",
            settled: false,
            ready: true,
            dev_mode_on: false,
            start_settling_at: SEASON_START,
            start_main_at: SEASON_START,
            end_at: SEASON_START + 30 * DAY_SECONDS,
            end_grace_seconds: 0,
            seed: "0x1",
          },
        },
      ],
    },
    {
      model: "ExplorerTroops",
      rows: [
        ...(army ? [armyRow(ARMY, HOME, army)] : []),
        ...(neighbour ? [armyRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME, neighbour)] : []),
      ].filter(({ value }) => owner === null || BigInt(STRUCTURE_OWNERS.get(value.owner)!) === BigInt(owner)),
    },
  ],
});

const armyRow = (explorerId: number, home: number, army: ArmyState) => ({
  key: `0x${explorerId.toString(16)}`,
  value: {
    ...explorerFixture.expected.value,
    game_id: GAME_ID,
    explorer_id: explorerId,
    owner: home,
    // An army stands in the region of the day it marched out on.
    coord: { x: REGION_SPACING / 2, y: army.day * 4 * REGION_SPACING + REGION_SPACING / 2, alt: false },
    troops: {
      ...explorerFixture.expected.value.troops,
      count: "0x64",
      stamina: { amount: army.amount, updated_tick: army.updatedTick },
    },
  },
});

/** The Worker in workerd over storage that survives a restart, a fake Herald, and a push service answering `status`. */
const createHarness = async (level: "important" | "standard") => {
  const storage = newStorage();
  const herald = createHerald();
  const push = { status: 201, received: [] as number[] };
  const vapid = await vapidKeys();
  const start = () =>
    startWorker({
      bundle,
      storage,
      vapid,
      notifierPollMs: POLL_MS,
      outbound: (request) => {
        const url = new URL(request.url);
        if (url.origin === SHARD) {
          const answer = herald.answer(url);
          return answer instanceof Response ? answer : Response.json(answer);
        }
        if (url.href === PUSH_ENDPOINT) {
          push.received.push(push.status);
          return new Response(null, { status: push.status });
        }
        return new Response("unexpected outbound request", { status: 599 });
      },
    });
  const worker = await start();
  await seed(worker.db, level, await deviceKeys());
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
    db
      .prepare(`INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES (?, ?, 'active', ?)`)
      .bind(SHARD, CHAIN_ID, now),
  ]);
};

it("alerts the player's device once for a battle on a listed shard, and a restart resends nothing", async () => {
  const { herald, push, start, worker } = await createHarness("important");
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
}, 90_000);

it("alerts once when an army is rested, not if it acted again first, nor once it is gone or from an earlier day", async () => {
  const { herald, push, worker } = await createHarness("standard");
  await worker.runCron();
  await pause(polls(5)); // the notifier reaches the shard's head

  herald.act(0);
  await waitUntil(() => push.received.length >= 1, 30_000);
  expect(push.received).toEqual([201]);

  // Acting at the start of a tick puts the first wake exactly REST_TICKS on, and the second a whole tick after it.
  await waitUntil(() => Date.now() % ticks(1) < polls(1), 5_000);
  herald.act(0);
  const firstWake = (armiesTick() + REST_TICKS) * ticks(1);
  await pause(ticks(1));
  herald.act(0); // the army spends its stamina again before it was rested
  await waitUntil(() => Date.now() > firstWake + polls(2), 30_000);
  expect(push.received).toEqual([201]);
  await waitUntil(() => push.received.length >= 2, 30_000);
  expect(push.received).toEqual([201, 201]);

  herald.act(0);
  await pause(ticks(1));
  herald.state.army = null; // the army expires at rollover before it is rested
  await pause(ticks(REST_TICKS + 1) + polls(10));
  expect(push.received).toEqual([201, 201]);

  herald.act(0, TODAY - 1); // an army of yesterday's expedition is still a fact, but no longer an army
  await pause(ticks(REST_TICKS + 1) + polls(10));
  expect(push.received).toEqual([201, 201]);
  await worker.dispose();
}, 240_000);

it("a game that ends while an army rests alerts nothing for it, and every other alert still flows", async () => {
  const { herald, push, worker } = await createHarness("standard");
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
}, 90_000);

it("a wake that keeps failing is retried, then dropped, and every other alert still flows", async () => {
  const { herald, push, worker } = await createHarness("standard");
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
}, 120_000);

it("reads a new chain at the same URL from its own head, and sends nothing twice", async () => {
  const { herald, push, worker } = await createHarness("important");
  await worker.runCron();
  await pause(polls(5)); // the notifier reaches the shard's head
  herald.battle();
  herald.battle();
  await waitUntil(() => push.received.length >= 2, 20_000);
  expect(push.received).toEqual([201, 201]);

  // The host now serves a fresh chain whose history restarts below the old chain's cursor, and the directory says so.
  herald.newChain("0xb");
  await worker.db.prepare('UPDATE "shards" SET "chainId" = ? WHERE "url" = ?').bind("0xb", SHARD).run();
  await worker.runCron();
  await pause(polls(5)); // the notifier reaches the new chain's head
  herald.battle();
  await waitUntil(() => push.received.length >= 3, 20_000);
  await pause(polls(10));
  expect(push.received).toEqual([201, 201, 201]);
  await worker.dispose();
}, 60_000);
