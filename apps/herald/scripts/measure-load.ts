import { getNeighborHexes } from "@bibliothecadao/types";
import { expeditionRealmSite, expeditionDayEndsAt, absoluteEpoch } from "@bibliothecadao/eternum/expeditions";
// Herald's side of the scale campaign: does its memory level off under a steady game load, and does it keep up with
// real time? Folds a synthetic world, attaches one actor-scoped subscriber per player, then drives it through the
// production path for a simulated run: build-order-shaped actions arrive pre-confirmed, a block confirms each second,
// the chain clock ticks, and the clock advances so ring pruning behaves as in production. Explores revisit a bounded
// set of tiles, so the facts level off after warm-up and any later growth is held by something other than the world.
//   --shape blitz     a Blitz slot: 4 games of 24 players; with --turnover the oldest game ends every 15 minutes
//   --shape frontier  one Frontier game of --players, each subscriber scoped to the regions its armies stand in;
//                     after the run the day rolls over, and every subscriber's scope with it
// Run: pnpm --dir apps/herald measure:load --shape frontier --players 2000 --minutes 3 --sample-every 1
import { parseArgs } from "node:util";
import { presetRegistration, presetLaunch } from "../src/native/preset-fixtures";
import { LiveWorld } from "../src/live-world";
import { receipt, rowEvent, schema, setup, manifest, pointsAward } from "../src/native/fixtures";
import type { StreamSocket } from "../src/game-stream";
import type { RpcBlockWithReceipts, RpcEvent } from "../src/types";

const { values: flags } = parseArgs({
  options: {
    shape: { type: "string", default: "blitz" },
    players: { type: "string", default: "500" },
    minutes: { type: "string", default: "60" },
    "sample-every": { type: "string", default: "5" },
    turnover: { type: "boolean", default: false },
  },
});
if (flags.shape !== "blitz" && flags.shape !== "frontier") throw new Error(`Unknown shape ${flags.shape}`);
const FRONTIER = flags.shape === "frontier";
const GAMES = FRONTIER ? 1 : 4;
const PLAYERS_PER_GAME = FRONTIER ? Number(flags.players) : 24;
const SIMULATED_MINUTES = Number(flags.minutes);
const TILES_PER_PLAYER = FRONTIER ? 50 : 300;
const preset = presetRegistration(FRONTIER ? 5 : 2);
const SPACING = Number(preset.definition.settlement.spacing);
const MAP_STRUCTURES_PER_GAME = 150;
const BUILDINGS_PER_REALM = 20;
const RESOURCES_PER_REALM = 30;
const PRODUCTIONS_PER_REALM = 12;
const ARMIES_PER_PLAYER = 3;
const ACTION_EVERY_SECONDS = 5;
const SAMPLE_EVERY_MINUTES = Number(flags["sample-every"]);
/** With --turnover, the oldest game ends every 15 minutes: its players leave and a new game of 24 starts. */
const TURNOVER = !FRONTIER && flags.turnover;
const TURNOVER_EVERY_MINUTES = 15;

let now = Date.UTC(2026, 8, 23);
const startMainAt = Math.floor(now / 1000);
Date.now = () => now;

let counter = 1;
const next = () => BigInt(counter++) * 2_654_435_761n;

/**
 * A row's values in its schema's layout, with non-trivial magnitudes so serialized sizes resemble a live game.
 * Overrides name a member by its path, such as `base.category`.
 */
function values(type: string, overrides: Record<string, string | string[]> = {}, path = ""): string[] {
  if (path in overrides) {
    const value = overrides[path]!;
    return Array.isArray(value) ? value : [value];
  }
  const definition = schema.types[type];
  if (definition?.type === "struct")
    return definition.members.flatMap((member) =>
      values(member.type, overrides, path ? `${path}.${member.name}` : member.name),
    );
  if (definition?.type === "enum") return ["0", ...values(definition.variants[0].type)];
  if (type === "()") return [];
  if (type === "core::bool") return ["1"];
  if (type.includes("core::array::")) return ["0"];
  const integer = /^core::integer::u(8|16|32|64|128)$/.exec(type);
  if (integer) return [String(next() % (1n << BigInt(Math.min(Number(integer[1]), 48))))];
  return [`0x${next().toString(16)}`];
}

const row = (model: string, keys: (string | number)[], overrides: Record<string, string | string[]> = {}): RpcEvent => {
  const definition = schema.models.find(({ name }) => name === model)!;
  return rowEvent(
    model,
    keys.map(String),
    definition.members.flatMap((member) => values(member.type, overrides, member.name)),
  );
};

const owner = (game: number, player: number) => 0x1000 + game * 100 + player;
const realm = (game: number, player: number) => game * 10_000 + player + 1;

function initialPoints(game: number, player: number): RpcEvent {
  return pointsAward(String(game), String(owner(game, player)), "1000000", "1000000", String((player + 1) * 1000000));
}

/** One Frontier game: each player's realm, two armies and explored tiles in its own region of today's expedition. */
function frontierRows(game: number): RpcEvent[] {
  const events = presetLaunch(preset, game, Math.floor(now / 1000));
  for (let player = 0; player < PLAYERS_PER_GAME; player++) {
    const address = String(owner(game, player));
    const structure = realm(game, player);
    const column = player * SPACING;
    events.push(
      row("PlayerEntry", [game, address], { player: address }),
      initialPoints(game, player),
      row("Structure", [game, structure], {
        owner: address,
        "base.category": "1",
        "metadata.realm_id": String(player + 1),
      }),
      row("StructureBuildings", [game, structure]),
    );
    for (let resource = 1; resource <= RESOURCES_PER_REALM; resource++)
      events.push(row("ResourceBalance", [game, structure, resource]));
    for (let army = 0; army < 2; army++) events.push(...frontierArmy(game, player, army, 5 + army));
    for (let tile = 0; tile < TILES_PER_PLAYER; tile++)
      events.push(row("TileOpt", [game, 0, column + (tile % SPACING), Math.floor(tile / SPACING)]));
  }
  return events;
}

const occupied = new Map<string, [number, number, number, number]>();

function place(
  game: number,
  entity: number,
  col: number,
  rowIndex: number,
  category: number,
  structure: boolean,
): RpcEvent[] {
  const id = `${game}:${entity}`;
  const previous = occupied.get(id);
  const keys: [number, number, number, number] = [game, 0, col, rowIndex];
  occupied.set(id, keys);
  const events: RpcEvent[] = [];
  if (previous) {
    const layout = schema.games.events.find((event) => event.name === "RowDeleted")!;
    const model = schema.models.find((model) => model.name === "TileOccupancy")!;
    events.push({
      from_address: manifest.world.address,
      keys: [...layout.prefix, "1", model.identity],
      data: ["4", ...previous.map(String)],
    });
  }
  events.push(
    row("TileOccupancy", keys, {
      entity_id: String(entity),
      category: String(category),
      is_structure: structure ? "1" : "0",
    }),
  );
  return events;
}

const frontierArmy = (game: number, player: number, army: number, x: number) => {
  const entity = realm(game, player) * 10 + army;
  return [
    row("ExplorerTroops", [game, entity], {
      owner: String(realm(game, player)),
      "troops.count": "1000",
      "troops.stamina": ["1", String(army)],
    }),
    row(
      "ArmySlot",
      [
        game,
        realm(game, player),
        absoluteEpoch({ epochSeconds: Number(preset.definition.rules.epoch_seconds) }, Math.floor(now / 1000)),
        army,
      ],
      {
        explorer_id: String(entity),
        "stamina.amount": String(preset.definition.rules.troop_stamina_config.stamina_initial),
        "stamina.updated_tick": String(
          Math.floor(now / 1000 / Number(preset.definition.rules.tick_config.armies_tick_in_seconds)),
        ),
      },
    ),
    ...place(game, entity, player * SPACING + x, 5, 15, false),
  ];
};

function gameRows(game: number): RpcEvent[] {
  if (FRONTIER) return frontierRows(game);
  // Blitz: no expedition epochs, so every subscriber sees the whole game.
  const events = presetLaunch(
    preset,
    game,
    Math.floor(now / 1000),
    Array.from({ length: PLAYERS_PER_GAME }, (_, player) => owner(game, player)),
  );
  for (let player = 0; player < PLAYERS_PER_GAME; player++) {
    const structure = realm(game, player);
    events.push(
      row("PlayerEntry", [game, owner(game, player)]),
      initialPoints(game, player),
      row("EntityName", [game, structure]),
      row("Structure", [game, structure]),
      ...place(game, structure, player * 1000, 0, 1, true),
      row("StructureBuildings", [game, structure]),
      row("ResourceWeight", [game, structure]),
      row("ProductionBonus", [game, structure]),
    );
    for (let index = 0; index < BUILDINGS_PER_REALM; index++)
      events.push(row("Building", [game, structure, index % 7, Math.floor(index / 7)]));
    for (let resource = 1; resource <= RESOURCES_PER_REALM; resource++)
      events.push(row("ResourceBalance", [game, structure, resource]));
    for (let resource = 1; resource <= PRODUCTIONS_PER_REALM; resource++)
      events.push(
        row("ResourceProduction", [game, structure, resource]),
        row("ProductionReceiver", [game, structure, resource]),
      );
    for (let army = 0; army < ARMIES_PER_PLAYER; army++)
      events.push(
        row("ExplorerTroops", [game, structure * 10 + army], { owner: String(structure) }),
        ...place(game, structure * 10 + army, player * 1000 + 5 + army, 5, 15, false),
      );
    for (let tile = 0; tile < TILES_PER_PLAYER; tile++)
      events.push(row("TileOpt", [game, 0, player * 1_000 + tile, tile]));
  }
  for (let structure = 0; structure < MAP_STRUCTURES_PER_GAME; structure++) {
    const entity = game * 10_000 + 1_000 + structure;
    events.push(
      row("Structure", [game, entity]),
      row("StructureBuildings", [game, entity]),
      ...place(game, entity, 100000 + structure, 100000, 1, true),
    );
    for (let slot = 0; slot < 2; slot++) events.push(row("Guard", [game, entity, slot]));
    for (let resource = 1; resource <= 5; resource++) events.push(row("ResourceBalance", [game, entity, resource]));
  }
  return events;
}

/** One player's action, shaped like the build order: an explore, a building, or a production run. */
function action(game: number, player: number, step: number): RpcEvent[] {
  const structure = realm(game, player);
  if (FRONTIER)
    return [
      row("TileOpt", [game, 0, player * SPACING + (step % SPACING), step % 3]),
      ...frontierArmy(game, player, step % 2, 5 + (step % 10)),
      row("ResourceBalance", [game, structure, (step % RESOURCES_PER_REALM) + 1]),
    ];
  const balances = [1, 2, 3].map((offset) =>
    row("ResourceBalance", [game, structure, ((step + offset) % RESOURCES_PER_REALM) + 1]),
  );
  if (step % 3 === 0)
    return [
      row("TileOpt", [game, 0, player * 1_000 + (step % TILES_PER_PLAYER), step % TILES_PER_PLAYER]),
      row("ExplorerTroops", [game, structure * 10 + (step % ARMIES_PER_PLAYER)], { owner: String(structure) }),
      ...place(game, structure * 10 + (step % ARMIES_PER_PLAYER), player * 1000 + 5 + (step % 10), 5, 15, false),
      ...balances,
    ];
  if (step % 3 === 1)
    return [
      row("Building", [game, structure, step % 7, Math.floor(step / 7) % 3]),
      row("StructureBuildings", [game, structure]),
      ...balances,
    ];
  return [row("ResourceProduction", [game, structure, (step % PRODUCTIONS_PER_REALM) + 1]), ...balances];
}

const heapMb = () => {
  Bun.gc(true);
  return Math.round(process.memoryUsage().heapUsed / 1_048_576);
};

const { native, decoder, fold } = setup();
let block = 10;
native.applyReceipt(fold, receipt([preset.event]), block, 0, preset.calldata);
for (let game = 1; game <= GAMES; game++) {
  const events = gameRows(game);
  for (let start = 0; start < events.length; start += 500)
    native.applyReceipt(fold, receipt(events.slice(start, start + 500), `0x${next().toString(16)}`), block, 0);
}
const afterFold = heapMb();

/** Freezes each finalized game's review snapshot once, as the history store does, without keeping it. */
function reviews() {
  const frozen = new Set<string>();
  return {
    appendEvents: async () => {},
    recordTransaction: () => {},
    freezeReviewSnapshot: async (gameId: string, snapshot: () => unknown) => {
      if (frozen.has(gameId)) return;
      snapshot();
      frozen.add(gameId);
    },
  } as never;
}

const blocks = new Map<number, RpcBlockWithReceipts>();
const pendingBlock = (): RpcBlockWithReceipts => ({
  block_number: block + 1,
  timestamp: Math.floor(now / 1000),
  transactions: [],
});
const live = new LiveWorld({
  native,
  registry: decoder.registry,
  chain: "madara",
  checkpointEveryBlocks: 100,
  checkpointStore: { save: async () => {} },
  confirmedBlock: block,
  confirmedFold: fold,
  historyStore: reviews(),
  // The campaign has no node: model its seven home-ring view results on the shared expedition grid.
  homeRingView: async (_gameId, realmId, timestamp) => {
    const site = expeditionRealmSite(
      { epochSeconds: Number(preset.definition.rules.epoch_seconds), spacing: SPACING, startMainAt },
      realmId,
      timestamp,
    );
    return [site, ...getNeighborHexes(site.col, site.row)].map(({ col, row }) => ({ col, row, biome: 5 }));
  },
  rpc: {
    getBlockWithReceipts: async (number: number | "pre_confirmed") =>
      number === "pre_confirmed" ? pendingBlock() : blocks.get(number)!,
    getPreconfirmedHeader: async () => ({ block_number: block + 1, timestamp: Math.floor(now / 1000) }),
  } as never,
});
let bytesSent = 0;
const socket: StreamSocket = { send: (data) => void (bytesSent += data.length) };
const sessions = new Map<number, ReturnType<typeof live.attach>[]>();
const joinGame = (game: number) => {
  const joined = [];
  for (let player = 0; player < PLAYERS_PER_GAME; player++) {
    const session = live.attach(String(game), socket, `0x${owner(game, player).toString(16)}`);
    live.resume(session, { epoch: "", seq: 0, type: "resume" });
    joined.push(session);
  }
  sessions.set(game, joined);
};
// Herald has its chain clock before players attach, so a first scope is taken on the real day.
block++;
blocks.set(block, { block_number: block, timestamp: Math.floor(now / 1000), transactions: [] });
await live.acceptSubscribedHead({ block_number: block, timestamp: Math.floor(now / 1000) });
const activeGames = Array.from({ length: GAMES }, (_, index) => index + 1);
const attachStarted = performance.now();
activeGames.forEach(joinGame);
const attachSeconds = Math.round((performance.now() - attachStarted) / 100) / 10;
const afterSubscribers = heapMb();
/** Wall time for one head published to every stream, the message every subscriber receives each block. */
const headMs = () => {
  const started = performance.now();
  live.hub.publishHead("1", block, Math.floor(now / 1000), true);
  return Math.round((performance.now() - started) * 10) / 10;
};
const timed = (run: () => void) => {
  const started = performance.now();
  run();
  return Math.round((performance.now() - started) * 10) / 10;
};
console.log(
  JSON.stringify({
    event: "loaded",
    foldRows: fold.retainedRowCount(),
    afterFold,
    afterSubscribers,
    attachSeconds,
    headMs: headMs(),
    warmHeadMs: headMs(),
    scopeMs: timed(() => fold.subscriptionScope("1", `0x${owner(1, 0).toString(16)}`, Math.floor(now / 1000))),
    actionMs: timed(() =>
      live.acceptReceipt({ ...receipt(action(1, 0, 1), "0xabc"), finality_status: "PRE_CONFIRMED" }),
    ),
  }),
);
let sampleStarted = performance.now();

const players = GAMES * PLAYERS_PER_GAME;
let step = 0;
for (let second = 1; second <= SIMULATED_MINUTES * 60; second++) {
  now += 1_000;
  const transactions: RpcBlockWithReceipts["transactions"] = [];
  for (let index = 0; index < players / ACTION_EVERY_SECONDS; index++) {
    const player = step % players;
    const game = activeGames[Math.floor(player / PLAYERS_PER_GAME)]!;
    const hash = `0x${next().toString(16)}`;
    const transaction = { type: "INVOKE", sender_address: `0x${owner(game, player % PLAYERS_PER_GAME).toString(16)}` };
    const actionReceipt = receipt(action(game, player % PLAYERS_PER_GAME, step), hash);
    live.acceptTransaction({ transaction_hash: hash, transaction } as never);
    live.acceptReceipt({ ...actionReceipt, finality_status: "PRE_CONFIRMED" });
    transactions.push({ receipt: actionReceipt, transaction } as never);
    step++;
  }
  block++;
  blocks.set(block, { block_number: block, timestamp: Math.floor(now / 1000), transactions });
  await live.acceptSubscribedHead({ block_number: block, timestamp: Math.floor(now / 1000) });
  blocks.delete(block);
  await live.publishChainClock();
  if (TURNOVER && second % (TURNOVER_EVERY_MINUTES * 60) === 0) {
    const ended = activeGames.shift()!;
    sessions.get(ended)!.forEach((session) => live.detach(session));
    sessions.delete(ended);
    const result = [row("GameRegistry", [ended], { settled: "1" }), row("BlitzResult", [ended], { complete: "1" })];
    native.applyReceipt(fold, receipt(result, `0x${next().toString(16)}`), block, 0);
    const started = Math.max(...activeGames) + 1;
    const events = gameRows(started);
    for (let start = 0; start < events.length; start += 500)
      native.applyReceipt(fold, receipt(events.slice(start, start + 500), `0x${next().toString(16)}`), block, 0);
    activeGames.push(started);
    joinGame(started);
  }
  if (second % (SAMPLE_EVERY_MINUTES * 60) === 0)
    console.log(
      JSON.stringify({
        minute: second / 60,
        heapMb: heapMb(),
        rssMb: Math.round(process.memoryUsage().rss / 1_048_576),
        replay: live.hub.replayUsage(),
        foldRows: fold.retainedRowCount(),
        actions: step,
        mbSent: Math.round(bytesSent / 1_048_576),
        headMs: headMs(),
        wallSecondsPerSample: Math.round((performance.now() - sampleStarted) / 1000),
      }),
    );
  if (second % (SAMPLE_EVERY_MINUTES * 60) === 0) sampleStarted = performance.now();
}

if (FRONTIER) {
  // The day rolls over at 00:00 UTC: every subscriber's scope moves to the new expedition at once.
  now =
    expeditionDayEndsAt({ epochSeconds: Number(preset.definition.rules.epoch_seconds) }, Math.floor(now / 1000)) * 1000;
  const [started, sentBefore] = [performance.now(), bytesSent];
  await live.publishChainClock();
  console.log(
    JSON.stringify({
      event: "rollover",
      seconds: Math.round((performance.now() - started) / 100) / 10,
      mbSent: Math.round((bytesSent - sentBefore) / 1_048_576),
      heapMb: heapMb(),
      rssMb: Math.round(process.memoryUsage().rss / 1_048_576),
      replay: live.hub.replayUsage(),
    }),
  );
}
