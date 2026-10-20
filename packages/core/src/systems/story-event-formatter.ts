import {
  frontierSiteName,
  StructureType,
  fightVerdict,
  VERDICT_WORDS,
  buildingName,
  formatCharge,
  formatClockTime,
  formatDuration,
  formatExact,
  formatPoints,
  GuardSlot,
  guardSlotName,
  LORDS,
  RESOURCE_PRECISION,
  RealmLevels,
  rankName,
  relicChestDelivery,
  relicEffect,
  relicName,
  resourceName,
  type ResourcesIds,
  wholePoints,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { displayPlayerName, getStructureName, siteDisplayName, type PlayerNameResolver } from "../utils/entities";
import { readExpeditionRules } from "../utils/expeditions";
import { readFrontierBeast } from "../utils/frontier-beast";
import { Position } from "./position";
import { getGameMode } from "../utils/utils";
import { StoryEventSystemUpdate } from "./types";
import { configManager } from "../managers/config-manager";
import { feltEquals } from "../client/herald-http";
import { divideByPrecision } from "../utils/utils";
import { deliveryLandsAt } from "../utils/resource-arrivals";
import type { NativeStoryVariant } from "../../../../contracts/l3/world-native/schema/client.gen";

type StoryEventIcon =
  | "realm"
  | "building"
  | "production"
  | "battle"
  | "resource"
  | "troop"
  | "prize"
  | "travel"
  | "alert"
  | "scroll";

export interface StoryEventPresentation {
  title: string;
  description?: string;
  icon: StoryEventIcon;
  owner?: string | null;
}

/** What a capture takes with the structure: what the structure owns (its armies, the deliveries bound for it) is the captor's. */
export const CAPTURE_AFTERMATH = "Its armies and incoming deliveries went with it";

type StoryFormatter = (
  event: StoryEventSystemUpdate,
  payload: Record<string, unknown>,
  components?: NativeFactStore,
  resolvePlayerName?: PlayerNameResolver,
) => StoryEventPresentation;

const ATTRIBUTE_TIER_LABELS = ["", "common", "uncommon", "rare", "epic", "legendary"];
/** What a story model other than StoryEvent's own variants reaches the feed as. */
type StoryEventModel = "BattleEvent" | "RaidEvent";

/**
 * One presentation for every story the chain can tell: each generated Story variant and each story model. A new
 * variant is a type error here until it has its line, so no story ever reaches the feed as raw fields.
 */
const formatters: Record<NativeStoryVariant | StoryEventModel, StoryFormatter> = {
  ExplorationReward: (_event, payload, components) => ({
    title: findLine(discoveryName(payload, components) ?? "Explored", payload),
    description: joinPieces([describeExplorer(payload.explorer_id, components), "Reveal"]),
    icon: "resource",
  }),
  SpireDiscovered: (_event, payload, components) => ({
    title: findLine("Dormant spire found", payload),
    description: joinPieces([describeExplorer(payload.explorer_id, components), "Reveal"]),
    icon: "prize",
  }),
  RelicChestOpened: (_event, payload, components) => ({
    title: withPoints(describeRelicChestOpening(payload, components), payload.points),
    description: chestRelics(payload)
      .map((relic) => resourceName(relic))
      .join(", "),
    icon: "prize",
  }),
  RewardChestOpened: (_event, payload, components) => ({
    title: describeRewardChestOpening(payload, components),
    description: describeExplorer(payload.explorer_id, components),
    icon: "prize",
  }),
  RelicCrafted: (_event, payload) => ({
    title: "Relic crafted",
    description: resourceName(Number(payload.value)),
    icon: "prize",
  }),
  RelicActivated: (event, payload, components, resolvePlayerName) => {
    const relicId = Number(payload.relic_id) as ResourcesIds;
    const recipient = formatEnum(payload.recipient);
    const target =
      recipient === "Explorer"
        ? describeExplorer(event.entityId, components)
        : `${subjectOf(event.entityId, components)}${recipient === "StructureGuard" ? "'s guards" : ""}`;
    const effect = relicEffect(relicId, { rateBps: Number(payload.rate_bps), radius: Number(payload.radius) });
    const duration = Number(payload.duration_seconds);
    const stamina = relicId === 39 || relicId === 40;
    const applied =
      duration > 0 ? `${effect} for ${formatDuration(duration)}${stamina ? " of regeneration" : ""}` : effect;
    const actor = nameOwner(event.ownerAddress, components, resolvePlayerName) ?? "Someone";
    return {
      title: `${actor} activated ${relicName(relicId)} on ${target} · ${applied}`,
      icon: "prize",
    };
  },
  // Who took what from whom; from a player, what went with it; from a guard, the points it paid.
  StructureCapturedStory: (event, payload, components, resolvePlayerName) => ({
    title: withPoints(
      [
        `${nameOwner(payload.new_owner, components, resolvePlayerName) ?? "Someone"} took ${subjectOf(event.entityId, components)} from ${
          isViewer(payload.previous_owner, event.viewerAddress)
            ? "you"
            : (nameFightParticipant(payload.previous_owner, event.entityId, components, resolvePlayerName) ??
              "its holder")
        }`,
        toBigIntSafe(payload.previous_owner) ? CAPTURE_AFTERMATH : null,
      ]
        .filter(Boolean)
        .join(". "),
      payload.points,
    ),
    icon: "battle",
  }),
  TradeCreated: (_event, payload) => {
    const order = payload.order as Record<string, unknown>;
    return {
      title: "Trade listed",
      description: `${resourceName(Number(order.offered_resource))} for ${resourceName(Number(order.requested_resource))}`,
      icon: "resource",
    };
  },
  TradeAccepted: (_event, payload) => ({
    title: "Trade filled",
    description: `${formatResourceAmount(payload.offered_amount) ?? "—"} ${resourceName(Number(payload.offered_resource))} for ${formatResourceAmount(payload.requested_amount) ?? "—"} ${resourceName(Number(payload.requested_resource))}`,
    icon: "resource",
  }),
  TradeCancelled: (_event, payload) => ({
    title: "Trade cancelled",
    description: `Trade ${formatNumber(payload.value) ?? "—"}`,
    icon: "resource",
  }),
  BankSwap: (_event, payload) => ({
    title: payload.buy ? "Bought at the bank" : "Sold at the bank",
    description: `${formatResourceAmount(payload.resource_amount) ?? "—"} ${resourceName(Number(payload.resource_type))} for ${formatResourceAmount(payload.lords_amount) ?? "—"} ${LORDS}`,
    icon: "resource",
  }),
  HyperstructurePoints: (_event, payload, components, resolvePlayerName) => ({
    title: "Hyperstructure points",
    description: `${nameOwner(payload.player, components, resolvePlayerName) ?? "—"} +${formatNumber(payload.points) ?? "—"}`,
    icon: "prize",
  }),
  BitcoinAwardStory: (_event, payload, components, resolvePlayerName) => ({
    title: "Bitcoin mine paid",
    description: joinPieces([
      `${nameOwner(payload.winner, components, resolvePlayerName) ?? "—"} +${formatResourceAmount(payload.winner_paid) ?? "—"}`,
      `${nameOwner(payload.owner, components, resolvePlayerName) ?? "—"} +${formatResourceAmount(payload.owner_paid) ?? "—"}`,
    ]),
    icon: "prize",
  }),
  FaithPointsClaimedStory: (_event, payload, components) => ({
    title: "Faith points claimed",
    description: joinPieces([
      describeStructureName(payload.wonder_id, components),
      `+${formatNumber(payload.new_points) ?? "—"} (${formatNumber(payload.total_points) ?? "—"} in all)`,
    ]),
    icon: "prize",
  }),
  FaithPledged: (_event, payload, components) => ({
    title: "Faith pledged",
    description: `${describeStructureName(payload.structure_id, components) ?? "—"} → ${describeStructureName(payload.wonder_id, components) ?? "—"}`,
    icon: "realm",
  }),
  FaithRemoved: (_event, payload, components) => ({
    title: "Faith withdrawn",
    description: `${describeStructureName(payload.structure_id, components) ?? "—"} from ${describeStructureName(payload.wonder_id, components) ?? "—"}`,
    icon: "realm",
  }),
  SeasonEnded: (_event, payload, components, resolvePlayerName) => ({
    title: "Season ended",
    description: nameOwner(payload.value, components, resolvePlayerName),
    icon: "scroll",
  }),
  BlitzFinalized: () => ({ title: "Blitz finalized", icon: "scroll" }),
  SitePayout: (_event, payload, components) => {
    const category = toNumber(payload.category);
    if (category === null || payload.reward === undefined) throw new Error("Incomplete site payout story");
    const label = frontierSiteName(category);
    const reward = payload.reward === null ? "XP only" : formatResourceList([payload.reward]);
    if (!reward) throw new Error("Incomplete site resource reward");
    const siteId = toNumber(payload.site_id);
    if (siteId === null) throw new Error("Site payout story names no site");
    // The site's Structure goes with its clear; its id names it, as the receipt and the map do.
    return {
      title: `${siteDisplayName(siteId)} cleared`,
      description: joinPieces([label, describeExplorer(payload.explorer_id, components), reward]),
      icon: "prize",
    };
  },
  TierBought: (_event, payload, components) => {
    const attribute = formatEnum(payload.attribute);
    const tierIndex = toNumber(payload.tier);
    const tier = tierIndex === null ? undefined : ATTRIBUTE_TIER_LABELS[tierIndex];
    const price = toNumber(payload.price);
    if (!attribute || !tier || price === null) throw new Error("Incomplete tier purchase story");
    return {
      title: `${attribute} ${tier}`,
      description: joinPieces([describeExplorer(payload.explorer_id, components), `${price} XP`]),
      icon: "scroll",
    };
  },
  LordsWithdrawn: (_event, payload) => {
    const amount = toNumber(payload.amount);
    if (amount === null) throw new Error("Incomplete LORDS withdrawal story");
    return { title: "LORDS withdrawn", description: `${formatCharge(amount)} LORDS to L2`, icon: "prize" };
  },
  RealmCreatedStory: (event, payload, components, resolvePlayerName) => {
    const coord =
      components && readExpeditionRules(components, configManager.getActiveGameId())
        ? undefined
        : formatCoord(payload.coord);
    const ownerLabel = nameOwner(event.ownerAddress, components, resolvePlayerName);
    return {
      title: `${describeStructureName(event.entityId, components) ?? "A realm"} founded`,
      description: joinPieces([ownerLabel ? `Settled by ${ownerLabel}` : undefined, coord ? `at ${coord}` : undefined]),
      icon: "realm",
    };
  },
  BuildingPlacementStory: (event, payload, components) => ({
    title: `${formatBuildingCategory(payload.category, components) ?? "Building"} ${describeBuildingStatus(payload)} at ${subjectOf(event.entityId, components)}`,
    icon: "building",
  }),
  // Paid in the same transaction as the building it pays for: the same action, told by the same title.
  BuildingPaymentStory: (event, payload, components) => {
    const cost = formatResourceList(payload.cost);
    return {
      title: `${formatBuildingCategory(payload.category, components) ?? "Building"} built at ${subjectOf(event.entityId, components)}`,
      description: cost ? `Paid ${cost}` : undefined,
      icon: "building",
    };
  },
  ProductionStory: (event, payload, components) => {
    const receivedId = toNumber(payload.received_resource_type);
    const amount = formatResourceAmount(payload.received_amount);
    const cost = formatResourceList(payload.cost);
    const made = receivedId !== null ? resourceName(receivedId) : "Resource";
    return {
      title: `${made} production started at ${subjectOf(event.entityId, components)}`,
      description: joinPieces([amount ? `${amount} ${made}` : undefined, cost ? `for ${cost}` : undefined]),
      icon: "production",
    };
  },
  StructureLevelUpStory: (event, payload, components) => {
    const level = toNumber(payload.new_level);
    return {
      title: `${subjectOf(event.entityId, components)} became ${level !== null ? describeLevel(level) : "stronger"}`,
      icon: "building",
    };
  },
  BattleEvent: (event, payload, store, resolvePlayerName) => {
    const attacker = payload.attacker as Record<string, unknown>;
    const defender = payload.defender as Record<string, unknown>;
    const frontier = store && readExpeditionRules(store, configManager.getActiveGameId()) !== null;
    const attackerName = nameFightParticipant(attacker.player, payload.attacker_id, store, resolvePlayerName);
    const defenderName = nameFightParticipant(defender.player, payload.defender_id, store, resolvePlayerName);
    const outcome = frontier
      ? VERDICT_WORDS[fightVerdict({ army: BigInt(String(attacker.after)), guard: BigInt(String(defender.after)) })]
      : battleOutcome(
          { name: attackerName, standing: BigInt(String(attacker.after)) > 0n },
          { name: defenderName, standing: BigInt(String(defender.after)) > 0n },
        );
    // A beast guarding an ownerless Frontier site fights under the name the title gives it ("Troll"), never the troop
    // row the chain keeps for it.
    const forces = (value: Record<string, unknown>, name: string | undefined) =>
      (frontier && toBigIntSafe(value.player) === 0n ? name : undefined) ??
      formatTroopDescriptor(value.category, value.tier);
    const side = (label: string, value: Record<string, unknown>, name: string | undefined) => [
      `${label} forces: ${forces(value, name)} [ ${formatUnitAmount(value.before)} ]`,
      `${label} losses: ${formatResourceAmount(BigInt(String(value.before)) - BigInt(String(value.after)))}`,
      `${label} Troops Left: ${formatResourceAmount(value.after)}`,
      Number(value.roll) > 0 ? `${label} d20: ${Number(value.roll)} (+${Number(value.roll)}% damage)` : undefined,
    ];
    const sides = `${attackerName ?? "Attacker"} vs ${defenderName ?? "Defender"}`;
    // The viewer's own loss leads: who won is then plain, and the army it cost is what they need to read.
    const lost = frontier ? null : lostArmyLine(payload, event.viewerAddress ?? null);
    return {
      title: lost ? `${lost} · ${sides}` : `${sides} · ${outcome}`,
      description: joinPieces([
        `Attacker [${attackerName}]: ${describeEntity(payload.attacker_id, store) ?? "Army"}`,
        `Defender [${defenderName}]: ${describeEntity(payload.defender_id, store) ?? "Army"}`,
        ...side("Attacker", attacker, attackerName),
        ...side("Defender", defender, defenderName),
        `Outcome: ${outcome}`,
      ]),
      icon: "battle",
    };
  },
  RaidEvent: (_, payload, components) => ({
    title: `Raid on ${subjectOf(payload.structure_id, components)} ${payload.success ? "succeeded" : "repelled"}`,
    description: payload.success ? formatResourceList(payload.requested_loot) : "Nothing taken",
    icon: "battle",
  }),
  BankLiquidity: (_, payload) => ({
    title: payload.add ? "Liquidity added" : "Liquidity withdrawn",
    description: `${resourceName(Number(payload.resource_type))} / Lords`,
    icon: "resource",
  }),
  // Either end may be a structure or an army; one no longer in the store is left unsaid rather than guessed.
  ResourceTransferStory: (event, payload, components) => {
    const destination = describeEntity(payload.to_entity_id, components);
    const source = describeEntity(payload.from_entity_id, components);
    const minted = payload.is_mint === true;
    return {
      title: minted
        ? `Resources minted${destination ? ` at ${destination}` : ""}`
        : `Resources sent${destination ? ` to ${destination}` : ""}`,
      description: joinPieces([
        source && !minted ? `from ${source}` : undefined,
        formatResourceList(payload.resources),
        formatLanding(event.timestamp, payload.travel_time),
      ]),
      icon: "resource",
    };
  },
  ResourceBurnStory: (event, payload, components) => ({
    title: `Resources spent at ${subjectOf(event.entityId, components)}`,
    description: formatResourceList(payload.resources),
    icon: "resource",
  }),
  ResourceReceiveArrivalStory: (event, payload, components) => ({
    title: `${formatResourceList(payload.resources) ?? "Resources"} arrived at ${subjectOf(event.entityId, components)}`,
    icon: "resource",
  }),
  GuardAddStory: (event, payload, components) => ({
    title: `${subjectOf(payload.structure_id ?? event.entityId, components)}'s ${formatSlotLabel(payload.slot) ?? "guard"} reinforced`,
    description: describeTroops(payload, "+"),
    icon: "troop",
  }),
  GuardDeleteStory: (event, payload, components) => ({
    title: `${subjectOf(payload.structure_id ?? event.entityId, components)}'s ${formatSlotLabel(payload.slot) ?? "guard"} dismissed`,
    icon: "troop",
  }),
  ExplorerCreateStory: (event, payload, components) => ({
    title: `Army raised at ${subjectOf(payload.structure_id ?? event.entityId, components)}`,
    description: describeTroops(payload, ""),
    icon: "troop",
  }),
  ExplorerAddStory: (_, payload, components) => ({
    title: `${describeExplorer(payload.explorer_id, components)} reinforced`,
    description: describeTroops(payload, "+"),
    icon: "troop",
  }),
  ExplorerDeleteStory: (_, payload, components) => ({
    title: `${describeExplorer(payload.explorer_id, components)} disbanded`,
    icon: "troop",
  }),
  TroopsTransferred: (event, payload, components) => ({
    title: `Troops moved: ${describeArmy(payload.source, event, components)} → ${describeArmy(payload.target, event, components)}`,
    description: troopCount(payload.amount),
    icon: "troop",
  }),
};

/** Whether a story has its line; one that does not (a variant retired from the enum) is never presented raw. */
export const hasStoryPresentation = (storyType: string): boolean => Object.hasOwn(formatters, storyType);

export function buildStoryEventPresentation(
  event: StoryEventSystemUpdate,
  components?: NativeFactStore,
  resolvePlayerName?: PlayerNameResolver,
): StoryEventPresentation {
  if (!hasStoryPresentation(event.storyType)) throw new Error(`No presentation for story ${event.storyType}`);
  const formatter = formatters[event.storyType as keyof typeof formatters];
  const base = formatter(event, event.storyPayload ?? {}, components, resolvePlayerName);

  return {
    ...base,
    owner: nameOwner(event.ownerAddress, components, resolvePlayerName) ?? null,
  };
}

/** A building's name as its game names it (buildingName): a Frontier story says "Barracks" where Blitz says "Knight T1". */
function formatBuildingCategory(value: unknown, store: NativeFactStore | undefined): string | undefined {
  const numeric = toNumber(value);
  if (numeric === null) {
    const label = formatEnum(value);
    return label ?? undefined;
  }
  const frontier = store !== undefined && readExpeditionRules(store, configManager.getActiveGameId()) !== null;
  return buildingName(numeric, frontier);
}

/** What each change a placement story carries (the contract's BuildingChange) reads as. */
const BUILDING_STATUS: Record<string, "built" | "demolished" | "paused" | "resumed"> = {
  Created: "built",
  Destroyed: "demolished",
  Paused: "paused",
  Resumed: "resumed",
};

/**
 * What a story is about, a structure or an army, as `describeEntity` names it; "a structure" once the store no longer
 * holds it (every caller passes a structure's id). Never an id.
 */
function subjectOf(structureId: unknown, components?: NativeFactStore): string {
  return describeEntity(structureId, components) ?? "a structure";
}

/** A realm's level by its name ("a City"); a level past the realm ladder by its number. */
function describeLevel(level: number): string {
  return level in RealmLevels ? `a ${rankName(level)}` : `level ${formatExact(level)}`;
}

/** Troops a story moved, as a player reads them: "+500 Knight T1". */
function describeTroops(payload: Record<string, unknown>, sign: "+" | ""): string | undefined {
  const amount = formatResourceAmount(payload.amount) ?? formatNumber(payload.amount ?? null) ?? undefined;
  const troops = [formatEnum(payload.category), formatEnum(payload.tier)].filter(Boolean).join(" ");
  return amount ? `${sign}${amount}${troops ? ` ${troops}` : ""}` : troops || undefined;
}

function describeBuildingStatus(payload: Record<string, unknown>) {
  const status = BUILDING_STATUS[formatEnum(payload.change) ?? ""];
  if (!status) throw new Error("Incomplete building placement story");
  return status;
}

function describeArmy(value: unknown, event: StoryEventSystemUpdate, components?: NativeFactStore): string {
  if (!value || typeof value !== "object") throw new Error("Missing troop transfer participant");
  const army = value as Record<string, unknown>;
  if (army.Explorer !== undefined) return describeExplorer(army.Explorer, components);
  if (!army.Guard || typeof army.Guard !== "object") throw new Error("Unknown troop transfer participant");
  const guard = army.Guard as Record<string, unknown>;
  return `${subjectOf(guard.structure_id ?? event.entityId, components)}'s ${formatSlotLabel(guard.slot) ?? "guard"}`;
}

type StructureRow = NonNullable<ReturnType<typeof readStructure>>;

function readStructure(structureId: unknown, components?: NativeFactStore) {
  const entityId = toBigIntSafe(structureId);
  if (!components || entityId === null) return undefined;
  try {
    return components.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: BigInt(entityId) });
  } catch {
    return undefined;
  }
}

function readExplorer(explorerId: unknown, components?: NativeFactStore) {
  const entityId = toBigIntSafe(explorerId);
  if (!components || entityId === null) return undefined;
  try {
    return components.get("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: BigInt(entityId),
    });
  } catch {
    return undefined;
  }
}

/** The structure's name alone, undefined when native store has no row: a story never prints a raw entity id. */
function describeStructureName(structureId: unknown, components?: NativeFactStore): string | undefined {
  const structure = readStructure(structureId, components);
  return structure && components ? structureDisplayName(components, structure) : undefined;
}

function structureDisplayName(components: NativeFactStore, structure: StructureRow): string {
  return getStructureName(structure, getGameMode()).name;
}

/**
 * The explorer as a player reads it: its home structure's name and its tier ("Stormhold T2 army"). A retired
 * explorer has no row, so the home structure from the payload stands in; with nothing to read it is "Army".
 */
function describeExplorer(explorerId: unknown, components?: NativeFactStore, homeStructureId?: unknown): string {
  const name = describeArmyName(explorerId, components, homeStructureId);
  if (name) return `${name} army`;
  const home = describeStructureName(readExplorer(explorerId, components)?.owner ?? homeStructureId, components);
  return home ? `${home} army` : "Army";
}

/** An army's name, its home and tier ("Stolsli T1"); null without both. */
function describeArmyName(explorerId: unknown, components?: NativeFactStore, homeStructureId?: unknown): string | null {
  const explorer = readExplorer(explorerId, components);
  const home = describeStructureName(explorer?.owner ?? homeStructureId, components);
  const tier = formatEnum(explorer?.troops?.tier);
  return home && tier ? `${home} ${tier}` : null;
}

const chestRelics = (payload: Record<string, unknown>): ResourcesIds[] => {
  if (!Array.isArray(payload.relics)) throw new Error("Incomplete relic chest story");
  return payload.relics.map((relic) => Number(relic) as ResourcesIds);
};

/**
 * An opened chest as a player reads it: where its relics went ("Crate opened: 3 relics to Stolsli"). The home is the
 * opening army's; once that army is gone its row no longer names it.
 */
export function describeRelicChestOpening(payload: Record<string, unknown>, components?: NativeFactStore): string {
  const explorer = readExplorer(payload.explorer_id, components);
  const home = describeStructureName(explorer?.owner, components);
  const delivery = relicChestDelivery(chestRelics(payload), {
    army: explorer && home ? describeArmyName(payload.explorer_id, components) : null,
    home: home ?? "its realm",
  });
  return `Crate opened: ${delivery}`;
}

export function describeRewardChestOpening(payload: Record<string, unknown>, components?: NativeFactStore): string {
  const amount = BigInt(payload.amount as string | number | bigint);
  if (amount === 0n) return "Chest expired: no LORDS paid";
  const home = describeStructureName(payload.structure_id, components) ?? "its realm";
  return `Chest opened: ${formatExact(amount)} LORDS to ${home}`;
}

/** A structure by name, else an explorer by home and tier, else nothing. */
function describeEntity(entityId: unknown, components?: NativeFactStore): string | undefined {
  const structureName = describeStructureName(entityId, components);
  if (structureName) return structureName;
  return readExplorer(entityId, components) ? describeExplorer(entityId, components) : undefined;
}

function formatResourceList(value: unknown): string | undefined {
  const entries = normalizeResourceEntries(value);
  if (!entries.length) return undefined;
  return entries
    .map(({ id, amount }) => {
      const formatted = formatResourceAmount(amount);
      return formatted ? `${resourceName(id)} ×${formatted}` : resourceName(id);
    })
    .join(", ");
}

function normalizeResourceEntries(value: unknown): Array<{ id: number; amount: unknown }> {
  if (!value) return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === "object" && value && "values" in value
      ? (value as { values: unknown }).values
      : [];

  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        const [id, amount] = entry;
        const numericId = toNumber(id);
        return numericId === null ? null : { id: numericId, amount };
      }
      if (typeof entry === "object" && entry !== null) {
        const objectEntry = entry as Record<string, unknown>;
        const id = toNumber(objectEntry.resource_type ?? objectEntry.resource ?? objectEntry["0"]);
        const amount = objectEntry.amount ?? objectEntry["1"];
        return id === null ? null : { id, amount };
      }
      return null;
    })
    .filter((value): value is { id: number; amount: unknown } => value !== null);
}

function formatTroopDescriptor(type: unknown, tier: unknown): string | undefined {
  const typeLabel = formatEnum(type);
  const tierLabel = formatEnum(tier);
  if (typeLabel && tierLabel) return `${tierLabel} ${typeLabel}`;
  return typeLabel ?? tierLabel ?? undefined;
}

function formatUnitAmount(value: unknown): string | undefined {
  const formatted = formatResourceAmount(value);
  if (formatted) return formatted;
  const fallback = formatNumber(value);
  return fallback ?? undefined;
}

function formatEnum(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1) {
      return entries[0][0];
    }
  }
  return undefined;
}

/** Contract coordinates read as the map's normalized coordinates, the ones every tile panel shows. */
function formatCoord(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const coord = value as Record<string, unknown>;
  const x = toNumber(coord.x);
  const y = toNumber(coord.y);
  if (x === null || y === null) return undefined;
  const normalized = Position.fromContract({ x, y }).getNormalized();
  return `(${normalized.x}, ${normalized.y})`;
}

function formatNumber(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatCharge(value);
  }
  if (typeof value === "bigint") {
    return formatCharge(Number(value));
  }
  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      try {
        return BigInt(value).toString();
      } catch (error) {
        return value;
      }
    }
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return formatCharge(numeric);
    }
    try {
      return BigInt(value).toString();
    } catch (error) {
      return value;
    }
  }
  return `${value}`;
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      try {
        return Number(BigInt(value));
      } catch (error) {
        return null;
      }
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  return null;
}

function amountToBigInt(value: unknown): bigint | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    try {
      return value.startsWith("0x") ? BigInt(value) : BigInt(value);
    } catch (error) {
      return null;
    }
  }
  return null;
}

/** An amount at contract precision as the chain moved it, to its last unit: a charge ("1,000", "0.001"). */
function formatAmountWithPrecision(amount: unknown, precision: number): string {
  const bigIntAmount = amountToBigInt(amount);
  if (bigIntAmount === null) return "0";
  const divisor = BigInt(precision);
  return formatCharge(Number(bigIntAmount / divisor) + Number(bigIntAmount % divisor) / precision);
}

function joinPieces(parts: Array<string | undefined>): string | undefined {
  const filtered = parts.filter((part): part is string => Boolean(part));
  return filtered.length ? filtered.join(" · ") : undefined;
}

function toBigIntSafe(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    try {
      return BigInt(Math.trunc(value));
    } catch (error) {
      return null;
    }
  }
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch (error) {
      return null;
    }
  }
  return null;
}

/** Whether an address is the player the story is told to. */
function isViewer(address: unknown, viewerAddress: string | null): boolean {
  const player = toBigIntSafe(address);
  return player !== null && player !== 0n && viewerAddress !== null && player === BigInt(viewerAddress);
}

/** A number of troops, one troop or many ("1 troop", "1,000 troops"). */
function troopCount(amount: unknown): string {
  const count = formatResourceAmount(amount);
  if (count === undefined) return "Some troops";
  return `${count} ${count === "1" ? "troop" : "troops"}`;
}

function formatResourceAmount(amount: unknown): string | undefined {
  const bigIntAmount = amountToBigInt(amount);
  if (bigIntAmount === null) return undefined;
  return formatAmountWithPrecision(bigIntAmount, RESOURCE_PRECISION);
}

function formatSlotLabel(value: unknown): string | undefined {
  const numeric = toNumber(value);
  const label = formatEnum(value);
  const slot = numeric ?? (label ? GuardSlot[label as keyof typeof GuardSlot] : undefined);
  if (slot === undefined) return undefined;
  if (!(slot in GuardSlot)) throw new Error(`Invalid guard slot: ${String(value)}`);
  const name = guardSlotName(slot as GuardSlot);
  return name;
}

/**
 * When a delivery's goods land, by the rule the chain lands them (deliveryLandsAt): at the end of the delivery tick
 * its road ends in, not when the road ends. A story is history, so it says the clock time. An instant transfer has no
 * road and nothing to say.
 */
function formatLanding(sentAtMs: number, travelSeconds: unknown): string | undefined {
  const road = toNumber(travelSeconds);
  if (road === null || road === 0) return undefined;
  return `lands at ${formatClockTime(deliveryLandsAt(Math.floor(sentAtMs / 1000), road))}`;
}

/**
 * A fight's outcome as every surface shows it, whole, decided as the contract decides its winner (combat.cairo's
 * `battle_winner` and its guard branch): the side left standing when the other has no troops wins; both standing is
 * a draw; neither is both falling. The event's `winner_id` is not read: it records the winner as a home structure, a
 * guarded structure or an attacking structure depending on who attacked whom.
 */
/** A line and the points it scored, when it scored any: "… · +250 points". Story points are at contract precision. */
const withPoints = (line: string, points: unknown): string => {
  const whole = points === undefined || points === null ? 0 : wholePoints(BigInt(String(points)));
  return whole > 0 ? `${line} · +${formatPoints(whole)}` : line;
};

/**
 * A find as the feed tells it: what was done and what it gave, "Explored: +100 Labor". Not where (the map shows it), nor
 * an explore's points, a grant that never changes (the voice rule "A find says what it gave").
 */
const findLine = (found: string, payload: Record<string, unknown>): string =>
  `${found}: +${formatResourceAmount(payload.amount) ?? "—"} ${resourceName(Number(payload.resource_type))}`;

const TROOP_PLURALS: Record<string, string> = { Knight: "Knights", Paladin: "Paladins", Crossbowman: "Crossbowmen" };

/** The viewer's side of a fight, when it fell: "Army lost: 1,000 Knights". Null when it stood, or is not theirs. */
export const lostArmyLine = (payload: Record<string, unknown>, viewer: string | null): string | null => {
  const side = [payload.attacker, payload.defender].find(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && feltEquals((entry as Record<string, unknown>).player, viewer),
  );
  if (!side || BigInt(String(side.after ?? 1)) !== 0n) return null;
  const troops = formatExact(divideByPrecision(Number(side.before ?? 0)));
  return `Army lost: ${troops} ${TROOP_PLURALS[String(side.category ?? "")] ?? "troops"}`;
};

function battleOutcome(attacker: { name?: string; standing: boolean }, defender: { name?: string; standing: boolean }) {
  if (attacker.standing && !defender.standing) return `${attacker.name ?? "Attacker"} wins`;
  if (defender.standing && !attacker.standing) return `${defender.name ?? "Defender"} wins`;
  return attacker.standing ? "Draw" : "Both sides fall";
}

/**
 * The one way a story names an owner: the ownerless address reads as Neutral, an address goes to the client's
 * resolver, then the chain name (the registration fallback reads as none), then the shortened address; anything
 * else is a structure id and reads by its name.
 */
function nameOwner(
  owner: unknown,
  components?: NativeFactStore,
  resolvePlayerName?: PlayerNameResolver,
): string | undefined {
  if (owner === undefined || owner === null) return undefined;
  if (typeof owner === "string" && owner.startsWith("0x")) return displayPlayerName(owner, resolvePlayerName?.(owner));
  return components ? (describeStructureName(owner, components) ?? undefined) : undefined;
}

/** Encounter identity survives cleared guards and removed occupancy. */
function fightBeast(entityId: unknown, store?: NativeFactStore) {
  const id = toNumber(entityId);
  return store && id !== null ? readFrontierBeast(store, configManager.getActiveGameId(), id) : undefined;
}

/** Battles and captures name the recorded owner, or the beast guarding an ownerless Frontier site. */
function nameFightParticipant(
  owner: unknown,
  entityId: unknown,
  store?: NativeFactStore,
  resolvePlayerName?: PlayerNameResolver,
): string | undefined {
  if (toBigIntSafe(owner) === 0n && store && readExpeditionRules(store, configManager.getActiveGameId()))
    return fightBeast(entityId, store)?.name ?? "Beast guard";
  return nameOwner(owner, store, resolvePlayerName);
}

/** The revealed tile's retained site, not an army's later position or a guess from the reward. */
function discoveryName(payload: Record<string, unknown>, store?: NativeFactStore): string | undefined {
  if (!store || !payload.coord || typeof payload.coord !== "object") return undefined;
  const coord = payload.coord as Record<string, unknown>;
  const site = [...store.inGame("ExpeditionSite", configManager.getActiveGameId())].find(
    (site) => site.col === toNumber(coord.x) && site.row === toNumber(coord.y) && site.alt === coord.alt,
  );
  if (!site) return undefined;
  const beast = fightBeast(site.entity_id, store);
  const label = frontierSiteName(site.category, beast);
  const named =
    beast && (site.category === StructureType.Rift || site.category === StructureType.Ruin)
      ? `${beast.name} ${label}`
      : label;
  return `${named} found`;
}
