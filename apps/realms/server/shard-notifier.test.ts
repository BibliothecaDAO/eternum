import { dayOf } from "@bibliothecadao/eternum/expeditions";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { beforeAll, expect, it } from "vitest";

import preset from "../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
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
/**
 * A Frontier season in its second day, each day a row of 40-hex regions. Its four-hour units draw from seed 1, whose
 * first bag opens with a 12-hour day and a 16-hour one: the season started 13 hours ago, an hour into day 1.
 */
const DAY_UNIT_SECONDS = 14_400;
const REGION_SPACING = 40;
const SEASON_START = Math.floor(Date.now() / 1000) - 13 * 3_600;
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
    seasonStart: SEASON_START,
    members: [PLAYER_ACCOUNT],
  };
  const answer = (url: URL): unknown => {
    if (url.pathname === "/manifest") return { version: 1, chainId: state.chain, contracts: { games: "0x5e45" } };
    if (url.pathname === "/games")
      return {
        chain: state.chain,
        games: [
          {
            game_id: GAME_ID,
            name: "frontier-a",
            status: state.status,
            mode: "frontier",
            clock: { start_main_at: state.seasonStart, end_at: state.seasonStart + 21 * 20 * DAY_UNIT_SECONDS },
            expedition: { seed: "1", day_unit_seconds: DAY_UNIT_SECONDS },
          },
        ],
      };
    if (url.pathname === `/games/${GAME_ID}/snapshot`) state.snapshotReads++;
    if (url.pathname === `/games/${GAME_ID}/snapshot` && state.snapshotFails)
      return Response.json({ error: "snapshot unavailable" }, { status: 500 });
    if (url.pathname === `/games/${GAME_ID}/snapshot` && state.status === "Settled")
      return Response.json(
        { error: `Game ${GAME_ID} is finalized; its review snapshot holds GameRegistry` },
        { status: 409 },
      );
    if (url.pathname === `/games/${GAME_ID}/snapshot`)
      return snapshot(state.army, state.neighbourArmy, url.searchParams.get("owner"), state.members);
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

const snapshot = (army: ArmyState | null, neighbour: ArmyState | null, owner: string | null, members: string[]) => ({
  confirmed_block: 10,
  game_id: String(GAME_ID),
  models: [
    {
      model: "PlayerEntry",
      rows: members.map((account) => ({
        key: account,
        value: {
          game_id: GAME_ID,
          owner: account,
          player: "0xdead",
        },
      })),
    },
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
            day_unit_seconds: DAY_UNIT_SECONDS,
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
            end_at: SEASON_START + 2 * 20 * DAY_UNIT_SECONDS,
            end_grace_seconds: 0,
            seed: "0x1",
          },
        },
      ],
    },
    {
      model: "TileOccupancy",
      rows: [
        ...(army ? [armyPosition(ARMY, HOME, army)] : []),
        ...(neighbour ? [armyPosition(NEIGHBOUR_ARMY, NEIGHBOUR_HOME, neighbour)] : []),
      ]
        .filter(({ home }) => owner === null || BigInt(STRUCTURE_OWNERS.get(home)!) === BigInt(owner))
        .map(({ home: _home, ...row }) => row),
    },
    {
      model: "ArmySlot",
      rows: [
        ...(army ? [armySlotRow(ARMY, HOME, army)] : []),
        ...(neighbour ? [armySlotRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME, neighbour)] : []),
      ].filter(({ value }) => owner === null || BigInt(STRUCTURE_OWNERS.get(value.structure_id)!) === BigInt(owner)),
    },
    {
      model: "ArmyProgress",
      rows: [
        ...(army ? [armyProgressRow(ARMY, HOME)] : []),
        ...(neighbour ? [armyProgressRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME)] : []),
      ]
        .filter(({ home }) => owner === null || BigInt(STRUCTURE_OWNERS.get(home)!) === BigInt(owner))
        .map(({ home: _home, ...row }) => row),
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
    troops: {
      ...explorerFixture.expected.value.troops,
      count: "0x64",
      stamina: { Slot: 0 },
    },
  },
});

const armyProgressRow = (explorerId: number, home: number) => ({
  home,
  key: `0x${explorerId.toString(16)}`,
  value: {
    game_id: GAME_ID,
    explorer_id: explorerId,
    xp: 0,
    battle: 1,
    logistics: 1,
    scouting: 1,
    scouting_kinds: 0,
    homecoming: 1,
  },
});

const armySlotRow = (explorerId: number, home: number, army: ArmyState) => ({
  key: `0x${home.toString(16)}`,
  value: {
    game_id: GAME_ID,
    structure_id: home,
    epoch: army.day,
    slot: 0,
    explorer_id: explorerId,
    stamina: { amount: army.amount, updated_tick: army.updatedTick },
  },
});

const armyPosition = (explorerId: number, home: number, army: ArmyState) => ({
  home,
  key: `0x${explorerId.toString(16)}`,
  value: {
    game_id: GAME_ID,
    // An army stands in the region of the day it marched out on.
    alt: false,
    col: (home === HOME ? 0 : REGION_SPACING) + REGION_SPACING / 2,
    row: army.day * 4 * REGION_SPACING + REGION_SPACING / 2,
    entity_id: explorerId,
    category: 15,
    is_structure: false,
  },
});

/** The Worker in workerd over storage that survives a restart, a fake Herald, and a push service answering `status`. */
const createHarness = async (level: "off" | "important" | "standard" | "all", pollMs = POLL_MS) => {
  const storage = newStorage();
  const herald = createHerald();
  const push = {
    status: 201,
    received: [] as number[],
    times: [] as number[],
    endpoints: [] as string[],
    stalledEndpoint: null as string | null,
  };
  const vapid = await vapidKeys();
  const start = () =>
    startWorker({
      bundle,
      storage,
      vapid,
      notifierPollMs: pollMs,
      outbound: (request) => {
        const url = new URL(request.url);
        if (url.origin === SHARD) {
          const answer = herald.answer(url);
          return answer instanceof Response ? answer : Response.json(answer);
        }
        if (url.href.startsWith(PUSH_ENDPOINT)) {
          push.received.push(push.status);
          push.times.push(Date.now());
          push.endpoints.push(url.href);
          if (url.href === push.stalledEndpoint)
            return pause(1500).then(() => new Response(null, { status: push.status }));
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

/** Put the shared calendar's first reminder a few seconds ahead; no player needs to have acted. */
const remindSoon = (herald: ReturnType<typeof createHerald>, seconds = 8, dayIndex = 0) => {
  const dueAt = (Math.floor(Date.now() / 1000) + seconds) * 1000;
  const calendar = { seed: 1n, startMainAt: 0, dayUnitSeconds: DAY_UNIT_SECONDS };
  let day = dayOf(calendar, 0)!;
  for (let index = 0; index < dayIndex; index++) day = dayOf(calendar, day.end)!;
  herald.state.seasonStart = dueAt / 1000 + 3600 - day.end;
  return dueAt;
};

it.each(["important", "all"] as const)(
  "rule 9.6 sends one reminder to an inactive %s player at its seeded instant",
  async (level) => {
    const { herald, push, worker, start } = await createHarness(level, 1000);
    const dueAt = remindSoon(herald);
    // Being in the game is not a quiet-hours or foreground exception for the reminder.
    await worker.db
      .prepare('UPDATE "notification_push_subscriptions" SET "gameForegroundUntil" = ?')
      .bind(dueAt + 60_000)
      .run();
    await worker.runCron();
    await waitUntil(() => push.received.length > 0, 15_000);
    expect(push.received).toEqual([201]);
    expect(push.times[0]).toBeGreaterThanOrEqual(dueAt);
    expect(push.times[0]).toBeLessThan(dueAt + 1000);
    await worker.dispose();
    const restarted = await start();
    await restarted.runCron();
    await pause(2000);
    expect(push.received).toEqual([201]);
    await restarted.dispose();
  },
  45_000,
);

it("rule 9.6 covers enrollment beyond a story page, including another inactive player", async () => {
  const { herald, push, worker } = await createHarness("important", 1000);
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
  remindSoon(herald);
  await worker.runCron();
  await waitUntil(() => push.received.length === 2, 15_000);
  expect(push.endpoints.sort()).toEqual([PUSH_ENDPOINT, endpoint]);
  await worker.dispose();
}, 45_000);

it("rule 9.6 drops a missed trigger on a newly started notifier", async () => {
  const { herald, push, worker } = await createHarness("important", 1000);
  remindSoon(herald, -2);
  await worker.runCron();
  await pause(2000);
  expect(push.received).toEqual([]);
  await worker.dispose();
}, 45_000);

it("rule 9.6 rechecks preferences after preparation and cancels a finished game's reminder", async () => {
  for (const cancelledBy of ["off", "settled"] as const) {
    const { herald, push, worker } = await createHarness("important", 1000);
    const dueAt = remindSoon(herald);
    await worker.runCron();
    await waitUntil(() => herald.state.snapshotReads > 0, 4000);
    expect(herald.state.snapshotReads).toBeGreaterThan(0);
    if (cancelledBy === "off")
      await worker.db.prepare('UPDATE "notification_preferences" SET "level" = ?').bind("off").run();
    else herald.state.status = "Settled";
    await pause(Math.max(0, dueAt + 1500 - Date.now()));
    expect(push.received).toEqual([]);
    await worker.dispose();
  }
}, 45_000);

it("rule 9.6 never reminds Off or a device without game-alert consent", async () => {
  const { herald, push, worker } = await createHarness("off", 1000);
  const dueAt = remindSoon(herald);
  await worker.runCron();
  await pause(Math.max(0, dueAt + 1500 - Date.now()));
  expect(push.received).toEqual([]);
  await worker.dispose();
  const other = await createHarness("important", 1000);
  const otherDue = remindSoon(other.herald);
  await other.worker.db.prepare('UPDATE "notification_push_subscriptions" SET "gameAlertsEnabledAt" = NULL').run();
  await other.worker.runCron();
  await pause(Math.max(0, otherDue + 1500 - Date.now()));
  expect(other.push.received).toEqual([]);
  await other.worker.dispose();
}, 45_000);

it("rule 9.6 drops a lost delivery rather than retrying after the hour", async () => {
  const { herald, push, worker, start } = await createHarness("important", 1000);
  const dueAt = remindSoon(herald);
  push.status = 503;
  await worker.runCron();
  await waitUntil(() => push.received.length > 0, 15_000);
  expect(push.received).toEqual([503]);
  await worker.dispose();
  await pause(Math.max(0, dueAt + 1500 - Date.now()));
  const restarted = await start();
  push.status = 201;
  await restarted.runCron();
  await pause(2000);
  expect(push.received).toEqual([503]);
  await restarted.dispose();
}, 45_000);

/** Each extra player owns one eligible device, within the production per-owner cap. */
const addReminderPlayers = async (worker: Awaited<ReturnType<typeof startWorker>>, count: number) => {
  const now = Date.now();
  const players = Array.from({ length: count }, (_, index) => {
    const id = `reminder-extra-${index}`;
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

it("rule 9.6 starts device 101 in its scheduled second while an endpoint in the first hundred stalls", async () => {
  const { herald, push, worker } = await createHarness("important", 1000);
  try {
    const players = await addReminderPlayers(worker, 100);
    herald.state.members.push(...players.map((player) => player.account));
    const ordered = [{ owner: OWNER, endpoint: PUSH_ENDPOINT }, ...players].sort((a, b) =>
      a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : 0,
    );
    push.stalledEndpoint = ordered[0]!.endpoint;
    const dueAt = remindSoon(herald, 10);
    await worker.runCron();
    await waitUntil(() => push.endpoints.length === 101, 15_000);
    const last = push.endpoints.indexOf(ordered[100]!.endpoint);
    expect(last).toBeGreaterThanOrEqual(0);
    expect(push.times[last]).toBeGreaterThanOrEqual(dueAt);
    expect(push.times[last]).toBeLessThan(dueAt + 1000);
    expect(push.times.every((time) => time >= dueAt && time < dueAt + 1000)).toBe(true);
    await pause(Math.max(0, dueAt + 2500 - Date.now()));
    expect(new Set(push.endpoints).size).toBe(101);
    expect(push.endpoints).toHaveLength(101);
  } finally {
    await worker.dispose();
  }
}, 45_000);

it.each([false, true])(
  "rule 9.6 fixes eligibility at preparation (empty cohort: %s), then includes a late enrolment next day",
  async (initiallyEmpty) => {
    const { herald, push, worker } = await createHarness("important", 1000);
    try {
      const [late] = await addReminderPlayers(worker, 1);
      if (initiallyEmpty) herald.state.members = [];
      const dueAt = remindSoon(herald, 8);
      await worker.runCron();
      await waitUntil(() => herald.state.snapshotReads > 0, 4000);
      expect(herald.state.snapshotReads).toBeGreaterThan(0);
      herald.state.members.push(late!.account);
      await pause(Math.max(0, dueAt + 1500 - Date.now()));
      expect(push.endpoints).toEqual(initiallyEmpty ? [] : [PUSH_ENDPOINT]);
      const nextDue = remindSoon(herald, 8, 1); // Advance the fake shard to the next seeded day.
      await worker.runCron();
      await waitUntil(() => push.endpoints.includes(late!.endpoint), 12_000);
      expect(push.endpoints.filter((endpoint) => endpoint === late!.endpoint)).toHaveLength(1);
      const attempt = push.endpoints.indexOf(late!.endpoint);
      expect(push.times[attempt]).toBeGreaterThanOrEqual(nextDue);
      expect(push.times[attempt]).toBeLessThan(nextDue + 1000);
    } finally {
      await worker.dispose();
    }
  },
  45_000,
);
