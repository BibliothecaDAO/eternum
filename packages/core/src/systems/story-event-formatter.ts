import { BuildingType, BuildingTypeToString, GuardSlot, RESOURCE_PRECISION, resources } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { getStructureName, type PlayerNameResolver } from "../utils/entities";
import { structureMapPosition } from "../utils/expeditions";
import { Position } from "./position";
import { getIsBlitz } from "../utils/utils";
import { StoryEventSystemUpdate } from "./types";
import { configManager } from "../managers/config-manager";
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

type StoryFormatter = (
  event: StoryEventSystemUpdate,
  payload: Record<string, unknown>,
  components?: NativeFactStore,
  resolvePlayerName?: PlayerNameResolver,
) => StoryEventPresentation;

const resourceNameMap = resources.reduce<Record<number, string>>((acc, resource) => {
  acc[resource.id] = resource.trait;
  return acc;
}, {});

const CHEST_QUALITY_LABELS = ["Common", "Uncommon", "Rare", "Epic"];
const CHEST_KIND_LABELS: Record<string, string> = { Relic: "relic", Token: "token claim" };
const EXPEDITION_GROUND_LABELS = ["the surface", "Ethereal I", "Ethereal II", "Ethereal III"];

/** What a story model other than StoryEvent's own variants reaches the feed as. */
type StoryEventModel = "BattleEvent" | "RaidEvent";

/**
 * One presentation for every story the chain can tell: each generated Story variant and each story model. A new
 * variant is a type error here until it has its line, so no story ever reaches the feed as raw fields.
 */
const formatters: Record<NativeStoryVariant | StoryEventModel, StoryFormatter> = {
  ExplorationReward: (_event, payload, components) => ({
    title: `+${formatResourceAmount(payload.amount) ?? "—"} ${getResourceName(Number(payload.resource_type))}`,
    description: joinPieces([describeExplorer(payload.explorer_id, components), "Reveal"]),
    icon: "resource",
  }),
  RelicChestOpened: (_event, payload, components) => ({
    title: "Relic crate opened",
    description: joinPieces([
      describeExplorer(payload.explorer_id, components),
      Array.isArray(payload.relics)
        ? payload.relics.map((relic) => getResourceName(Number(relic))).join(", ")
        : undefined,
    ]),
    icon: "prize",
  }),
  RelicCrafted: (_event, payload) => ({
    title: "Relic crafted",
    description: getResourceName(Number(payload.value)),
    icon: "prize",
  }),
  StructureCapturedStory: (event, payload, components, resolvePlayerName) => ({
    title: "Structure captured",
    description: joinPieces([
      describeEntity(event.entityId, components),
      `${nameOwner(payload.previous_owner, components, resolvePlayerName) ?? "—"} → ${nameOwner(payload.new_owner, components, resolvePlayerName) ?? "—"}`,
    ]),
    icon: "battle",
  }),
  TradeCreated: (_event, payload) => {
    const order = payload.order as Record<string, unknown>;
    return {
      title: "Trade listed",
      description: `${getResourceName(Number(order.offered_resource))} for ${getResourceName(Number(order.requested_resource))}`,
      icon: "resource",
    };
  },
  TradeAccepted: (_event, payload) => ({
    title: "Trade filled",
    description: `${formatResourceAmount(payload.offered_amount) ?? "—"} ${getResourceName(Number(payload.offered_resource))} for ${formatResourceAmount(payload.requested_amount) ?? "—"} ${getResourceName(Number(payload.requested_resource))}`,
    icon: "resource",
  }),
  TradeCancelled: (_event, payload) => ({
    title: "Trade cancelled",
    description: `Trade ${formatNumber(payload.value) ?? "—"}`,
    icon: "resource",
  }),
  BankSwap: (_event, payload) => ({
    title: payload.buy ? "Bought at the bank" : "Sold at the bank",
    description: `${formatResourceAmount(payload.resource_amount) ?? "—"} ${getResourceName(Number(payload.resource_type))} for ${formatResourceAmount(payload.lords_amount) ?? "—"} Lords`,
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
    const kind = formatEnum(payload.kind);
    const label =
      kind === "Camp" ? "Camp" : kind === "Rift" ? "Rift" : kind === "FallenRealm" ? "Fallen realm" : undefined;
    if (!label || payload.reward === undefined) throw new Error("Incomplete site payout story");
    const reward = payload.reward === null ? "Closed chest on the tile" : formatResourceList([payload.reward]);
    if (!reward) throw new Error("Incomplete site resource reward");
    return {
      title: `${label} cleared`,
      description: joinPieces([describeExplorer(payload.explorer_id, components), reward]),
      icon: "prize",
    };
  },
  AttributeChosen: (event, payload, components) => {
    const attribute = formatEnum(payload.attribute);
    const applied = toNumber(payload.applied);
    const lost = toNumber(payload.lost);
    if (!attribute || applied === null || lost === null) throw new Error("Incomplete attribute choice story");
    return {
      title: `${attribute} +${applied}`,
      description: joinPieces([
        describeExplorer(payload.explorer_id, components),
        lost > 0 ? `${lost} ${lost === 1 ? "level" : "levels"} lost at the cap` : undefined,
      ]),
      icon: "scroll",
    };
  },
  ChestReward: (event, payload, components) => {
    const quality = labelAt(CHEST_QUALITY_LABELS, payload.quality);
    const rawKind = formatEnum(payload.kind);
    if (rawKind && !(rawKind in CHEST_KIND_LABELS)) throw new Error("Invalid chest reward kind");
    const kind = CHEST_KIND_LABELS[rawKind ?? ""] ?? "reward";
    const ground = labelAt(EXPEDITION_GROUND_LABELS, payload.depth);
    return {
      title: `Chest opened: ${quality ? `${quality} ${kind}` : kind}`,
      description: joinPieces([
        describeExplorer(payload.explorer_id, components),
        ground ? `On ${ground}` : undefined,
        payload.lords_exhausted === true ? "LORDS allowance exhausted; awarded a relic of the same rarity" : undefined,
      ]),
      icon: "prize",
    };
  },
  RealmCreatedStory: (event, payload, components, resolvePlayerName) => {
    const coord = formatCoord(payload.coord);
    const ownerLabel = nameOwner(event.ownerAddress, components, resolvePlayerName);
    const realm = describeStructureDetails(event, components) ?? "Realm";
    return {
      title: "Realm founded",
      description:
        joinPieces([realm, ownerLabel ? `Settled by ${ownerLabel}` : undefined, coord ? `at ${coord}` : undefined]) ??
        "New realm established on the map.",
      icon: "realm",
    };
  },
  BuildingPlacementStory: (event, payload, components) => {
    const status = describeBuildingStatus(payload);
    const structureDetails = describeStructureDetails(event, components, payload.category, payload.inner_coord);
    const categoryLabel = formatBuildingCategory(payload.category) ?? "Structure";
    const coord = formatCoord(payload.inner_coord);
    const statusDetail = status && status !== "Updated" ? status : undefined;
    const title =
      status === "Constructed"
        ? `Constructed: ${categoryLabel}`
        : status === "Demolished"
          ? `Demolished: ${categoryLabel}`
          : `${categoryLabel} ${status.toLowerCase()}`;
    return {
      title,
      description: joinPieces([structureDetails, statusDetail, coord ? `Position ${coord}` : undefined]),
      icon: "building",
    };
  },
  BuildingPaymentStory: (event, payload, components) => {
    const categoryLabel = formatBuildingCategory(payload.category) ?? "Structure";
    const structureDetails = describeStructureDetails(event, components, payload.category, payload.inner_coord);
    const cost = formatResourceList(payload.cost);
    return {
      title: `Building Constructed: ${categoryLabel}`,
      description: joinPieces([structureDetails, cost ? `Cost: ${cost}` : undefined]),
      icon: "building",
    };
  },
  ProductionStory: (event, payload, components) => {
    const receivedId = toNumber(payload.received_resource_type);
    const amount = formatResourceAmount(payload.received_amount);
    const cost = formatResourceList(payload.cost);
    const structureSummary = describeStructureDetails(event, components);
    const resourceName = receivedId !== null ? getResourceName(receivedId) : undefined;
    const outputLine = resourceName
      ? `Output: ${resourceName}${amount ? ` ×${amount}` : ""}`
      : amount
        ? `Output: ×${amount}`
        : undefined;
    const inputsLine = cost ? `Inputs consumed: ${cost}` : undefined;
    return {
      title: resourceName ? `Production started: ${resourceName}` : "Production started",
      description: joinPieces([structureSummary, outputLine, inputsLine]),
      icon: "production",
    };
  },
  StructureLevelUpStory: (event, payload, components) => {
    const structureSummary = describeStructureDetails(event, components);
    const newLevelNumeric = toNumber(payload.new_level);
    const previousLevel = newLevelNumeric !== null ? Math.max(newLevelNumeric - 1, 0) : null;
    const levelLabel = newLevelNumeric !== null ? newLevelNumeric.toLocaleString() : undefined;
    return {
      title: levelLabel ? `Structure reached level ${levelLabel}` : "Structure leveled up",
      description:
        joinPieces([
          structureSummary,
          previousLevel !== null && levelLabel
            ? `Progression: ${previousLevel.toLocaleString()} → ${levelLabel}`
            : undefined,
        ]) ?? "Structure advanced to a higher tier.",
      icon: "building",
    };
  },
  BattleEvent: (event, payload, store, resolvePlayerName) => {
    const attacker = payload.attacker as Record<string, unknown>;
    const defender = payload.defender as Record<string, unknown>;
    const attackerName = nameOwner(attacker.player, store, resolvePlayerName);
    const defenderName = nameOwner(defender.player, store, resolvePlayerName);
    const winner = Number(payload.winner_id);
    const victor =
      winner > 0 && winner === Number(payload.attacker_owner)
        ? `Attacker [${attackerName}]`
        : winner > 0 && winner === Number(payload.defender_owner)
          ? `Defender [${defenderName}]`
          : BigInt(String(attacker.after)) === 0n && BigInt(String(defender.after)) === 0n
            ? "Mutual Annihilation"
            : "Draw";
    const side = (label: string, value: Record<string, unknown>) => [
      `${label} forces: ${formatTroopDescriptor(value.category, value.tier)} [ ${formatUnitAmount(value.before)} ]`,
      `${label} losses: ${formatResourceAmount(BigInt(String(value.before)) - BigInt(String(value.after)))}`,
      `${label} Troops Left: ${formatResourceAmount(value.after)} Troops`,
      Number(value.roll) > 0 ? `${label} d20: ${Number(value.roll)} (+${Number(value.roll)}% damage)` : undefined,
    ];
    return {
      title: "Battle resolved",
      description: joinPieces([
        `Attacker [${attackerName}]: ${describeEntity(payload.attacker_id, store) ?? "Army"}`,
        `Defender [${defenderName}]: ${describeEntity(payload.defender_id, store) ?? "Army"}`,
        ...side("Attacker", attacker),
        ...side("Defender", defender),
        `Winner: ${victor}`,
      ]),
      icon: "battle",
    };
  },
  RaidEvent: (_, payload) => ({
    title: payload.success ? "Raid successful" : "Raid repelled",
    description: payload.success ? formatResourceList(payload.requested_loot) : "No resources captured.",
    icon: "battle",
  }),
  BankLiquidity: (_, payload) => ({
    title: payload.add ? "Liquidity added" : "Liquidity withdrawn",
    description: `${getResourceName(Number(payload.resource_type))} / Lords`,
    icon: "resource",
  }),
  ResourceTransferStory: (event, payload, components, resolvePlayerName) => {
    const resourcesText = formatResourceList(payload.resources);
    const transferType = formatEnum(payload.transfer_type);
    const route = formatRoute(payload.from_entity_id, payload.to_entity_id, components);
    const sender = nameOwner(
      payload.from_entity_owner_address ?? payload.from_entity_id,
      components,
      resolvePlayerName,
    );
    const recipient = nameOwner(payload.to_entity_owner_address ?? payload.to_entity_id, components, resolvePlayerName);
    const travelTime = formatTravelTime(payload.travel_time);
    const minted = payload.is_mint === true ? "Minted at destination" : undefined;

    return {
      title: payload.is_mint === true ? "Resources minted" : "Resources transferred",
      description: joinPieces([
        route ? `Route: ${route}` : undefined,
        transferType ? `Courier: ${transferType}` : undefined,
        sender ? `Sender: ${sender}` : undefined,
        recipient ? `Recipient: ${recipient}` : undefined,
        travelTime ? `Travel time: ${travelTime}` : undefined,
        minted,
        resourcesText ? `Payload: ${resourcesText}` : undefined,
      ]),
      icon: "resource",
    };
  },
  ResourceBurnStory: (_, payload) => {
    const burned = formatResourceList(payload.resources);
    return {
      title: "Resources burned",
      description: burned ? `Consumed: ${burned}` : "Resources consumed.",
      icon: "resource",
    };
  },
  ResourceReceiveArrivalStory: (_, payload) => {
    const delivered = formatResourceList(payload.resources);
    return {
      title: "Resources arrived",
      description: delivered ? `Delivery: ${delivered}` : "Incoming resources delivered.",
      icon: "resource",
    };
  },
  GuardAddStory: (event, payload, components) => {
    const structureSummary = describeStructureDetails(event, components, undefined, undefined, payload.structure_id);
    const slotLabel = formatSlotLabel(payload.slot);
    const troopCategory = formatEnum(payload.category);
    const troopTier = formatEnum(payload.tier);
    const troopDescriptor = [troopCategory, troopTier].filter(Boolean).join(" ");
    const amount = formatResourceAmount(payload.amount) ?? formatNumber(payload.amount ?? null) ?? undefined;

    return {
      title: "Garrison reinforced",
      description: joinPieces([
        structureSummary,
        slotLabel ? `Assignment: ${slotLabel}` : undefined,
        troopDescriptor ? `Unit: ${troopDescriptor}` : undefined,
        amount ? `Strength: +${amount}` : undefined,
      ]),
      icon: "troop",
    };
  },
  GuardDeleteStory: (event, payload, components) => {
    const structureSummary = describeStructureDetails(event, components, undefined, undefined, payload.structure_id);
    const slotLabel = formatSlotLabel(payload.slot);
    return {
      title: "Guard dismissed",
      description: joinPieces([structureSummary, slotLabel ? `Removed from ${slotLabel}` : undefined]),
      icon: "troop",
    };
  },
  ExplorerCreateStory: (event, payload, components) => {
    const structureSummary = describeStructureDetails(event, components, undefined, undefined, payload.structure_id);
    const troopCategory = formatEnum(payload.category);
    const troopTier = formatEnum(payload.tier);
    const troopDescriptor = [troopCategory, troopTier].filter(Boolean).join(" ");
    const amount = formatResourceAmount(payload.amount) ?? formatNumber(payload.amount ?? null) ?? undefined;
    const direction = formatDirection(payload.spawn_direction);

    return {
      title: "Explorer enlisted",
      description: joinPieces([
        structureSummary,
        troopDescriptor ? `Unit: ${troopDescriptor}` : undefined,
        amount ? `Strength: ${amount}` : undefined,
        direction ? `Spawn: ${direction}` : undefined,
      ]),
      icon: "troop",
    };
  },
  ExplorerAddStory: (_, payload, components) => {
    const explorerRef = describeExplorer(payload.explorer_id, components);
    const amount = formatResourceAmount(payload.amount) ?? formatNumber(payload.amount ?? null) ?? undefined;
    const direction = formatDirection(payload.home_direction);
    return {
      title: "Explorer reinforced",
      description: joinPieces([
        `Explorer: ${explorerRef}`,
        amount ? `Reinforcements: +${amount}` : undefined,
        direction ? `Home route: ${direction}` : undefined,
      ]),
      icon: "troop",
    };
  },
  ExplorerDeleteStory: (_, payload, components) => {
    return {
      title: "Explorer retired",
      description: `${describeExplorer(payload.explorer_id, components)} disbanded.`,
      icon: "troop",
    };
  },
  TroopsTransferred: (event, payload, components) => ({
    title: "Troops reassigned",
    description: joinPieces([
      `Route: ${describeArmy(payload.source, event, components)} → ${describeArmy(payload.target, event, components)}`,
      `Transferred: ${formatResourceAmount(payload.amount)}`,
    ]),
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

function formatBuildingCategory(value: unknown): string | undefined {
  const numeric = toNumber(value);
  if (numeric === null) {
    const label = formatEnum(value);
    return label ?? undefined;
  }
  const type = numeric as BuildingType;
  return BuildingTypeToString[type] ?? `Building ${numeric}`;
}

function describeBuildingStatus(payload: Record<string, unknown>): string {
  const truthy = 1;
  if (payload.destroyed === truthy) return "Demolished";
  if (payload.created === truthy) return "Constructed";
  if (payload.paused === truthy) return "Paused";
  if (payload.unpaused === truthy) return "Resumed";
  return "Updated";
}

function describeArmy(value: unknown, event: StoryEventSystemUpdate, components?: NativeFactStore): string {
  if (!value || typeof value !== "object") throw new Error("Missing troop transfer participant");
  const army = value as Record<string, unknown>;
  if (army.Explorer !== undefined) return describeExplorer(army.Explorer, components);
  if (!army.Guard || typeof army.Guard !== "object") throw new Error("Unknown troop transfer participant");
  const guard = army.Guard as Record<string, unknown>;
  const structure =
    describeStructureDetails(event, components, undefined, undefined, guard.structure_id) ??
    `Structure ${formatNumber(guard.structure_id)}`;
  return `${structure} · ${formatSlotLabel(guard.slot)}`;
}

function describeStructureDetails(
  event: StoryEventSystemUpdate,
  components?: NativeFactStore,
  fallbackCategory?: unknown,
  fallbackCoord?: unknown,
  structureOverride?: unknown,
): string | undefined {
  const targetId = structureOverride ?? event.entityId;

  if (!components || targetId === null || targetId === undefined) {
    return describeFallbackStructure(fallbackCategory, fallbackCoord);
  }

  const structure = readStructure(targetId, components);
  if (!structure) return describeFallbackStructure(fallbackCategory, fallbackCoord);

  const name = getStructureName(components, structure, getIsBlitz()).name;
  const level = toNumber(structure.base?.level);
  const coord = formatCoord(structureMapPosition(components, structure));

  return joinPieces([name, level !== null ? `Level ${level}` : undefined, coord ? `at ${coord}` : undefined]);
}

type StructureRow = NonNullable<ReturnType<typeof readStructure>>;

function readStructure(structureId: unknown, components?: NativeFactStore) {
  const entityId = toBigIntSafe(structureId);
  if (!components || entityId === null) return undefined;
  try {
    return components.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: Number(entityId) });
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
      explorer_id: Number(entityId),
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
  return getStructureName(components, structure, getIsBlitz()).name;
}

/**
 * The explorer as a player reads it: its home structure's name and its tier ("Stormhold T2 army"). A retired
 * explorer has no row, so the home structure from the payload stands in; with nothing to read it is "Army".
 */
function describeExplorer(explorerId: unknown, components?: NativeFactStore, homeStructureId?: unknown): string {
  const explorer = readExplorer(explorerId, components);
  const home = describeStructureName(explorer?.owner ?? homeStructureId, components);
  const tier = formatEnum(explorer?.troops?.tier);
  const army = tier ? `${tier} army` : "army";
  return home ? `${home} ${army}` : "Army";
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
      return formatted ? `${getResourceName(id)} ×${formatted}` : getResourceName(id);
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

function getResourceName(id: number): string {
  return resourceNameMap[id] ?? `Resource ${id}`;
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
    return value.toLocaleString();
  }
  if (typeof value === "bigint") {
    return value.toString();
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
      return numeric.toLocaleString();
    }
    try {
      return BigInt(value).toString();
    } catch (error) {
      return value;
    }
  }
  return `${value}`;
}

/** The label an index names, or undefined when the payload carries no index or one outside the table. */
function labelAt(labels: string[], value: unknown): string | undefined {
  const index = toNumber(value);
  return index === null ? undefined : labels[index];
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

function shortenAddress(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value);
  if (raw.length <= 10) return raw;
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
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

function formatAmountWithPrecision(amount: unknown, precision: number): string {
  const bigIntAmount = amountToBigInt(amount);
  if (bigIntAmount === null) return "0";

  const divisor = BigInt(precision);
  const whole = bigIntAmount / divisor;
  const remainder = bigIntAmount % divisor;

  if (remainder === 0n) {
    return whole.toString();
  }

  // Format with decimal places, removing trailing zeros
  const decimals = remainder
    .toString()
    .padStart(precision.toString().length - 1, "0")
    .replace(/0+$/, "");
  return decimals.length > 0 ? `${whole.toString()}.${decimals}` : whole.toString();
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

function describeFallbackStructure(fallbackCategory?: unknown, fallbackCoord?: unknown): string | undefined {
  const categoryLabel = formatBuildingCategory(fallbackCategory);
  const coordLabel = formatCoord(fallbackCoord);
  return joinPieces([categoryLabel, coordLabel ? `at ${coordLabel}` : undefined]);
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
  const name = GuardSlot[slot as GuardSlot];
  if (name === undefined) throw new Error(`Invalid guard slot: ${String(value)}`);
  return name;
}

function formatDirection(value: unknown): string | undefined {
  const label = formatEnum(value);
  if (label) return label;
  return undefined;
}

function formatTravelTime(seconds: unknown): string | undefined {
  const numeric = toNumber(seconds);
  if (numeric === null) return undefined;
  if (numeric === 0) return "Instant";

  if (numeric < 60) return `${numeric.toLocaleString()} seconds`;
  if (numeric < 3600) {
    const minutes = Math.floor(numeric / 60);
    const secs = numeric % 60;
    return secs === 0
      ? `${minutes.toLocaleString()} minutes`
      : `${minutes.toLocaleString()} minutes ${secs.toLocaleString()} seconds`;
  }
  if (numeric < 86400) {
    const hours = Math.floor(numeric / 3600);
    const minutes = Math.floor((numeric % 3600) / 60);
    return minutes === 0
      ? `${hours.toLocaleString()} hours`
      : `${hours.toLocaleString()} hours ${minutes.toLocaleString()} minutes`;
  }
  return `${numeric.toLocaleString()} ticks`;
}

function formatRoute(fromEntity: unknown, toEntity: unknown, components?: NativeFactStore): string | undefined {
  const fromRef = describeEntity(fromEntity, components);
  const toRef = describeEntity(toEntity, components);
  if (!fromRef || !toRef) return undefined;
  return `${fromRef} → ${toRef}`;
}

/** An owner is an address (its registered name, else shortened) or an owning structure (its name). */
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
  if (typeof owner === "string" && owner.startsWith("0x")) {
    if (isZeroAddress(owner)) return "Neutral";
    return resolvePlayerName?.(owner) ?? shortenAddress(owner) ?? owner;
  }
  return components ? (describeStructureName(owner, components) ?? undefined) : undefined;
}

const isZeroAddress = (address: string): boolean => {
  try {
    return BigInt(address) === 0n;
  } catch {
    return false;
  }
};
