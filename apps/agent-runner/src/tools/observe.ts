import {
  divideByPrecision,
  gameEntityKey,
  getAddressName,
  getBlockTimestamp,
  LeaderboardManager,
  type GameClient,
} from "@bibliothecadao/eternum";
import {
  type ArmyInfo,
  type BuildingType,
  BuildingTypeToString,
  type ClientComponents,
  type ContractAddress,
  findResourceById,
  type ID,
  type MarketInterface,
  type RealmInfo,
  ResourcesIds,
  type Structure,
  StructureType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";

import type { RunnerGame } from "../game";
import { readGameRegistry, resolveGamePhase, type GameRegistryClock } from "../game-phase";
import { clipList, clipText, textResult } from "./result";
import { StringEnum } from "./schema";

export const OBSERVE_FOCUSES = ["empire", "armies", "nearby", "market", "leaderboard", "events"] as const;
type ObserveFocus = (typeof OBSERVE_FOCUSES)[number];

/** Summaries stay under this many characters so a turn's context is spent on judgement, not on a dump. */
export const OBSERVE_TEXT_LIMIT = 2_000;
const LIST_LIMIT = 12;
/** Hexes around each own asset that count as "in reach": what `nearby` reports and what the delta gate watches. */
export const NEARBY_REACH = 3;
const STAPLE_RESOURCES = [ResourcesIds.Wheat, ResourcesIds.Fish, ResourcesIds.Labor, ResourcesIds.Essence];

const ObserveParams = Type.Object({
  focus: Type.Optional(
    StringEnum(OBSERVE_FOCUSES, "empire (default): my structures. armies, nearby, market, leaderboard, events."),
  ),
});

export const createObserveTool = (game: RunnerGame): AgentTool<typeof ObserveParams> => ({
  name: "observe_game",
  label: "Observe game",
  description:
    "A compact summary of the game from my point of view. Positions are contract hex coordinates; amounts are whole units.",
  parameters: ObserveParams,
  execute: async (_id, params) => {
    const focus = params.focus ?? "empire";
    const text = clipText([renderClock(game), renderFocus(game, focus)].join("\n"), OBSERVE_TEXT_LIMIT);
    return textResult(text, { focus, length: text.length });
  },
});

export const renderFocus = (game: RunnerGame, focus: ObserveFocus): string => {
  switch (focus) {
    case "empire":
      return renderEmpire(game);
    case "armies":
      return renderArmies(game);
    case "nearby":
      return renderNearby(game);
    case "market":
      return renderMarket(game);
    case "leaderboard":
      return renderLeaderboard(game);
    case "events":
      return renderEvents(game);
  }
};

// Clock

const renderClock = (game: RunnerGame): string => {
  const { currentBlockTimestamp, currentDefaultTick, currentArmiesTick } = getBlockTimestamp();
  const phase = describePhase(readGameRegistry(game.client), currentBlockTimestamp);
  return `Game ${game.client.gameId} "${game.listing.name}" | phase ${phase} | tick ${currentDefaultTick} (armies ${currentArmiesTick}) | chain time ${new Date(currentBlockTimestamp * 1000).toISOString()} | me ${describeViewer(game)}`;
};

const describePhase = (registry: GameRegistryClock | null, now: number): string => {
  const phase = resolveGamePhase(registry, now);
  if (phase === "registration") return `settling (main starts in ${Math.max(0, registry!.startMainAt - now)}s)`;
  if (phase === "live") return `live (${registry!.endAt - now}s left)`;
  return phase;
};

const describeViewer = (game: RunnerGame): string =>
  game.client.signer ? `${game.viewer().toString(16).slice(0, 8)}…` : "spectator (no signer)";

// Empire

const renderEmpire = (game: RunnerGame): string => {
  const viewer = game.viewer();
  const structures = game.client.views.structures(viewer);
  if (structures.length === 0) return "I own no structures in this game.";
  const realms = new Map(
    [...game.client.views.realms(viewer), ...game.client.views.villages(viewer)].map((realm) => [
      realm.entityId,
      realm,
    ]),
  );
  return clipList(
    structures.map((structure) => renderStructure(game, structure, realms.get(structure.entityId))),
    LIST_LIMIT,
  ).join("\n");
};

const renderStructure = (game: RunnerGame, structure: Structure, realm: RealmInfo | undefined): string => {
  const base = structure.structure.base;
  const head = `#${structure.entityId} ${StructureType[structure.category]} L${base.level} at (${base.coord_x},${base.coord_y})`;
  const troops = `guards ${base.troop_guard_count}/${base.troop_max_guard_count}, explorers ${base.troop_explorer_count}/${base.troop_max_explorer_count}`;
  if (!realm) return `${head}: ${troops}`;
  const produced = realm.resources.map((resource) => resourceName(resource)).join(", ") || "none";
  const balances = renderBalances(game.client, structure.entityId, [...STAPLE_RESOURCES, ...realm.resources]);
  const buildings = renderBuildings(game.client, structure.entityId);
  return `${head}: ${troops}; produces ${produced}; buildings ${buildings}; balances ${balances}`;
};

const renderBalances = (client: GameClient, entityId: ID, resources: ResourcesIds[]): string => {
  const manager = client.views.resources(entityId);
  const unique = [...new Set(resources)];
  return unique.map((resource) => `${resourceName(resource)} ${formatAmount(manager.balance(resource))}`).join(", ");
};

const renderBuildings = (client: GameClient, structureId: ID): string => {
  const counts = new Map<string, number>();
  for (const building of client.views.buildingTiles(structureId).existingBuildings()) {
    const name = BuildingTypeToString[building.category as BuildingType];
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return "none";
  return [...counts.entries()].map(([name, count]) => (count > 1 ? `${name}×${count}` : name)).join(", ");
};

// Armies

const renderArmies = (game: RunnerGame): string => {
  const armies = ownExplorers(game);
  if (armies.length === 0) return "I have no explorer armies.";
  const { currentArmiesTick } = getBlockTimestamp();
  return clipList(
    armies.map((army) => renderArmy(game.client, army, currentArmiesTick)),
    LIST_LIMIT,
  ).join("\n");
};

const ownExplorers = (game: RunnerGame): ArmyInfo[] =>
  game.client.views.structures(game.viewer()).flatMap((structure) => game.client.views.explorers(structure.entityId));

const renderArmy = (client: GameClient, army: ArmyInfo, currentArmiesTick: number): string => {
  const stamina = client.views.stamina(army.entityId).getStamina(currentArmiesTick).amount;
  const troops = `${formatAmount(army.troops.count)} ${army.troops.category} ${army.troops.tier}`;
  const home = army.isHome ? ", at home" : "";
  return `#${army.entityId} (home #${army.entity_owner_id}): ${troops}, stamina ${stamina}, at (${army.position.x},${army.position.y})${home}`;
};

// Nearby

const renderNearby = (game: RunnerGame): string => {
  const armies = ownExplorers(game);
  if (armies.length === 0) return "No explorers, so nothing is in reach.";
  return clipList(
    armies.map((army) => renderSurroundings(game, army)),
    LIST_LIMIT,
  ).join("\n");
};

const renderSurroundings = (game: RunnerGame, army: ArmyInfo): string => {
  const { projection } = game.client;
  const center = army.position;
  const bounds = {
    alt: army.explorer.coord.alt,
    minCol: center.x - NEARBY_REACH,
    maxCol: center.x + NEARBY_REACH,
    minRow: center.y - NEARBY_REACH,
    maxRow: center.y + NEARBY_REACH,
  };
  const tiles = projection.getTilesInBounds(bounds);
  const biomes = countBy(tiles, (tile) => `biome ${tile.biome}`);
  const others = projection
    .getArmiesInBounds(bounds)
    .filter((other) => other.entityId !== army.entityId)
    .map(
      (other) =>
        `army #${other.entityId} ${other.troopCategory} ${other.troopTier} at (${other.hexCoords.col},${other.hexCoords.row})`,
    );
  const structures = projection
    .getStructuresInBounds(bounds)
    .map((structure) =>
      structure.reserved
        ? `reserved site at (${structure.hexCoords.col},${structure.hexCoords.row})`
        : `structure #${structure.entityId} ${describeOwner(game, structure.entityId)} at (${structure.hexCoords.col},${structure.hexCoords.row})`,
    );
  const chests = projection
    .getChestsInBounds(bounds)
    .map((chest) => `chest #${chest.entityId} at (${chest.hexCoords.col},${chest.hexCoords.row})`);
  const explored = `${tiles.length} explored tiles within ${NEARBY_REACH} (${biomes})`;
  const around = clipList([...structures, ...others, ...chests], 6).join("; ") || "nothing else";
  return `Explorer #${army.entityId} at (${center.x},${center.y}): ${explored}; ${around}`;
};

const describeOwner = (game: RunnerGame, structureId: ID): string => {
  const { components } = game.client.setup;
  const owner = getComponentValue(components.Structure, gameEntityKey([BigInt(structureId)]))?.owner;
  if (owner === undefined) return "(unknown owner)";
  if (owner === game.viewer()) return "(mine)";
  return `(${getAddressName(owner, components) ?? "unnamed"})`;
};

// Market

const renderMarket = (game: RunnerGame): string => {
  const { currentBlockTimestamp } = getBlockTimestamp();
  const market = game.client.views.market(game.viewer(), currentBlockTimestamp);
  const section = (title: string, trades: MarketInterface[]) =>
    [`${title} (${trades.length}):`, ...clipList(trades.map(renderTrade), 5)].join("\n");
  return [
    section("My open trades", market.userTrades),
    section("Lords bids", market.bidOffers),
    section("Lords asks", market.askOffers),
  ].join("\n");
};

const renderTrade = (trade: MarketInterface): string => {
  const gives = trade.makerGets.map((r) => `${r.amount} ${resourceName(r.resourceId)}`).join("+");
  const wants = trade.takerGets.map((r) => `${r.amount} ${resourceName(r.resourceId)}`).join("+");
  return `trade #${trade.tradeId} by ${trade.makerName || trade.originName}: gives ${wants} for ${gives}, expires ${new Date(trade.expiresAt * 1000).toISOString()}`;
};

// Leaderboard

const renderLeaderboard = (game: RunnerGame): string => {
  const { components } = game.client.setup;
  const leaderboard = LeaderboardManager.instance(components);
  leaderboard.forceRefresh();
  const viewer = game.viewer();
  const ranked = leaderboard.playersByRank;
  if (ranked.length === 0) return "No points registered yet.";
  const mine = ranked.findIndex(([address]) => address === viewer);
  const rows = ranked
    .slice(0, 10)
    .map(
      ([address, points], index) =>
        `${index + 1}. ${playerName(components, address)} ${points} pts${address === viewer ? " (me)" : ""}`,
    );
  const myLine = mine >= 0 ? `My rank: ${mine + 1} of ${ranked.length}` : "I am not ranked yet.";
  return [myLine, ...rows].join("\n");
};

const playerName = (components: ClientComponents, address: ContractAddress): string =>
  getAddressName(address, components) ?? `0x${address.toString(16).slice(0, 8)}…`;

// Events

const renderEvents = (game: RunnerGame): string => {
  const events = game.recentEvents();
  if (events.length === 0) return "No story events since this session started.";
  return clipList(
    events
      .slice()
      .reverse()
      .map((event) => `${new Date(event.at).toISOString()} ${event.models.join(",")}: ${event.summary}`),
    LIST_LIMIT,
  ).join("\n");
};

// Formatting

const resourceName = (resource: ResourcesIds): string => findResourceById(resource)?.trait ?? `resource ${resource}`;

const formatAmount = (precisionScaled: bigint | number): string =>
  Math.floor(divideByPrecision(Number(precisionScaled))).toString();

const countBy = <T>(items: readonly T[], key: (item: T) => string): string => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => `${name}×${count}`).join(", ") || "none";
};
