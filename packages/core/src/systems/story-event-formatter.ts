import {
  BuildingType,
  BuildingTypeToString,
  ClientComponents,
  ContractAddress,
  RESOURCE_PRECISION,
  StructureType,
  resources,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getAddressName } from "../utils/entities";
import { getStructureTypeName } from "../utils/structure";
import { getIsBlitz } from "../utils/utils";
import { StoryEventSystemUpdate } from "./types";

export type StoryEventIcon =
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
  components?: ClientComponents,
) => StoryEventPresentation;

const resourceNameMap = resources.reduce<Record<number, string>>((acc, resource) => {
  acc[resource.id] = resource.trait;
  return acc;
}, {});

const formatters: Record<string, StoryFormatter> = {
  RealmCreatedStory: (event, payload, components) => {
    const coord = formatCoord(payload.coord);
    const ownerLabel = components
      ? getActivityActor(event.ownerAddress, components)
      : shortenAddress(event.ownerAddress);
    const entityRef = formatEntityRef(event.entityId);
    return {
      title: "Realm founded",
      description:
        joinPieces([
          ownerLabel ? `Settled by ${ownerLabel}` : undefined,
          coord ? `Coordinates ${coord}` : undefined,
          entityRef ? `Registry: ${entityRef}` : undefined,
        ]) ?? "New realm established on the map.",
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
      title: `Production started: ${resourceName}`,
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
  ExplorerMoveStory: (event, payload, components) => {
    const explorerId = formatNumber(payload.explorer_id);
    const explorerLabel = explorerId ? `Explorer ${explorerId}` : "Explorer";
    const start = formatCoord(payload.start_coord);
    const end = formatCoord(payload.end_coord);
    const structureRef = formatEntityRef(payload.explorer_structure_id ?? event.entityId);
    const path = formatDirectionSequence(payload.directions);
    const discovery = formatExploreFind(payload.explore_find);
    const reward = buildRewardText(payload.reward_resource_type, payload.reward_resource_amount);
    const explorationFlag = payload.explore === true ? "Exploration recorded" : undefined;
    return {
      title: `${explorerLabel} moved`,
      description:
        joinPieces([
          structureRef ? `Origin: ${structureRef}` : undefined,
          start && end ? `${start} → ${end}` : end ? `Arrived at ${end}` : start ? `Departed ${start}` : undefined,
          path ? `Course: ${path}` : undefined,
          explorationFlag,
          discovery,
          reward,
        ]) ?? "Explorer activity reported.",
      icon: "travel",
    };
  },
  BattleStory: (event, payload, components) => {
    const battleType = formatEnum(payload.battle_type) ?? "Battle";
    const attackerId = formatNumber(payload.attacker_id);
    const defenderId = formatNumber(payload.defender_id);
    const winnerId = formatNumber(payload.winner_id);
    const attackerOwner = payload.attacker_owner_address ?? payload.attacker_owner_id;
    const defenderOwner = payload.defender_owner_address ?? payload.defender_owner_id;
    const attackerOwnerLabel = components
      ? getActivityActor(attackerOwner, components)
      : formatOwnerFallback(attackerOwner);
    const defenderOwnerLabel = components
      ? getActivityActor(defenderOwner, components)
      : formatOwnerFallback(defenderOwner);
    const attackerTroop = formatTroopDescriptor(payload.attacker_troops_type, payload.attacker_troops_tier);
    const defenderTroop = formatTroopDescriptor(payload.defender_troops_type, payload.defender_troops_tier);
    const attackerStrength = formatUnitAmount(payload.attacker_troops_before);
    const defenderStrength = formatUnitAmount(payload.defender_troops_before);
    const attackerLosses = formatResourceAmount(payload.attacker_troops_lost);
    const defenderLosses = formatResourceAmount(payload.defender_troops_lost);
    const attackerLeft = formatResourceAmount(
      (payload.attacker_troops_before as unknown as number) - (payload.attacker_troops_lost as unknown as number),
    );
    const defenderLeft = formatResourceAmount(
      (payload.defender_troops_before as unknown as number) - (payload.defender_troops_lost as unknown as number),
    );
    const stolen = formatResourceList(payload.stolen_resources ?? []);
    let victor;

    if (Number(attackerLeft) == 0 && Number(defenderLeft) == 0) {
      victor = "Mutual Annihilation";
    } else if (Number(attackerLeft) == 0 && Number(defenderLeft) > 0) {
      victor = `Defender [${defenderOwnerLabel}]`;
    } else if (Number(defenderLeft) == 0 && Number(attackerLeft) > 0) {
      victor = `Attacker [${attackerOwnerLabel}]`;
    } else {
      victor = `Draw`;
    }

    return {
      title: `${battleType} resolved`,
      description: joinPieces([
        attackerOwnerLabel ? `Attacker [${attackerOwnerLabel}]:  Army ${attackerId}` : undefined,
        defenderOwnerLabel ? `Defender [${defenderOwnerLabel}]:  Army ${defenderId}` : undefined,
        attackerTroop
          ? `Attacker forces: ${attackerTroop}${attackerStrength ? ` [ ${attackerStrength} ]` : ""}`
          : undefined,
        defenderTroop
          ? `Defender forces: ${defenderTroop}${defenderStrength ? ` [ ${defenderStrength} ]` : ""}`
          : undefined,
        attackerLosses ? `Attacker losses: ${attackerLosses}` : undefined,
        defenderLosses ? `Defender losses: ${defenderLosses}` : undefined,
        attackerLeft ? `Attacker Troops Left: ${attackerLeft} Troops` : undefined,
        defenderLeft ? `Defender Troops Left: ${defenderLeft} Troops` : undefined,
        winnerId ? `Winner: ${victor} ` : undefined,
        stolen ? `Spoils: ${stolen}` : undefined,
      ]),
      icon: "battle",
    };
  },
  ResourceTransferStory: (event, payload, components) => {
    const resourcesText = formatResourceList(payload.resources);
    const transferType = formatEnum(payload.transfer_type);
    const route = formatRoute(payload.from_entity_id, payload.to_entity_id);
    const sender = components
      ? getActivityActor(payload.from_entity_owner_address ?? payload.from_entity_id, components)
      : formatOwnerFallback(payload.from_entity_owner_address ?? payload.from_entity_id);
    const recipient = components
      ? getActivityActor(payload.to_entity_owner_address ?? payload.to_entity_id, components)
      : formatOwnerFallback(payload.to_entity_owner_address ?? payload.to_entity_id);
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
    const explorerRef = formatEntityRef(payload.explorer_id);
    const troopCategory = formatEnum(payload.category);
    const troopTier = formatEnum(payload.tier);
    const troopDescriptor = [troopCategory, troopTier].filter(Boolean).join(" ");
    const amount = formatResourceAmount(payload.amount) ?? formatNumber(payload.amount ?? null) ?? undefined;
    const direction = formatDirection(payload.spawn_direction);

    return {
      title: "Explorer enlisted",
      description: joinPieces([
        structureSummary,
        explorerRef ? `Explorer: ${explorerRef}` : undefined,
        troopDescriptor ? `Unit: ${troopDescriptor}` : undefined,
        amount ? `Strength: ${amount}` : undefined,
        direction ? `Spawn: ${direction}` : undefined,
      ]),
      icon: "troop",
    };
  },
  ExplorerAddStory: (_, payload) => {
    const explorerRef = formatEntityRef(payload.explorer_id);
    const amount = formatResourceAmount(payload.amount) ?? formatNumber(payload.amount ?? null) ?? undefined;
    const direction = formatDirection(payload.home_direction);
    return {
      title: "Explorer reinforced",
      description: joinPieces([
        explorerRef ? `Explorer: ${explorerRef}` : undefined,
        amount ? `Reinforcements: +${amount}` : undefined,
        direction ? `Home route: ${direction}` : undefined,
      ]),
      icon: "troop",
    };
  },
  ExplorerDeleteStory: (_, payload) => {
    const explorerRef = formatEntityRef(payload.explorer_id);
    return {
      title: "Explorer retired",
      description: explorerRef ? `${explorerRef} disbanded.` : "Explorer unit removed.",
      icon: "troop",
    };
  },
  ExplorerExplorerSwapStory: (_, payload) => {
    const fromRef = formatEntityRef(payload.from_explorer_id);
    const toRef = formatEntityRef(payload.to_explorer_id);
    const count = formatResourceAmount(payload.count) ?? formatNumber(payload.count ?? null) ?? undefined;
    const direction = formatDirection(payload.to_explorer_direction);
    return {
      title: "Troops reassigned",
      description: joinPieces([
        fromRef && toRef ? `Route: ${fromRef} → ${toRef}` : undefined,
        count ? `Transferred: ${count}` : undefined,
        direction ? `Direction: ${direction}` : undefined,
      ]),
      icon: "troop",
    };
  },
  ExplorerGuardSwapStory: (event, payload, components) => {
    const fromExplorer = formatEntityRef(payload.from_explorer_id);
    const targetStructure = describeStructureDetails(event, components, undefined, undefined, payload.to_structure_id);
    const slotLabel = formatSlotLabel(payload.to_guard_slot);
    const count = formatResourceAmount(payload.count) ?? formatNumber(payload.count ?? null) ?? undefined;
    const direction = formatDirection(payload.to_structure_direction);
    return {
      title: "Explorer garrisons troops",
      description: joinPieces([
        fromExplorer ? `Explorer: ${fromExplorer}` : undefined,
        targetStructure,
        slotLabel ? `Assignment: ${slotLabel}` : undefined,
        count ? `Deployed: ${count}` : undefined,
        direction ? `Direction: ${direction}` : undefined,
      ]),
      icon: "troop",
    };
  },
  GuardExplorerSwapStory: (event, payload, components) => {
    const sourceStructure = describeStructureDetails(
      event,
      components,
      undefined,
      undefined,
      payload.from_structure_id,
    );
    const slotLabel = formatSlotLabel(payload.from_guard_slot);
    const explorerRef = formatEntityRef(payload.to_explorer_id);
    const count = formatResourceAmount(payload.count) ?? formatNumber(payload.count ?? null) ?? undefined;
    const direction = formatDirection(payload.to_explorer_direction);
    return {
      title: "Garrison deployed",
      description: joinPieces([
        sourceStructure,
        slotLabel ? `From ${slotLabel}` : undefined,
        explorerRef ? `To ${explorerRef}` : undefined,
        count ? `Committed: ${count}` : undefined,
        direction ? `Direction: ${direction}` : undefined,
      ]),
      icon: "troop",
    };
  },
  PrizeDistributedStory: (_, payload) => {
    const recipient = shortenAddress(payload.to_player_address);
    const amount = formatTokenAmount(payload.amount, payload.decimals);
    return {
      title: "Prize distributed",
      description: joinPieces([recipient ? `To ${recipient}` : undefined, amount ? amount : undefined]),
      icon: "prize",
    };
  },
  PrizeDistributionFinalStory: (_, payload) => {
    const trialId = formatNumber(payload.trial_id);
    return {
      title: "Prize trial complete",
      description: trialId ? `Trial ${trialId} finalized.` : "Distribution cycle finalized.",
      icon: "prize",
    };
  },
};

export function buildStoryEventPresentation(
  event: StoryEventSystemUpdate,
  components?: ClientComponents,
): StoryEventPresentation {
  const payload = event.storyPayload ?? {};
  const formatter = payload && formatters[event.storyType];
  const base = formatter ? formatter(event, payload, components) : fallbackPresentation(event);

  let ownerName: string | null = null;
  if (event.ownerAddress && components) {
    const addressName = getAddressName(event.ownerAddress as unknown as ContractAddress, components);
    ownerName = addressName || shortenAddress(event.ownerAddress);
  } else {
    ownerName = shortenAddress(event.ownerAddress);
  }

  return {
    ...base,
    owner: ownerName,
  };
}

function fallbackPresentation(event: StoryEventSystemUpdate): StoryEventPresentation {
  const type = event.storyType || "Unknown";
  const owner = shortenAddress(event.ownerAddress);
  const entityRef = formatEntityRef(event.entityId);
  return {
    title: `${type} event`,
    description:
      joinPieces([
        owner ? `Owner: ${owner}` : undefined,
        entityRef,
        event.txHash ? `Tx: ${event.txHash}` : undefined,
      ]) ?? "Details captured from StoryEvent stream.",
    icon: "scroll",
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

function describeStructureDetails(
  event: StoryEventSystemUpdate,
  components?: ClientComponents,
  fallbackCategory?: unknown,
  fallbackCoord?: unknown,
  structureOverride?: unknown,
): string | undefined {
  const targetId = structureOverride ?? event.entityId;

  if (!components || targetId === null || targetId === undefined) {
    return describeFallbackStructure(event, fallbackCategory, fallbackCoord, structureOverride);
  }

  const entityId = toBigIntSafe(targetId);
  if (entityId === null) return describeFallbackStructure(event, fallbackCategory, fallbackCoord, structureOverride);

  try {
    const structureEntity = getEntityIdFromKeys([entityId]);
    const structure = getComponentValue(components.Structure, structureEntity);
    if (!structure) return describeFallbackStructure(event, fallbackCategory, fallbackCoord, structureOverride);

    const isBlitz = getIsBlitz();
    const categoryValue = toNumber(structure.base?.category ?? structure.category);
    const typeLabel =
      categoryValue !== null ? getStructureTypeName(categoryValue as StructureType, isBlitz) : "Structure";
    const name = `${typeLabel} #${structure.entity_id?.toString?.() ?? structure.entity_id}`;
    const level = toNumber(structure.base?.level);
    const coordX = toNumber(structure.base?.coord_x);
    const coordY = toNumber(structure.base?.coord_y);
    const coord = coordX !== null && coordY !== null ? `(${coordX}, ${coordY})` : undefined;

    return joinPieces([name, level !== null ? `Level ${level}` : undefined, coord ? `at ${coord}` : undefined]);
  } catch (error) {
    return describeFallbackStructure(event, fallbackCategory, fallbackCoord, structureOverride);
  }
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

function buildRewardText(resourceType: unknown, amount: unknown): string | undefined {
  const id = toNumber(resourceType);
  if (id === null) return undefined;
  const formattedAmount = formatResourceAmount(amount);
  if (!formattedAmount) return `Reward: ${getResourceName(id)}`;
  return `Reward: ${getResourceName(id)} +${formattedAmount}`;
}

function formatExploreFind(value: unknown): string | undefined {
  const label = formatEnum(value);
  if (!label || label === "None") return undefined;
  return `Discovery: ${label}`;
}

function formatDirectionSequence(value: unknown): string | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value)
    ? value
    : typeof value === "object" && value && "values" in value
      ? (value as { values: unknown }).values
      : undefined;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const labels = raw
    .map((entry) => extractDirectionLabel(entry))
    .filter((direction): direction is string => Boolean(direction));

  if (!labels.length) return undefined;
  return labels.join(" → ");
}

function extractDirectionLabel(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry !== null) {
    const keys = Object.keys(entry as Record<string, unknown>);
    if (keys.length === 1) return keys[0];
  }
  return undefined;
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

function formatCoord(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const coord = value as Record<string, unknown>;
  const x = toNumber(coord.x);
  const y = toNumber(coord.y);
  if (x === null || y === null) return undefined;
  return `(${x}, ${y})`;
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

function formatTokenAmount(amount: unknown, decimals: unknown): string | undefined {
  const decimalPlaces = toNumber(decimals) ?? 0;
  const raw = amountToBigInt(amount);
  if (raw === null) return undefined;
  if (decimalPlaces === 0) {
    return `${raw.toString()} tokens`;
  }
  const divisor = BigInt(10) ** BigInt(decimalPlaces);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  if (fraction === 0n) {
    return `${whole.toString()} tokens`;
  }
  const fractionStr = fraction.toString().padStart(decimalPlaces, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionStr} tokens`;
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

function describeFallbackStructure(
  event: StoryEventSystemUpdate,
  fallbackCategory?: unknown,
  fallbackCoord?: unknown,
  overrideEntityId?: unknown,
): string | undefined {
  const categoryLabel = formatBuildingCategory(fallbackCategory);
  const coordLabel = formatCoord(fallbackCoord);
  const entityLabel = formatEntityRef(overrideEntityId ?? event.entityId);
  return joinPieces([categoryLabel ?? entityLabel, coordLabel ? `at ${coordLabel}` : undefined]);
}

function formatResourceAmount(amount: unknown): string | undefined {
  const bigIntAmount = amountToBigInt(amount);
  if (bigIntAmount === null) return undefined;
  return formatAmountWithPrecision(bigIntAmount, RESOURCE_PRECISION);
}

function formatEntityRef(value: unknown): string | undefined {
  const numeric = toNumber(value);
  if (numeric !== null) return `Entity #${numeric}`;
  if (typeof value === "bigint") return `Entity #${value.toString()}`;
  if (typeof value === "string" && value.trim().length > 0) return value;
  return undefined;
}

function formatSlotLabel(value: unknown): string | undefined {
  const label = formatEnum(value);
  if (label) return `Slot ${label}`;
  const numeric = toNumber(value);
  if (numeric !== null) return `Slot ${numeric}`;
  return undefined;
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

function formatRoute(fromEntity: unknown, toEntity: unknown): string | undefined {
  const fromRef = formatEntityRef(fromEntity);
  const toRef = formatEntityRef(toEntity);
  if (!fromRef || !toRef) return undefined;
  return `${fromRef} → ${toRef}`;
}

function getActivityActor(owner: unknown, components: ClientComponents): string | undefined {
  if (owner === undefined || owner === null) return undefined;

  if (typeof owner === "string") {
    if (owner.startsWith("0x")) {
      try {
        const resolved = getAddressName(owner as unknown as ContractAddress, components);
        return resolved ?? shortenAddress(owner) ?? owner;
      } catch (error) {
        return shortenAddress(owner) ?? owner;
      }
    }

    const numeric = Number(owner);
    if (!Number.isNaN(numeric)) {
      return `Entity #${numeric}`;
    }

    return owner;
  }

  if (typeof owner === "number") {
    return `Entity #${owner}`;
  }

  if (typeof owner === "bigint") {
    return `Entity #${owner.toString()}`;
  }

  return `${owner}`;
}

function formatOwnerFallback(owner: unknown): string | undefined {
  if (owner === undefined || owner === null) return undefined;

  if (typeof owner === "string") {
    if (owner.startsWith("0x")) {
      return shortenAddress(owner) ?? owner;
    }

    const numeric = Number(owner);
    if (!Number.isNaN(numeric)) {
      return `Entity #${numeric}`;
    }

    return owner;
  }

  if (typeof owner === "number") {
    return `Entity #${owner}`;
  }

  if (typeof owner === "bigint") {
    return `Entity #${owner.toString()}`;
  }

  return `${owner}`;
}
