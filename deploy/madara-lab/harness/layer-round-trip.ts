import { ETHEREAL_STRIDE } from "../../../packages/types/src/constants/hex";
import { setTimeout as sleep } from "node:timers/promises";
import { CallData, type Call, type RpcProvider } from "starknet";
import { tileDataToTile } from "../../../packages/types/src/utils/tile";
import {
  cubeDistance,
  neighbor,
  submitCalls,
  trackTransaction,
  type HarnessBot,
  type TrackedTransaction,
} from "./driver";
import { HeraldObserver, type HeraldExplorer } from "./herald-observer";

type Coord = { alt: boolean; x: number; y: number };
type Tile = ReturnType<typeof tileDataToTile>;
type StepKind = "approach" | "enter" | "explore" | "return" | "exit";

export interface LayerRoundTripEvidence {
  gameId: number;
  botId?: number;
  explorerId?: string;
  spire?: { id: number; x: number; y: number };
  portalFee?: { homeStructureId: string; essencePerCrossing: string };
  status: "passed" | "failed";
  error?: string;
  steps: Array<{ kind: StepKind; transaction: TrackedTransaction; explorer?: Coord; exploredTile?: Coord }>;
}

interface RoundTripOptions {
  bots: HarnessBot[];
  gameId: number;
  provider: RpcProvider;
  heraldUrl: string;
  troopMovementAddress: string;
  altMovementAddress: string;
}

interface RoundTripContext extends RoundTripOptions {
  bot: HarnessBot;
  explorer: HeraldExplorer;
  observer: HeraldObserver;
  evidence: LayerRoundTripEvidence;
  stamina: { gain: number; tickSeconds: number; required: number };
}

// The contract's ethereal stride is 15 coordinates. East/west are exact inverses on either row parity.
const SPIRE_OCCUPIER = 35;
const OBSERVATION_TIMEOUT_MS = 30_000;
const MAX_APPROACH_TRANSACTIONS = 256;

export async function runLayerRoundTrip(options: RoundTripOptions): Promise<LayerRoundTripEvidence> {
  const evidence: LayerRoundTripEvidence = { gameId: options.gameId, status: "failed", steps: [] };
  try {
    const context = await prepareRoundTrip(options, evidence);
    const access = await approachSpire(context);
    await toggleLayer(context, "enter", access.direction);
    await exploreAndReturn(context);
    await toggleLayer(context, "exit", access.direction);
    evidence.status = "passed";
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : String(error);
  }
  return evidence;
}

async function prepareRoundTrip(
  options: RoundTripOptions,
  evidence: LayerRoundTripEvidence,
): Promise<RoundTripContext> {
  const observer = new HeraldObserver(options.heraldUrl, "madara");
  const models = await observer.readModelRows(options.gameId, ["GameRegistry", "WorldConfig", "PresetConfig"]);
  const game = models.get("GameRegistry")![0];
  const world = models.get("WorldConfig")![0];
  if (!game || world?.blitz_mode_on !== false) throw new Error("Layer round trip requires an Eternum game");
  const preset = models
    .get("PresetConfig")!
    .find((row) => BigInt(row.preset_id as string) === BigInt(game.preset_id as string));
  if (!preset) throw new Error("Layer round trip has no matching preset");
  const explorers = await observer.readExplorers(options.gameId);
  const tiles = await readTiles(observer, options.gameId);
  const spires = tiles.filter((tile) => !tile.alt && tile.occupier_type === SPIRE_OCCUPIER);
  if (!spires.length) throw new Error("Eternum game has no spires");
  const candidates = options.bots
    .flatMap((bot) =>
      bot.explorers.flatMap(({ explorerId }) => {
        const explorer = explorers.find((row) => row.explorerId === String(explorerId) && !row.alt);
        return explorer ? [{ bot, explorer }] : [];
      }),
    )
    .sort((a, b) => nearestSpireDistance(a.explorer, spires) - nearestSpireDistance(b.explorer, spires));
  const candidate = candidates[0];
  if (!candidate) throw new Error("No surface bot explorer is available for the round trip");
  if (preset.spire_travel_essence_cost === undefined) throw new Error("Portal fee is missing from the preset snapshot");
  evidence.portalFee = {
    homeStructureId: candidate.explorer.owner,
    essencePerCrossing: BigInt(preset.spire_travel_essence_cost as string).toString(),
  };
  evidence.botId = candidate.bot.botId;
  evidence.explorerId = candidate.explorer.explorerId;
  return { ...options, ...candidate, evidence, observer, stamina: resolveMovementStamina(preset) };
}

function resolveMovementStamina(preset: Record<string, unknown>): RoundTripContext["stamina"] {
  const troops = requireRecord(preset.troop_stamina_config, "troop_stamina_config");
  const ticks = requireRecord(preset.tick_config, "tick_config");
  return {
    gain: nonnegative(troops.stamina_gain_per_tick, "stamina gain"),
    tickSeconds: positive(ticks.armies_tick_in_seconds, "army tick"),
    required: Math.max(
      nonnegative(troops.stamina_explore_stamina_cost, "exploration cost"),
      nonnegative(troops.stamina_travel_stamina_cost, "travel cost") +
        nonnegative(troops.stamina_bonus_value, "travel modifier"),
    ),
  };
}

async function approachSpire(context: RoundTripContext): Promise<{ direction: number }> {
  for (let attempt = 0; attempt <= MAX_APPROACH_TRANSACTIONS; attempt++) {
    const tiles = await readTiles(context.observer, context.gameId);
    const access = chooseSpireAccess(context.explorer, tiles);
    if (!access) throw new Error("No spire has a free landing tile and an unexplored ethereal neighbor");
    context.evidence.spire = { id: access.spire.occupier_id, x: access.spire.col, y: access.spire.row };
    if (samePosition(context.explorer, access.coord)) return { direction: access.direction };
    if (attempt === MAX_APPROACH_TRANSACTIONS) break;
    const direction = routeToSpire(context.explorer, access.coord, tiles);
    const target = { ...neighbor(context.explorer, direction), alt: false };
    const tile = tiles.find((row) => sameTile(row, target));
    await moveExplorer(context, "approach", direction, !tile?.biome, target);
  }
  throw new Error(`Spire approach exceeded ${MAX_APPROACH_TRANSACTIONS} transactions`);
}

function chooseSpireAccess(explorer: HeraldExplorer, tiles: readonly Tile[]) {
  const candidates = tiles
    .filter((tile) => !tile.alt && tile.occupier_type === SPIRE_OCCUPIER)
    .flatMap((spire) => {
      const paired = tiles.some(
        (tile) =>
          tile.alt &&
          tile.col === spire.col &&
          tile.row === spire.row &&
          tile.occupier_type === SPIRE_OCCUPIER &&
          tile.occupier_id === spire.occupier_id,
      );
      if (!paired) return [];
      return [0, 1, 2, 3, 4, 5].flatMap((side) => {
        const coord = { ...neighbor({ x: spire.col, y: spire.row }, side), alt: false };
        const direction = [0, 1, 2, 3, 4, 5].find((direction) => {
          const target = neighbor(coord, direction);
          return target.x === spire.col && target.y === spire.row;
        })!;
        const surface = tiles.find((tile) => sameTile(tile, coord));
        const landing = { ...coord, alt: true };
        const alternate = tiles.find((tile) => sameTile(tile, landing));
        if ((surface?.occupier_id && String(surface.occupier_id) !== explorer.explorerId) || alternate?.occupier_id)
          return [];
        if (!chooseEtherealExplore(landing, tiles)) return [];
        return [{ spire, coord, direction }];
      });
    });
  return candidates.sort((a, b) => cubeDistance(explorer, a.coord) - cubeDistance(explorer, b.coord))[0];
}

function routeToSpire(start: Coord, goal: Coord, tiles: readonly Tile[]): number {
  const occupied = new Set(
    tiles.filter((tile) => !tile.alt && tile.occupier_id !== 0).map((tile) => `${tile.col}:${tile.row}`),
  );
  const open = [{ coord: start, cost: 0, first: -1 }];
  const visited = new Set<string>();
  while (open.length && visited.size < 20_000) {
    open.sort((a, b) => a.cost + cubeDistance(a.coord, goal) - b.cost - cubeDistance(b.coord, goal));
    const current = open.shift()!;
    const key = `${current.coord.x}:${current.coord.y}`;
    if (visited.has(key)) continue;
    if (samePosition(current.coord, goal)) return current.first;
    visited.add(key);
    for (let direction = 0; direction < 6; direction++) {
      const coord = { ...neighbor(current.coord, direction), alt: false };
      const nextKey = `${coord.x}:${coord.y}`;
      if (
        visited.has(nextKey) ||
        occupied.has(nextKey) ||
        coord.x < 0 ||
        coord.y < 0 ||
        coord.x > 0xffffffff ||
        coord.y > 0xffffffff
      )
        continue;
      open.push({ coord, cost: current.cost + 1, first: current.first === -1 ? direction : current.first });
    }
  }
  throw new Error("No bounded route to the spire access tile");
}

async function exploreAndReturn(context: RoundTripContext): Promise<void> {
  const arrival = positionOf(context.explorer);
  const tiles = await readTiles(context.observer, context.gameId);
  const explore = chooseEtherealExplore(arrival, tiles);
  if (!explore) throw new Error("Spire arrival has no unexplored ethereal neighbor");
  await moveExplorer(context, "explore", explore.direction, true, explore.target);
  // Discovery can leave the explorer in place when a structure or reward occupies the new tile.
  if (!samePosition(context.explorer, arrival)) {
    await moveExplorer(context, "return", (explore.direction + 3) % 6, false, arrival);
  }
  if (!samePosition(context.explorer, arrival)) throw new Error("Explorer did not return to the spire access tile");
}

function chooseEtherealExplore(arrival: Coord, tiles: readonly Tile[]) {
  for (const direction of [0, 3]) {
    const target = { alt: true, x: arrival.x + (direction === 0 ? ETHEREAL_STRIDE : -ETHEREAL_STRIDE), y: arrival.y };
    if (target.x < 0 || target.x > 0xffffffff) continue;
    const tile = tiles.find((row) => sameTile(row, target));
    if (!tile?.biome && !tile?.occupier_id) return { direction, target };
  }
  return undefined;
}

async function toggleLayer(context: RoundTripContext, kind: "enter" | "exit", direction: number) {
  const expected = { ...positionOf(context.explorer), alt: kind === "enter" };
  await submitStep(context, kind, {
    contractAddress: context.altMovementAddress,
    entrypoint: "toggle_alternate",
    calldata: CallData.compile([context.gameId, context.explorer.explorerId, direction]),
  });
  if (!samePosition(context.explorer, expected))
    throw new Error(`${kind} changed the landing coordinates or used the wrong layer`);
}

async function moveExplorer(
  context: RoundTripContext,
  kind: StepKind,
  direction: number,
  explore: boolean,
  target: Coord,
) {
  await waitForStamina(context);
  await submitStep(context, kind, {
    contractAddress: context.troopMovementAddress,
    entrypoint: "explorer_move",
    calldata: CallData.compile([context.gameId, context.explorer.explorerId, [direction], explore]),
  });
  if (context.explorer.alt !== target.alt) throw new Error("Movement crossed layers without spire travel");
  if (explore) {
    await context.observer.waitForModelRows(
      context.gameId,
      ["TileOpt"],
      (models) => decodeTiles(models.get("TileOpt")!).some((tile) => sameTile(tile, target) && tile.biome !== 0),
      OBSERVATION_TIMEOUT_MS,
    );
    context.evidence.steps.at(-1)!.exploredTile = target;
  } else if (!samePosition(context.explorer, target)) throw new Error("Explorer movement did not reach its target");
}

async function submitStep(context: RoundTripContext, kind: StepKind, call: Call) {
  const before = context.explorer;
  const transaction = await trackTransaction({
    botId: context.bot.botId,
    gameId: context.gameId,
    provider: context.provider,
    send: () => submitCalls(context.bot.account, call),
    kind: `layer_${kind}`,
    stage: "setup",
  });
  const step: LayerRoundTripEvidence["steps"][number] = { kind, transaction };
  context.evidence.steps.push(step);
  if (transaction.outcome !== "completed" || transaction.acceptedOnL2Block === undefined) {
    throw new Error(`${kind} failed: ${transaction.error ?? transaction.outcome}`);
  }
  context.explorer = await context.observer.waitForExplorer(
    context.gameId,
    before.explorerId,
    before,
    transaction.acceptedOnL2Block,
    OBSERVATION_TIMEOUT_MS,
  );
  step.explorer = positionOf(context.explorer);
}

async function waitForStamina(context: RoundTripContext) {
  const deadline = Date.now() + 360_000;
  while (Date.now() < deadline) {
    const block = await context.provider.getBlock("latest");
    const tick = Math.floor(Number(block.timestamp) / context.stamina.tickSeconds);
    const available =
      context.explorer.stamina + Math.max(0, tick - context.explorer.staminaUpdatedTick) * context.stamina.gain;
    if (available >= context.stamina.required) return;
    await sleep(1_000);
  }
  throw new Error("Explorer did not regenerate movement stamina within six minutes");
}

const nearestSpireDistance = (coord: Coord, spires: readonly Tile[]) =>
  Math.min(...spires.map((spire) => cubeDistance(coord, { x: spire.col, y: spire.row })));
const positionOf = ({ alt, x, y }: Coord): Coord => ({ alt, x, y });
const samePosition = (a: Coord, b: Coord) => a.alt === b.alt && a.x === b.x && a.y === b.y;
const sameTile = (tile: Tile, coord: Coord) => tile.alt === coord.alt && tile.col === coord.x && tile.row === coord.y;
const decodeTiles = (rows: Record<string, unknown>[]) => rows.map((row) => tileDataToTile(row.data as string));
async function readTiles(observer: HeraldObserver, gameId: number) {
  return decodeTiles((await observer.readModelRows(gameId, ["TileOpt"])).get("TileOpt")!);
}
function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Missing ${name}`);
  return value as Record<string, unknown>;
}
function positive(value: unknown, name: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`Invalid ${name}`);
  return number;
}

function nonnegative(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") throw new Error(`Missing ${name}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid ${name}`);
  return number;
}
