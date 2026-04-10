/**
 * GameEntryModal - Combined loading + settlement modal for seamless game entry
 *
 * This modal shows:
 * 1. Loading phase - Bootstrap progress (world config, Dojo setup, sync)
 * 2. Settlement phase - If user is registered but hasn't settled
 * 3. Auto-transitions to game when ready
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRealmInfo } from "@bibliothecadao/eternum";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Castle,
  Check,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Pickaxe,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { refreshSessionPolicies } from "@/hooks/context/session-policy-refresh";
import type { BootstrapTask } from "@/hooks/context/use-eager-bootstrap";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useSeasonPassInventory, type SeasonPassInventoryItem } from "@/hooks/use-season-pass-inventory";
import { useUsername } from "@/hooks/use-username";
import { useVillagePassInventory, type VillagePassInventoryItem } from "@/hooks/use-village-pass-inventory";
import { getWorldKey, useWorldsAvailability } from "@/hooks/use-world-availability";
import type { SetupResult } from "@/init/bootstrap";
import { bootstrapGame } from "@/init/bootstrap";
import { captureClientEvent } from "@/posthog";
import { applyWorldSelection } from "@/runtime/world";
import { getFactorySqlBaseUrl } from "@/runtime/world/factory-endpoints";
import { resolveWorldContracts } from "@/runtime/world/factory-resolver";
import { normalizeSelector } from "@/runtime/world/normalize";
import { getActiveWorld } from "@/runtime/world/store";
import { sqlApi } from "@/services/api";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getRpcUrlForChain } from "@/ui/features/admin/constants";
import { BootstrapLoadingPanel } from "@/ui/layouts/bootstrap-loading/bootstrap-loading-panel";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import type { PlayerStructure, RealmVillageSlot } from "@bibliothecadao/torii";
import { getContractByName } from "@dojoengine/core";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Coord, Direction, DirectionName, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { getSeasonAddresses, type Chain } from "@contracts";
import { Account, Call, CallData, RpcProvider, uint256 } from "starknet";
import {
  buildSettlementExecutionPlan,
  deriveSettlementStatus,
  type SettlementSnapshot,
} from "./game-entry-settlement.utils";
import {
  resolveGameEntryBlockingError,
  resolveGameEntryModalPhase,
  type GameEntryModalPhase as ModalPhase,
} from "./game-entry-phase";
import { SeasonPlacementMap, type SeasonPlacementMapSlot } from "./season-placement-map";
import { SeasonPassOptionCard } from "./season-pass-option-card";
import { SettlementPlannerMap } from "./settlement-planner-map";
import { resolveGameEntryTarget } from "./game-entry-navigation";
import {
  SettlementResourceBadges,
  resolvePlannerResourceLabel as resolveResourceLabel,
} from "./settlement-resource-badges";
import { primePlayEntryAssets } from "@/game-entry-preload";
import {
  buildPlannerRealmSelectionDetails,
  resolvePlannerOwnerLabel,
  type PlannerRealmSelectionDetails,
} from "./settlement-planner-selection";
import {
  isSettlementPlannerTargetStillValid,
  type SettlementPlannerOptimisticRealm,
  type SettlementPlannerTarget,
} from "./settlement-planner-utils";
import { useSettlementPlannerData } from "./use-settlement-planner-data";
import { env } from "../../../../../env";

const DEBUG_MODAL = false;
const BLITZ_REALM_SYSTEMS_SELECTOR = "0x3414be5ba2c90784f15eb572e9222b5c83a6865ec0e475a57d7dc18af9b3742";
const REALM_SYSTEMS_SELECTOR = "0x3b4cc14cbb49692c85e1b132ac8536fe7d0d1361cd2fb5ba8df29f726ca02d2";
const SPIRE_SYSTEMS_SELECTOR = "0x3c0936482acd769add8a662a6f1390e50b010607b2995892c17212e37c6afb3";
const ETERNUM_NAMESPACE = "s1_eternum";
const SETTLEMENT_PROGRESS_POLL_MS = 1000;
const SETTLEMENT_PROGRESS_TIMEOUT_MS = 30000;
const CONTRACT_MAP_CENTER = 2147483646;
const NEXT_FREE_REALM_ID_SCAN_LIMIT = 512;
const REALM_OWNER_LOOKUP_ENTRYPOINTS = ["owner_of", "ownerOf"] as const;
const VILLAGE_PASS_DISTRIBUTOR_ADDRESS = "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec";
const VILLAGE_PASS_DISTRIBUTOR_PRIVATE_KEY = "0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912";

const START_DIRECTIONS: ReadonlyArray<readonly [Direction, Direction]> = [
  [Direction.EAST, Direction.SOUTH_WEST],
  [Direction.SOUTH_EAST, Direction.WEST],
  [Direction.SOUTH_WEST, Direction.NORTH_WEST],
  [Direction.WEST, Direction.NORTH_EAST],
  [Direction.NORTH_WEST, Direction.EAST],
  [Direction.NORTH_EAST, Direction.SOUTH_EAST],
];

const debugLog = (_worldName: string | null, ..._args: unknown[]) => {
  if (DEBUG_MODAL) {
    console.log("[GameEntryModal]", ..._args);
  }
};

const extractTransactionHash = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { transaction_hash?: unknown; transactionHash?: unknown };

  if (typeof candidate.transaction_hash === "string" && candidate.transaction_hash.length > 0) {
    return candidate.transaction_hash;
  }

  if (typeof candidate.transactionHash === "string" && candidate.transactionHash.length > 0) {
    return candidate.transactionHash;
  }

  return null;
};

const ALL_VILLAGE_DIRECTIONS: readonly Direction[] = [
  Direction.EAST,
  Direction.NORTH_EAST,
  Direction.NORTH_WEST,
  Direction.WEST,
  Direction.SOUTH_WEST,
  Direction.SOUTH_EAST,
];

const VILLAGE_DIRECTION_LAYOUT: ReadonlyArray<readonly [Direction, number, number]> = [
  [Direction.NORTH_WEST, 1, 1],
  [Direction.NORTH_EAST, 1, 3],
  [Direction.WEST, 2, 1],
  [Direction.EAST, 2, 3],
  [Direction.SOUTH_WEST, 3, 1],
  [Direction.SOUTH_EAST, 3, 3],
];

const VILLAGE_REVEAL_RESOURCE_IDS: readonly number[] = [
  ResourcesIds.Wood,
  ResourcesIds.Stone,
  ResourcesIds.Coal,
  ResourcesIds.Copper,
  ResourcesIds.Obsidian,
  ResourcesIds.Silver,
  ResourcesIds.Ironwood,
  ResourcesIds.ColdIron,
  ResourcesIds.Gold,
  ResourcesIds.Hartwood,
  ResourcesIds.Diamonds,
  ResourcesIds.Sapphire,
  ResourcesIds.Ruby,
  ResourcesIds.DeepCrystal,
  ResourcesIds.Ignium,
  ResourcesIds.EtherealSilica,
  ResourcesIds.TrueIce,
  ResourcesIds.TwilightQuartz,
  ResourcesIds.AlchemicalSilver,
  ResourcesIds.Adamantine,
  ResourcesIds.Mithral,
  ResourcesIds.Dragonhide,
];

const DIRECTION_SLOT_KEY_TO_ENUM: Record<string, Direction> = {
  east: Direction.EAST,
  northeast: Direction.NORTH_EAST,
  northwest: Direction.NORTH_WEST,
  west: Direction.WEST,
  southwest: Direction.SOUTH_WEST,
  southeast: Direction.SOUTH_EAST,
};

const normalizeDirectionSlotKey = (value: string): string => value.replace(/[\s_-]/g, "").toLowerCase();

const hasNonZeroNumericValue = (value: string | null | undefined): boolean => {
  if (!value) return false;
  try {
    return BigInt(value) !== 0n;
  } catch {
    return false;
  }
};

const hasAddressNameValue = (value: unknown): boolean => {
  if (value == null) return false;
  try {
    return BigInt(value as string | number | bigint) !== 0n;
  } catch {
    return true;
  }
};

const parseDirectionSlotValue = (value: unknown): Direction | null => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5) {
    return value as Direction;
  }

  if (typeof value === "string") {
    const normalized = normalizeDirectionSlotKey(value);
    return DIRECTION_SLOT_KEY_TO_ENUM[normalized] ?? null;
  }

  return null;
};

const parseAvailableVillageDirections = (slot: RealmVillageSlot): Set<Direction> => {
  const parsed = new Set<Direction>();
  for (const entry of slot.directions_left) {
    const directEntryDirection = parseDirectionSlotValue(entry);
    if (directEntryDirection != null) {
      parsed.add(directEntryDirection);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    for (const key of Object.keys(entry)) {
      const direction = parseDirectionSlotValue(key);
      if (direction != null) {
        parsed.add(direction);
      }
    }
  }
  return parsed;
};

const resolveRealmAvailableVillageDirections = (
  villageDirectionsByRealmEntityId: Map<number, Set<Direction>>,
  realmEntityId: number | null,
): Set<Direction> => {
  if (realmEntityId == null) return new Set<Direction>();
  const indexedDirections = villageDirectionsByRealmEntityId.get(realmEntityId);
  if (indexedDirections) {
    return indexedDirections;
  }

  // StructureVillageSlots can lag right after realm settlement; default to 6 possible directions
  // and let the settlement system enforce final slot availability.
  return new Set<Direction>(ALL_VILLAGE_DIRECTIONS);
};

const unpackPackedResourceIds = (packedValue: string | number | bigint | null | undefined): number[] => {
  if (packedValue == null) return [];

  let value: bigint;
  try {
    value = typeof packedValue === "bigint" ? packedValue : BigInt(packedValue);
  } catch {
    return [];
  }

  if (value <= 0n) return [];

  const resourceIds: number[] = [];
  let current = value;
  while (current > 0n) {
    const id = Number(current & 0xffn);
    resourceIds.unshift(id);
    current >>= 8n;
  }
  return resourceIds;
};

const resolvePrimaryVillageResource = (packedValue: string | number | bigint | null | undefined): number | null => {
  const resourceIds = unpackPackedResourceIds(packedValue);
  for (const resourceId of resourceIds) {
    if (resolveResourceLabel(resourceId)) {
      return resourceId;
    }
  }
  return null;
};

type SeasonPlacementValidationInput = {
  side: number;
  layer: number;
  point: number;
  layerMax: number | null;
  layersSkipped: number | null;
};

type SeasonPlacementPreview = {
  x: number;
  y: number;
};

type SeasonPlacementSlot = SeasonPlacementMapSlot;

const validateSeasonPlacement = ({
  side,
  layer,
  point,
  layerMax,
  layersSkipped,
}: SeasonPlacementValidationInput): string[] => {
  const errors: string[] = [];

  if (!Number.isInteger(side) || side < 0 || side > 5) {
    errors.push("Side must be an integer between 0 and 5.");
  }

  if (!Number.isInteger(layer) || layer <= 0) {
    errors.push("Layer must be an integer greater than 0.");
  }

  if (!Number.isInteger(point) || point < 0) {
    errors.push("Point must be an integer greater than or equal to 0.");
  }

  if (layerMax == null) {
    errors.push("Layer bounds are unavailable for this world.");
  } else if (layer > layerMax) {
    errors.push(`Layer must be less than or equal to ${layerMax}.`);
  }

  if (layersSkipped != null && layer <= layersSkipped) {
    errors.push(`Layer must be greater than ${layersSkipped}.`);
  }

  if (Number.isInteger(layer) && Number.isInteger(point) && layer > 0 && point > layer - 1) {
    errors.push(`Point must be less than or equal to ${layer - 1} for layer ${layer}.`);
  }

  return errors;
};

const computeSeasonPlacementPreview = ({
  side,
  layer,
  point,
  baseDistance,
  mapCenterOffset,
}: {
  side: number;
  layer: number;
  point: number;
  baseDistance: number;
  mapCenterOffset: number;
}): SeasonPlacementPreview => {
  const [startDirection, triangleDirection] = START_DIRECTIONS[side] ?? START_DIRECTIONS[0];
  const center = CONTRACT_MAP_CENTER - mapCenterOffset;
  const mapCenter = new Coord(center, center);

  const sideFirstLayerOne = mapCenter.travel(startDirection, baseDistance);
  const sideFirstLayerTarget = sideFirstLayerOne.travel(startDirection, baseDistance * (layer - 1));
  const destination = sideFirstLayerTarget.travel(triangleDirection, baseDistance * point);

  return {
    x: destination.x,
    y: destination.y,
  };
};

const mapSeasonSettleError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();
  const failingAddressMatch = raw.match(/address\s*(?:\n|:)?\s*(0x[0-9a-f]+)/i);
  const failingAddress = failingAddressMatch?.[1] ?? null;

  if (message.includes("spire_systems contract not found")) {
    return "Spire system contract not found for this world.";
  }

  if (
    message.includes("unable to read spire settlement status") ||
    message.includes("spire layer distance is unavailable") ||
    message.includes("settlement layer max is unavailable") ||
    message.includes("invalid spire config")
  ) {
    return "Spire config/status unavailable for this world. Refresh and try again.";
  }

  if (message.includes("spire")) {
    return "Spire creation failed. Retry once and verify this world exposes the spire system.";
  }

  if (message.includes("unable to resolve player name")) {
    return "Still loading your player name. Retry settlement in a moment.";
  }

  if (message.includes("name_systems contract not found")) {
    return "Name system contract not found for this world.";
  }

  if (message.includes("unauthorized caller")) {
    return "Season Pass approval missing. Retry to approve and settle in one transaction.";
  }

  if (message.includes("contract not deployed")) {
    if (message.includes("0x2f0b3c571")) {
      return failingAddress
        ? `Village pass contract is not deployed at ${failingAddress}. Update village_pass_config.token_address on-chain.`
        : "Village pass contract is not deployed at village_pass_config.token_address.";
    }
    if (message.includes("0x219209e08")) {
      return failingAddress
        ? `Season pass contract is not deployed at ${failingAddress}.`
        : "Season pass contract is not deployed at the configured address.";
    }
    if (message.includes("0xa69ce1f5")) {
      return failingAddress
        ? `Realm systems contract is not deployed at ${failingAddress}.`
        : "Realm systems contract is not deployed for this world.";
    }
    return failingAddress
      ? `A required settlement contract is not deployed at ${failingAddress}.`
      : "A required settlement contract is not deployed for this world.";
  }

  if (message.includes("occupied")) {
    return "Destination occupied. Choose another side/layer/point.";
  }

  if (message.includes("season is over") || message.includes("settling") || message.includes("timing")) {
    return "Season timing invalid. Settlement is currently unavailable.";
  }

  if (
    message.includes("season pass") ||
    message.includes("erc721") ||
    message.includes("owner") ||
    message.includes("approved") ||
    message.includes("transfer")
  ) {
    return "Season Pass already used or unavailable in this wallet.";
  }

  return "Settlement transaction failed. Please try another placement.";
};

const mapVillageSettleError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (message.includes("unable to resolve player name")) {
    return "Still loading your player name. Retry settlement in a moment.";
  }

  if (message.includes("name_systems contract not found")) {
    return "Name system contract not found for this world.";
  }

  if (message.includes("village_systems contract not found")) {
    return "Village system contract not found for this world.";
  }

  if (message.includes("connected entity is not a realm")) {
    return "Choose a settled realm.";
  }

  if (message.includes("connected realm already has") || message.includes("slot is not available")) {
    return "This direction slot is occupied. Pick another slot.";
  }

  if (message.includes("evp: village token can not be transferred")) {
    return "Village pass transfer blocked by world config. The village_systems contract likely needs DISTRIBUTOR_ROLE on Village Pass.";
  }

  if (message.includes("season is over") || message.includes("settling") || message.includes("timing")) {
    return "Season timing invalid. Village settlement is currently unavailable.";
  }

  if (
    message.includes("village pass") ||
    message.includes("erc721") ||
    message.includes("owner") ||
    message.includes("approved") ||
    message.includes("transfer")
  ) {
    return "Village pass unavailable in this wallet or already consumed.";
  }

  return "Village settlement failed. Please try again.";
};

const mapVillagePassDistributorTransferError = (error: unknown): string => {
  const message = getNormalizedErrorMessage(error);

  if (message.includes("entry point not found") || message.includes("invalid message selector")) {
    return "Village pass contract does not expose transfer entrypoints.";
  }

  if (message.includes("evp: village token can not be transferred")) {
    return "Village pass transfer is restricted for this token.";
  }

  if (message.includes("owner") || message.includes("erc721") || message.includes("transfer")) {
    return "Village pass transfer failed. The selected pass may already be consumed.";
  }

  return "Failed to send village pass from distributor wallet.";
};

const getNormalizedErrorMessage = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();

const isMissingEntrypointError = (message: string): boolean =>
  message.includes("entry point not found") ||
  message.includes("entrypoint not found") ||
  message.includes("requested entrypoint was not found") ||
  message.includes("unknown selector") ||
  message.includes("invalid message selector");

const buildVillagePassTransferFromCall = ({
  villagePassAddress,
  fromAddress,
  toAddress,
  tokenId,
}: {
  villagePassAddress: string;
  fromAddress: string;
  toAddress: string;
  tokenId: bigint;
}) => ({
  contractAddress: villagePassAddress,
  entrypoint: "transfer_from",
  calldata: CallData.compile([fromAddress, toAddress, uint256.bnToUint256(tokenId)]),
});

const buildVillagePassSafeTransferFromCall = ({
  villagePassAddress,
  fromAddress,
  toAddress,
  tokenId,
}: {
  villagePassAddress: string;
  fromAddress: string;
  toAddress: string;
  tokenId: bigint;
}) => ({
  contractAddress: villagePassAddress,
  entrypoint: "safe_transfer_from",
  calldata: CallData.compile([fromAddress, toAddress, uint256.bnToUint256(tokenId), []]),
});

const doesErc721TokenExist = async (
  provider: RpcProvider,
  contractAddress: string,
  tokenId: bigint,
): Promise<boolean> => {
  let missingEntrypointCount = 0;

  for (const entrypoint of REALM_OWNER_LOOKUP_ENTRYPOINTS) {
    try {
      const result = await provider.callContract({
        contractAddress,
        entrypoint,
        calldata: CallData.compile([uint256.bnToUint256(tokenId)]),
      });
      const ownerValue = result?.[0];
      if (!ownerValue) return true;
      return BigInt(ownerValue) !== 0n;
    } catch (error) {
      const normalized = getNormalizedErrorMessage(error);
      if (isMissingEntrypointError(normalized)) {
        missingEntrypointCount += 1;
        continue;
      }

      // owner_of usually reverts for non-existent token IDs.
      return false;
    }
  }

  if (missingEntrypointCount === REALM_OWNER_LOOKUP_ENTRYPOINTS.length) {
    throw new Error("Realm contract does not expose owner lookup.");
  }

  return false;
};

type SpireSettlementPlacement = {
  side: number;
  layer: number;
  point: number;
};

type PendingSpireCreationPlan = {
  includeCenterSpire: boolean;
  settlements: SpireSettlementPlacement[];
  remainingCount: number;
};

const buildSpireSettlementPlacements = (maxSpireLayer: number): SpireSettlementPlacement[] => {
  const placements: SpireSettlementPlacement[] = [];

  for (let layer = 1; layer <= maxSpireLayer; layer += 1) {
    for (let side = 0; side < 6; side += 1) {
      for (let point = 0; point <= layer - 1; point += 1) {
        placements.push({ side, layer, point });
      }
    }
  }

  return placements;
};

const buildPendingSpireCreationPlan = ({
  spiresMaxCount,
  spiresSettledCount,
  spiresLayerDistance,
  settlementLayerMax,
}: {
  spiresMaxCount: number | null;
  spiresSettledCount: number | null;
  spiresLayerDistance: number | null;
  settlementLayerMax: number | null;
}): PendingSpireCreationPlan => {
  const totalSpires = Math.max(0, spiresMaxCount ?? 0);
  const settledSpires = Math.max(0, Math.min(spiresSettledCount ?? 0, totalSpires));
  const remainingCount = Math.max(0, totalSpires - settledSpires);

  if (remainingCount === 0) {
    return {
      includeCenterSpire: false,
      settlements: [],
      remainingCount: 0,
    };
  }

  if (totalSpires === 1) {
    return {
      includeCenterSpire: settledSpires === 0,
      settlements: [],
      remainingCount,
    };
  }

  if (spiresLayerDistance == null || spiresLayerDistance <= 0) {
    throw new Error("Spire layer distance is unavailable for this world.");
  }

  if (settlementLayerMax == null || settlementLayerMax <= 0) {
    throw new Error("Settlement layer max is unavailable for this world.");
  }

  const maxSpireLayer = Math.floor(settlementLayerMax / spiresLayerDistance);
  if (maxSpireLayer <= 0) {
    throw new Error("Invalid spire config: settlement layer max is smaller than spire layer distance.");
  }

  const nonCenterPlacements = buildSpireSettlementPlacements(maxSpireLayer);
  const maxRepresentableSpires = nonCenterPlacements.length + 1; // +1 center spire
  if (totalSpires > maxRepresentableSpires) {
    throw new Error("Invalid spire config: spire max count exceeds representable spire slots.");
  }

  const includeCenterSpire = settledSpires === 0;
  const settledNonCenterCount = Math.max(0, settledSpires - 1);
  const totalNonCenterCount = Math.max(0, totalSpires - 1);
  const remainingNonCenterCount = Math.max(0, totalNonCenterCount - settledNonCenterCount);
  const settlements = nonCenterPlacements.slice(settledNonCenterCount, settledNonCenterCount + remainingNonCenterCount);

  return {
    includeCenterSpire,
    settlements,
    remainingCount,
  };
};

const isRealmAlreadyMintedError = (error: unknown): boolean => {
  const message = getNormalizedErrorMessage(error);
  return message.includes("already minted") || message.includes("already exists") || message.includes("token exists");
};

const isSpiresAlreadySatisfiedError = (error: unknown): boolean => {
  const message = getNormalizedErrorMessage(error);
  return message.includes("all spires have been created") || message.includes("center spire already created");
};

const mapSeasonPassMintError = (error: unknown): string => {
  const message = getNormalizedErrorMessage(error);

  if (message.includes("only realm owner")) {
    return "You can only mint a season pass for a realm ID owned by your wallet.";
  }

  if (message.includes("already minted")) {
    return "A season pass already exists for that realm ID in this wallet.";
  }

  return "Failed to mint realm/season pass. Try another realm ID.";
};

const SEASON_MAP_HEX_RADIUS = 8;
const SEASON_MAP_SQRT3 = Math.sqrt(3);

const toSeasonPlacementSlotId = (side: number, layer: number, point: number): string => `${side}:${layer}:${point}`;

const seasonMapOffsetToPixel = (col: number, row: number): { x: number; y: number } => {
  const hexHeight = SEASON_MAP_HEX_RADIUS * 2;
  const hexWidth = SEASON_MAP_SQRT3 * SEASON_MAP_HEX_RADIUS;
  const verticalDistance = hexHeight * 0.75;
  const horizontalDistance = hexWidth;
  const rowOffset = ((row % 2) * Math.sign(row) * horizontalDistance) / 2;

  return {
    x: col * horizontalDistance - rowOffset,
    y: row * verticalDistance,
  };
};

const buildSeasonPlacementSlots = ({
  layerMax,
  layersSkipped,
  baseDistance,
  mapCenterOffset,
  occupiedCoordLookup,
}: {
  layerMax: number | null;
  layersSkipped: number | null;
  baseDistance: number | null;
  mapCenterOffset: number;
  occupiedCoordLookup: Set<string>;
}): SeasonPlacementSlot[] => {
  if (layerMax == null || layerMax <= 0 || baseDistance == null || baseDistance <= 0) {
    return [];
  }

  const minLayer = Math.max(1, (layersSkipped ?? 0) + 1);
  const center = CONTRACT_MAP_CENTER - mapCenterOffset;
  const slots: SeasonPlacementSlot[] = [];

  for (let layer = minLayer; layer <= layerMax; layer += 1) {
    for (let side = 0; side < 6; side += 1) {
      for (let point = 0; point <= layer - 1; point += 1) {
        const target = computeSeasonPlacementPreview({
          side,
          layer,
          point,
          baseDistance,
          mapCenterOffset,
        });

        const col = target.x - center;
        const row = target.y - center;
        const pixel = seasonMapOffsetToPixel(col, row);
        const coordinateKey = `${target.x}:${target.y}`;

        slots.push({
          id: toSeasonPlacementSlotId(side, layer, point),
          side,
          layer,
          point,
          x: target.x,
          y: target.y,
          pixelX: pixel.x,
          pixelY: pixel.y,
          occupied: occupiedCoordLookup.has(coordinateKey),
        });
      }
    }
  }

  return slots;
};

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

// Types
type BootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";
type SettleStage = "idle" | "assigning" | "settling" | "done" | "error";
type EternumSettlementMode = "realm" | "village";

type OwnedRealmOption = {
  entityId: number;
  realmId: number | null;
  coordX: number;
  coordY: number;
  label: string;
};

type SettleableVillageRealmOption = OwnedRealmOption & {
  freeDirectionCount: number;
};

type VillageDirectionSlot = {
  direction: Direction;
  isAvailable: boolean;
};

type VillageRevealResult = {
  villageEntityId: number;
  resourceId: number;
  resourceLabel: string;
};

// Hyperstructure info type
type HyperstructureInfo = {
  entityId: number;
  initialized: boolean;
  name: string;
};

type SettleFinishValue = {
  coords?: unknown[];
  structure_ids?: unknown[];
};

interface GameEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldName: string;
  chain: Chain;
  isSpectateMode?: boolean;
  /** Eternum entry intent: direct play or settlement flow */
  eternumEntryIntent?: "play" | "settle";
  /** If true, skip settlement and just forge hyperstructures, then close */
  isForgeMode?: boolean;
  /** Number of hyperstructures left to forge (for forge mode) */
  numHyperstructuresLeft?: number;
}

const BOOTSTRAP_TASKS: BootstrapTask[] = [
  { id: "world", label: "Selecting world", status: "pending" },
  { id: "manifest", label: "Loading game config", status: "pending" },
  { id: "dojo", label: "Connecting to world", status: "pending" },
  { id: "sync", label: "Syncing game state", status: "pending" },
  { id: "renderer", label: "Preparing graphics", status: "pending" },
];

const SETTLEMENT_STEPS = [
  { id: 1, label: "Assign Positions", icon: MapPin, description: "Finding optimal locations for your realms" },
  { id: 2, label: "Create Realms", icon: Castle, description: "Building your realm structures" },
  { id: 3, label: "Start Labor", icon: Pickaxe, description: "Initializing resource production" },
];

/**
 * Settlement phase - shows settlement wizard
 */
const SettlementPhase = ({
  stage,
  assignedCount,
  settledCount,
  isSettling,
  onSettle,
  onEnterGame,
}: {
  stage: SettleStage;
  assignedCount: number;
  settledCount: number;
  isSettling: boolean;
  onSettle: () => void;
  onEnterGame: () => void;
}) => {
  const remainingToSettle = Math.max(0, assignedCount - settledCount);
  const progress = assignedCount > 0 ? (settledCount / assignedCount) * 100 : 0;
  const isComplete = stage === "done" || (assignedCount > 0 && remainingToSettle === 0);

  const getStepStatus = (stepId: number): "pending" | "active" | "complete" => {
    if (stepId === 1) {
      if (assignedCount > 0) return "complete";
      if (stage === "assigning") return "active";
      return "pending";
    }
    if (stepId === 2) {
      if (assignedCount === 0) return "pending";
      if (remainingToSettle === 0 && settledCount > 0) return "complete";
      if (stage === "settling" || (remainingToSettle > 0 && settledCount > 0)) return "active";
      return "pending";
    }
    if (stepId === 3) {
      if (remainingToSettle === 0 && settledCount > 0 && stage === "done") return "complete";
      if (stage === "settling" && remainingToSettle <= 1) return "active";
      return "pending";
    }
    return "pending";
  };

  return (
    <div className="flex flex-col">
      <div className="text-center mb-4">
        <img src="/images/logos/eternum-loader.png" className="mx-auto w-20 mb-3" alt="Settlement" />
        <h2 className="text-lg font-semibold text-gold">
          {isComplete ? "Settlement Complete!" : "Settlement Progress"}
        </h2>
        <p className="text-xs text-gold/60 mt-1">
          {isComplete
            ? "Your realms are ready. Enter the arena!"
            : "Your realm location will be automatically assigned for balanced gameplay"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2 mb-4">
        <div className="h-2 bg-brown/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-gold/80 to-gold rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        {assignedCount > 0 && (
          <div className="flex justify-between text-xs text-gold/70">
            <span>
              {settledCount} / {assignedCount} realms settled
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-4">
        {SETTLEMENT_STEPS.map((step) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                status === "active"
                  ? "bg-gold/10 border border-gold/30"
                  : status === "complete"
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "opacity-50",
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  status === "complete"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : status === "active"
                      ? "bg-gold/20 text-gold"
                      : "bg-brown/30 text-gold/50",
                )}
              >
                {status === "complete" ? (
                  <Check className="w-4 h-4" />
                ) : status === "active" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      status === "complete" ? "text-emerald-400" : status === "active" ? "text-gold" : "text-gold/50",
                    )}
                  >
                    {step.label}
                  </span>
                  {status === "active" && (
                    <span className="text-[10px] text-gold/60 animate-pulse">In progress...</span>
                  )}
                </div>
                <p className="text-xs text-gold/50 truncate">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action button */}
      {isComplete ? (
        <Button onClick={onEnterGame} className="w-full h-11 !text-brown !bg-gold rounded-md" forceUppercase={false}>
          <div className="flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            <span>Enter Game</span>
          </div>
        </Button>
      ) : (
        <Button
          onClick={onSettle}
          disabled={isSettling}
          className="w-full h-11 !text-brown !bg-gold rounded-md"
          forceUppercase={false}
        >
          {isSettling ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Settling...</span>
            </div>
          ) : remainingToSettle > 0 ? (
            <div className="flex items-center justify-center gap-2">
              <Castle className="w-4 h-4" />
              <span>Continue Settlement ({remainingToSettle} remaining)</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <TreasureChest className="w-4 h-4 fill-brown" />
              <span>Start Settlement</span>
            </div>
          )}
        </Button>
      )}

      {stage === "error" && (
        <p className="text-xs text-red-300 text-center mt-2">Settlement failed. Please try again.</p>
      )}
    </div>
  );
};

type SeasonPlacement = {
  side: number;
  layer: number;
  point: number;
};

const DEFAULT_SEASON_PLACEMENT: SeasonPlacement = {
  side: 0,
  layer: 1,
  point: 0,
};

const SeasonPassRequiredPhase = ({
  onGetSeasonPass,
  onSwitchToVillageMode,
  showVillageShortcut,
  canUseSandboxMintFlow,
  mintRealmTokenIdInput,
  onMintRealmTokenIdInputChange,
  onAutoSelectNextRealmTokenId,
  isAutoSelectingNextRealmTokenId,
  autoSelectNextRealmTokenIdError,
  onMintRealmAndSeasonPass,
  isMintingRealmAndSeasonPass,
  mintRealmAndSeasonPassError,
  onRefreshSeasonPassInventory,
  isRefreshingSeasonPassInventory,
  seasonPassInventoryError,
}: {
  onGetSeasonPass: () => void;
  onSwitchToVillageMode?: () => void;
  showVillageShortcut?: boolean;
  canUseSandboxMintFlow: boolean;
  mintRealmTokenIdInput: string;
  onMintRealmTokenIdInputChange: (value: string) => void;
  onAutoSelectNextRealmTokenId: () => void;
  isAutoSelectingNextRealmTokenId: boolean;
  autoSelectNextRealmTokenIdError: string | null;
  onMintRealmAndSeasonPass: () => void;
  isMintingRealmAndSeasonPass: boolean;
  mintRealmAndSeasonPassError: string | null;
  onRefreshSeasonPassInventory: () => void;
  isRefreshingSeasonPassInventory: boolean;
  seasonPassInventoryError: string | null;
}) => {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mx-auto w-16 h-16 mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-300" />
      </div>
      <h2 className="text-lg font-semibold text-gold mb-2">Season Pass Required</h2>
      <p className="text-xs text-gold/60 mb-4">
        You need at least one Season Pass in your wallet before you can settle in Eternum Seasons.
      </p>
      <Button onClick={onGetSeasonPass} className="w-full h-11 !text-brown !bg-gold rounded-md" forceUppercase={false}>
        <div className="flex items-center justify-center gap-2">
          <ExternalLink className="w-4 h-4" />
          <span>Get a Season Pass</span>
        </div>
      </Button>
      <Button
        onClick={onRefreshSeasonPassInventory}
        disabled={isRefreshingSeasonPassInventory}
        variant="outline"
        className="w-full h-9 mt-2"
        forceUppercase={false}
      >
        <div className="flex items-center justify-center gap-2">
          {isRefreshingSeasonPassInventory ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span>Refresh Pass Status</span>
          )}
        </div>
      </Button>
      {seasonPassInventoryError && <p className="mt-2 text-[11px] text-amber-200/80">{seasonPassInventoryError}</p>}
      {showVillageShortcut && onSwitchToVillageMode && (
        <Button onClick={onSwitchToVillageMode} variant="outline" className="w-full h-9 mt-2" forceUppercase={false}>
          Use Village Pass Instead
        </Button>
      )}
      {canUseSandboxMintFlow && (
        <div className="mt-3 w-full rounded-md border border-gold/25 bg-black/20 p-3 text-left">
          <p className="text-[11px] text-gold/70 mb-2">
            Sandbox shortcut: mint a mock realm and a season pass for the same realm ID.
          </p>
          <label className="block text-[11px] text-gold/70 mb-2">
            Realm ID
            <input
              type="text"
              inputMode="numeric"
              value={mintRealmTokenIdInput}
              onChange={(event) => onMintRealmTokenIdInputChange(event.target.value)}
              className="mt-1 w-full rounded-md border border-gold/20 bg-black/30 px-2 py-1.5 text-sm text-gold"
              placeholder="e.g. 1"
            />
          </label>
          <Button
            onClick={onAutoSelectNextRealmTokenId}
            disabled={isAutoSelectingNextRealmTokenId || isMintingRealmAndSeasonPass}
            variant="outline"
            className="w-full h-9 mb-2"
            forceUppercase={false}
          >
            <div className="flex items-center justify-center gap-2">
              {isAutoSelectingNextRealmTokenId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isAutoSelectingNextRealmTokenId ? "Finding..." : "Auto-select Next Free ID"}</span>
            </div>
          </Button>
          <Button
            onClick={onMintRealmAndSeasonPass}
            disabled={isMintingRealmAndSeasonPass}
            className="w-full h-10 !text-brown !bg-emerald-400 rounded-md"
            forceUppercase={false}
          >
            <div className="flex items-center justify-center gap-2">
              {isMintingRealmAndSeasonPass ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Castle className="w-4 h-4" />
              )}
              <span>{isMintingRealmAndSeasonPass ? "Minting..." : "Mint Realm + Season Pass"}</span>
            </div>
          </Button>
          {autoSelectNextRealmTokenIdError && (
            <p className="mt-2 text-[11px] text-amber-200/90">{autoSelectNextRealmTokenIdError}</p>
          )}
          {mintRealmAndSeasonPassError && (
            <p className="mt-2 text-[11px] text-red-200/90">{mintRealmAndSeasonPassError}</p>
          )}
        </div>
      )}
    </div>
  );
};

const SeasonPlacementPhase = ({
  placement,
  onPlacementChange,
  canSettle,
  seasonTimingValid,
  spiresSettled,
  spiresSettledCount,
  spiresMaxCount,
  hasSeasonPass,
  seasonPassBalance,
  seasonPasses,
  selectedSeasonPassTokenId,
  onSelectSeasonPass,
  onConfirmSettlement,
  isSubmittingSettlement,
  placementValidationErrors,
  targetCoordPreview,
  settlementError,
  layerMax,
  layersSkipped,
  settlementBaseDistance,
  mapCenterOffset,
  occupiedCoordKeys,
  isLoadingOccupiedSlots,
  occupiedSlotsError,
  seasonPassInventoryError,
}: {
  placement: SeasonPlacement;
  onPlacementChange: (next: SeasonPlacement) => void;
  canSettle: boolean;
  seasonTimingValid: boolean;
  spiresSettled: boolean;
  spiresSettledCount: number | null;
  spiresMaxCount: number | null;
  hasSeasonPass: boolean;
  seasonPassBalance: bigint;
  seasonPasses: SeasonPassInventoryItem[];
  selectedSeasonPassTokenId: bigint | null;
  onSelectSeasonPass: (tokenId: bigint | null) => void;
  onConfirmSettlement: () => void;
  isSubmittingSettlement: boolean;
  placementValidationErrors: string[];
  targetCoordPreview: SeasonPlacementPreview | null;
  settlementError: string | null;
  layerMax: number | null;
  layersSkipped: number | null;
  settlementBaseDistance: number | null;
  mapCenterOffset: number | null;
  occupiedCoordKeys: string[];
  isLoadingOccupiedSlots: boolean;
  occupiedSlotsError: string | null;
  seasonPassInventoryError: string | null;
}) => {
  const selectedSeasonPass = seasonPasses.find((pass) => pass.tokenId === selectedSeasonPassTokenId) ?? null;
  const [manualSeasonPassTokenInput, setManualSeasonPassTokenInput] = useState("");
  const [manualSeasonPassTokenError, setManualSeasonPassTokenError] = useState<string | null>(null);
  const minLayer = Math.max(1, (layersSkipped ?? 0) + 1);
  const maxPointForLayer = Math.max(0, placement.layer - 1);
  const canSubmit =
    selectedSeasonPassTokenId != null && canSettle && placementValidationErrors.length === 0 && !isSubmittingSettlement;
  const submitLabel = isSubmittingSettlement
    ? spiresSettled
      ? "Settling..."
      : "Creating Spires + Settling..."
    : spiresSettled
      ? "Settle Realm"
      : "Create Spires + Settle Realm";
  const spiresProgressLabel =
    spiresSettledCount != null && spiresMaxCount != null
      ? `${Math.min(spiresSettledCount, spiresMaxCount)} / ${spiresMaxCount}`
      : "unknown";
  const checks = [
    { id: "season", label: "Season timing valid", ok: seasonTimingValid },
    { id: "spires", label: `Spires settled (${spiresProgressLabel})`, ok: spiresSettled },
    { id: "pass", label: "Season pass present", ok: hasSeasonPass },
  ];
  const occupiedCoordLookup = useMemo(() => new Set(occupiedCoordKeys), [occupiedCoordKeys]);
  const placementSlots = useMemo(
    () =>
      buildSeasonPlacementSlots({
        layerMax,
        layersSkipped,
        baseDistance: settlementBaseDistance,
        mapCenterOffset: mapCenterOffset ?? 0,
        occupiedCoordLookup,
      }),
    [layerMax, layersSkipped, settlementBaseDistance, mapCenterOffset, occupiedCoordLookup],
  );
  const selectedSlotId = toSeasonPlacementSlotId(placement.side, placement.layer, placement.point);
  const selectedPlacementSlot = useMemo(
    () => placementSlots.find((slot) => slot.id === selectedSlotId) ?? null,
    [placementSlots, selectedSlotId],
  );

  useEffect(() => {
    if (selectedSeasonPassTokenId == null) return;
    setManualSeasonPassTokenInput(selectedSeasonPassTokenId.toString());
    setManualSeasonPassTokenError(null);
  }, [selectedSeasonPassTokenId]);

  const selectedPassDisplay = selectedSeasonPass
    ? `${selectedSeasonPass.realmName} (Realm #${selectedSeasonPass.realmId})`
    : selectedSeasonPassTokenId != null
      ? `Token #${selectedSeasonPassTokenId.toString()}`
      : "No pass selected";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/images/logos/eternum-loader.png" className="w-12" alt="Season settlement" />
          <div>
            <h2 className="text-lg font-semibold text-gold">Choose Settlement Placement</h2>
            <p className="text-xs text-gold/65">Claim your realm position and settle with the selected season pass.</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] text-gold/85">
          <span className="font-semibold">Step 2 / 3</span>
          <span className="text-gold/60">Pass + Placement</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <section className="rounded-xl border border-gold/25 bg-gradient-to-b from-[#1a140b]/95 via-[#100d08]/95 to-[#0b0906]/95 p-3 md:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gold">War Map Placement</p>
              <p className="text-[11px] text-gold/60">
                Click any valid hex to populate <span className="text-gold/85">side / layer / point</span>.
              </p>
            </div>
            <span className="rounded-full border border-gold/25 bg-black/25 px-2 py-1 text-[10px] text-gold/70">
              side (0-5), layer (ring), point (0..layer-1)
            </span>
          </div>

          <SeasonPlacementMap
            slots={placementSlots}
            selectedSlotId={selectedSlotId}
            onSelectSlot={(slot) =>
              onPlacementChange({
                ...placement,
                side: slot.side,
                layer: slot.layer,
                point: slot.point,
              })
            }
            showInstructions={false}
            tone="gold"
            mapHeightClassName="h-[320px] md:h-[430px]"
          />

          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="text-xs text-gold/70">
              Side
              <input
                type="number"
                min={0}
                max={5}
                value={placement.side}
                onChange={(event) =>
                  onPlacementChange({
                    ...placement,
                    side: Number(event.target.value || 0),
                  })
                }
                className="mt-1 w-full rounded-md border border-gold/20 bg-black/30 px-2 py-1 text-sm text-gold"
              />
            </label>
            <label className="text-xs text-gold/70">
              Layer
              <input
                type="number"
                min={minLayer}
                max={layerMax ?? undefined}
                value={placement.layer}
                onChange={(event) =>
                  onPlacementChange({
                    ...placement,
                    layer: Number(event.target.value || 0),
                  })
                }
                className="mt-1 w-full rounded-md border border-gold/20 bg-black/30 px-2 py-1 text-sm text-gold"
              />
            </label>
            <label className="text-xs text-gold/70">
              Point
              <input
                type="number"
                min={0}
                max={maxPointForLayer}
                value={placement.point}
                onChange={(event) =>
                  onPlacementChange({
                    ...placement,
                    point: Number(event.target.value || 0),
                  })
                }
                className="mt-1 w-full rounded-md border border-gold/20 bg-black/30 px-2 py-1 text-sm text-gold"
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {selectedPlacementSlot ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5">
                <p className="text-xs text-emerald-200">
                  Selected hex: side {selectedPlacementSlot.side}, layer {selectedPlacementSlot.layer}, point{" "}
                  {selectedPlacementSlot.point}
                  {" · "}x {selectedPlacementSlot.x}, y {selectedPlacementSlot.y}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-gold/20 bg-black/20 px-2 py-1.5">
                <p className="text-xs text-gold/65">No hex selected yet.</p>
              </div>
            )}
            <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5">
              <p className="text-xs text-emerald-200">
                Target coordinate:{" "}
                {targetCoordPreview ? (
                  <>
                    <span className="text-emerald-100">x {targetCoordPreview.x}</span>,{" "}
                    <span className="text-emerald-100">y {targetCoordPreview.y}</span>
                  </>
                ) : (
                  <span className="text-emerald-100/80">waiting for valid side/layer/point</span>
                )}
              </p>
            </div>
          </div>

          {isLoadingOccupiedSlots && (
            <p className="mt-2 text-[11px] text-gold/60">Loading occupied settlement slots...</p>
          )}
          {occupiedSlotsError && <p className="mt-2 text-[11px] text-amber-200/80">{occupiedSlotsError}</p>}
        </section>

        <aside className="flex flex-col gap-3 rounded-xl border border-gold/25 bg-gradient-to-b from-black/45 to-black/25 p-3 md:p-4">
          <div>
            <p className="text-sm font-semibold text-gold">Season Pass Selection</p>
            <p className="text-[11px] text-gold/60">Pick the pass bound to the realm you want to settle.</p>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
            {seasonPasses.map((pass) => {
              const isSelected = selectedSeasonPassTokenId === pass.tokenId;
              return (
                <SeasonPassOptionCard
                  key={pass.tokenId.toString()}
                  pass={pass}
                  isSelected={isSelected}
                  onSelect={onSelectSeasonPass}
                />
              );
            })}
          </div>

          {seasonPasses.length === 0 && seasonPassBalance > 0n && (
            <details className="rounded-md border border-gold/25 bg-black/25 p-3" open>
              <summary className="cursor-pointer text-[11px] font-semibold text-gold/80">
                Can&apos;t see my pass?
              </summary>
              <p className="mt-2 text-[11px] text-gold/65">
                Token enumeration is unavailable for this contract. Enter a season pass token ID manually.
              </p>
              <label className="mt-2 block text-[11px] text-gold/70">
                Season Pass Token ID (Realm ID)
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualSeasonPassTokenInput}
                  onChange={(event) => {
                    setManualSeasonPassTokenInput(event.target.value);
                    setManualSeasonPassTokenError(null);
                  }}
                  className="mt-1 w-full rounded-md border border-gold/20 bg-black/30 px-2 py-1.5 text-sm text-gold"
                  placeholder="e.g. 1"
                />
              </label>
              <Button
                onClick={() => {
                  const value = manualSeasonPassTokenInput.trim();
                  if (value.length === 0) {
                    setManualSeasonPassTokenError("Enter a token ID.");
                    return;
                  }
                  try {
                    const parsed = BigInt(value);
                    if (parsed < 0n) {
                      setManualSeasonPassTokenError("Token ID cannot be negative.");
                      return;
                    }
                    onSelectSeasonPass(parsed);
                    setManualSeasonPassTokenError(null);
                  } catch {
                    setManualSeasonPassTokenError("Token ID must be a valid integer.");
                  }
                }}
                className="mt-2 h-9 w-full !rounded-md !bg-gold !text-brown"
                forceUppercase={false}
              >
                Use Token ID
              </Button>
              {manualSeasonPassTokenError && (
                <p className="mt-2 text-[11px] text-red-200/90">{manualSeasonPassTokenError}</p>
              )}
            </details>
          )}

          <div className="rounded-md border border-gold/25 bg-black/25 px-2 py-1.5">
            <p className="text-[11px] text-gold/60">Selected pass</p>
            <p className="text-xs text-gold">{selectedPassDisplay}</p>
            {selectedSeasonPass && (
              <SettlementResourceBadges resourceIds={selectedSeasonPass.resourceIds} className="mt-2" />
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            {checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  "flex items-center justify-between rounded-md border px-2 py-1.5",
                  check.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/25 bg-red-500/10",
                )}
              >
                <span className={cn("text-xs", check.ok ? "text-emerald-200" : "text-red-200")}>{check.label}</span>
                {check.ok ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-red-300" />}
              </div>
            ))}
          </div>

          {seasonPassInventoryError && (
            <p className="text-[11px] text-amber-200/80">
              Could not refresh season pass metadata. Try reopening the modal.
            </p>
          )}
          {!spiresSettled && (
            <p className="text-[11px] text-amber-200/85">
              Spires are not settled yet. Settlement will submit spire creation first, then create your realm.
            </p>
          )}
        </aside>
      </div>

      {placementValidationErrors.length > 0 && (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2">
          {placementValidationErrors.map((placementError, index) => (
            <p key={`${placementError}-${index}`} className="text-xs text-red-200">
              {placementError}
            </p>
          ))}
        </div>
      )}

      {settlementError && <p className="text-[11px] text-red-200">{settlementError}</p>}

      <div className="sticky bottom-0 z-10 rounded-xl border border-gold/30 bg-gradient-to-r from-[#1a1309]/95 via-[#20170c]/95 to-[#120d07]/95 px-3 py-3 shadow-[0_-10px_25px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gold/75">
            <span className="rounded border border-gold/25 bg-black/25 px-2 py-1">Pass: {selectedPassDisplay}</span>
            <span className="rounded border border-gold/25 bg-black/25 px-2 py-1">Side {placement.side}</span>
            <span className="rounded border border-gold/25 bg-black/25 px-2 py-1">Layer {placement.layer}</span>
            <span className="rounded border border-gold/25 bg-black/25 px-2 py-1">Point {placement.point}</span>
          </div>
          <Button
            disabled={!canSubmit}
            onClick={onConfirmSettlement}
            className="h-11 w-full min-w-[190px] !rounded-md !bg-gold !text-brown md:w-auto"
            forceUppercase={false}
          >
            <div className="flex items-center justify-center gap-2">
              {isSubmittingSettlement ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              <span>{submitLabel}</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

const VillagePassDistributorPanel = ({
  distributorAddress,
  distributorBalance,
  distributorPasses,
  isLoadingDistributorInventory,
  distributorInventoryError,
  onSendVillagePassToConnectedWallet,
  isSendingVillagePass,
  sendVillagePassError,
  isWalletConnected,
}: {
  distributorAddress: string;
  distributorBalance: bigint;
  distributorPasses: VillagePassInventoryItem[];
  isLoadingDistributorInventory: boolean;
  distributorInventoryError: string | null;
  onSendVillagePassToConnectedWallet: () => void;
  isSendingVillagePass: boolean;
  sendVillagePassError: string | null;
  isWalletConnected: boolean;
}) => {
  const nextTransferTokenId = distributorPasses[0]?.tokenId ?? null;
  const hasTransferableVillagePass = distributorBalance > 0n && nextTransferTokenId != null;
  const distributorLabel = `${distributorAddress.slice(0, 8)}...${distributorAddress.slice(-6)}`;
  const transferDisabled = !isWalletConnected || !hasTransferableVillagePass || isSendingVillagePass;

  return (
    <section className="w-full rounded-xl border border-gold/25 bg-gradient-to-b from-black/45 to-black/25 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gold">Village Pass Distributor</p>
        <span className="rounded border border-gold/30 bg-black/30 px-2 py-1 text-[11px] text-gold/80">
          {distributorBalance.toString()} pass{distributorBalance === 1n ? "" : "es"}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gold/60">
        Distributor wallet <span className="font-mono text-gold/80">{distributorLabel}</span>
      </p>

      {nextTransferTokenId != null && (
        <p className="mt-2 text-[11px] text-gold/70">
          Next pass to send: <span className="text-gold">#{nextTransferTokenId.toString()}</span>
        </p>
      )}
      {isLoadingDistributorInventory && (
        <p className="mt-2 text-[11px] text-gold/60">Refreshing distributor balance…</p>
      )}
      {distributorInventoryError && <p className="mt-2 text-[11px] text-amber-200/85">{distributorInventoryError}</p>}
      {!isWalletConnected && (
        <p className="mt-2 text-[11px] text-amber-200/85">Connect your wallet to receive a village pass.</p>
      )}
      {!hasTransferableVillagePass && !isLoadingDistributorInventory && (
        <p className="mt-2 text-[11px] text-amber-200/85">No transferable village pass is currently available.</p>
      )}
      {sendVillagePassError && <p className="mt-2 text-[11px] text-red-200">{sendVillagePassError}</p>}

      <Button
        onClick={onSendVillagePassToConnectedWallet}
        disabled={transferDisabled}
        className="mt-3 h-10 w-full !bg-gold !text-brown rounded-md"
        forceUppercase={false}
      >
        <div className="flex items-center justify-center gap-2">
          {isSendingVillagePass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span>{isSendingVillagePass ? "Sending Village Pass..." : "Send 1 Village Pass to My Wallet"}</span>
        </div>
      </Button>
    </section>
  );
};

const VillagePassRequiredPhase = ({
  distributorAddress,
  distributorBalance,
  distributorPasses,
  isLoadingDistributorInventory,
  distributorInventoryError,
  onSendVillagePassToConnectedWallet,
  isSendingVillagePass,
  sendVillagePassError,
  isWalletConnected,
  onGetVillagePass,
  onSwitchToRealmMode,
  showRealmShortcut,
}: {
  distributorAddress: string;
  distributorBalance: bigint;
  distributorPasses: VillagePassInventoryItem[];
  isLoadingDistributorInventory: boolean;
  distributorInventoryError: string | null;
  onSendVillagePassToConnectedWallet: () => void;
  isSendingVillagePass: boolean;
  sendVillagePassError: string | null;
  isWalletConnected: boolean;
  onGetVillagePass: () => void;
  onSwitchToRealmMode?: () => void;
  showRealmShortcut?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-300" />
        </div>
        <h2 className="text-lg font-semibold text-gold mb-2">Village Pass Required</h2>
        <p className="text-xs text-gold/60">
          You need at least one Village Pass to settle a village in Eternum Seasons.
        </p>
      </div>

      <VillagePassDistributorPanel
        distributorAddress={distributorAddress}
        distributorBalance={distributorBalance}
        distributorPasses={distributorPasses}
        isLoadingDistributorInventory={isLoadingDistributorInventory}
        distributorInventoryError={distributorInventoryError}
        onSendVillagePassToConnectedWallet={onSendVillagePassToConnectedWallet}
        isSendingVillagePass={isSendingVillagePass}
        sendVillagePassError={sendVillagePassError}
        isWalletConnected={isWalletConnected}
      />

      <Button
        onClick={onGetVillagePass}
        className="w-full h-10 !text-brown !bg-gold/80 rounded-md"
        forceUppercase={false}
      >
        <div className="flex items-center justify-center gap-2">
          <ExternalLink className="w-4 h-4" />
          <span>Open Marketplace</span>
        </div>
      </Button>

      {showRealmShortcut && onSwitchToRealmMode && (
        <Button onClick={onSwitchToRealmMode} variant="outline" className="w-full h-9" forceUppercase={false}>
          Use Realm Pass Instead
        </Button>
      )}
    </div>
  );
};

const VillagePlacementPhase = ({
  villagePassBalance,
  villagePasses,
  distributorAddress,
  distributorBalance,
  distributorPasses,
  isLoadingDistributorInventory,
  distributorInventoryError,
  onSendVillagePassToConnectedWallet,
  isSendingVillagePass,
  sendVillagePassError,
  isWalletConnected,
  selectedVillagePassTokenId,
  onSelectVillagePass,
  settleableRealms,
  selectedRealmEntityId,
  onSelectRealmEntityId,
  directionSlots,
  selectedDirection,
  onSelectDirection,
  onConfirmSettlement,
  isSubmittingSettlement,
  settlementError,
  villagePassInventoryError,
  villageSlotsError,
}: {
  villagePassBalance: bigint;
  villagePasses: VillagePassInventoryItem[];
  distributorAddress: string;
  distributorBalance: bigint;
  distributorPasses: VillagePassInventoryItem[];
  isLoadingDistributorInventory: boolean;
  distributorInventoryError: string | null;
  onSendVillagePassToConnectedWallet: () => void;
  isSendingVillagePass: boolean;
  sendVillagePassError: string | null;
  isWalletConnected: boolean;
  selectedVillagePassTokenId: bigint | null;
  onSelectVillagePass: (tokenId: bigint) => void;
  settleableRealms: SettleableVillageRealmOption[];
  selectedRealmEntityId: number | null;
  onSelectRealmEntityId: (realmEntityId: number | null) => void;
  directionSlots: VillageDirectionSlot[];
  selectedDirection: Direction | null;
  onSelectDirection: (direction: Direction | null) => void;
  onConfirmSettlement: () => void;
  isSubmittingSettlement: boolean;
  settlementError: string | null;
  villagePassInventoryError: string | null;
  villageSlotsError: string | null;
}) => {
  const selectedRealm = settleableRealms.find((realm) => realm.entityId === selectedRealmEntityId) ?? null;
  const directionSlotLookup = useMemo(
    () => new Map(directionSlots.map((slot) => [slot.direction, slot])),
    [directionSlots],
  );
  const selectedDirectionSlot = selectedDirection != null ? directionSlotLookup.get(selectedDirection) : null;
  const canSubmit =
    selectedVillagePassTokenId != null &&
    selectedRealmEntityId != null &&
    selectedDirection != null &&
    selectedDirectionSlot?.isAvailable === true &&
    !isSubmittingSettlement;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <img src="/images/logos/eternum-loader.png" className="w-12" alt="Village settlement" />
        <div>
          <h2 className="text-lg font-semibold text-gold">Settle Village Pass</h2>
          <p className="text-xs text-gold/65">Attach each pass to one of your settled realms and choose a free slot.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.5fr)]">
        <section className="rounded-xl border border-gold/25 bg-gradient-to-b from-black/45 to-black/25 p-3 md:p-4">
          <div>
            <p className="text-sm font-semibold text-gold">Village Pass Selection</p>
            <p className="text-[11px] text-gold/60">Select the token ID to consume for settlement.</p>
          </div>

          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
            {villagePasses.map((pass) => {
              const isSelected = selectedVillagePassTokenId === pass.tokenId;
              return (
                <div
                  key={pass.tokenId.toString()}
                  className={cn(
                    "rounded-lg border p-2 transition-colors",
                    isSelected ? "border-gold/55 bg-gold/15" : "border-gold/20 bg-black/25 hover:border-gold/35",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-gold">Village Pass #{pass.tokenId.toString()}</p>
                    <Button
                      onClick={() => onSelectVillagePass(pass.tokenId)}
                      variant={isSelected ? "default" : "outline"}
                      size="xs"
                      forceUppercase={false}
                      className={cn(isSelected ? "!bg-gold !text-brown" : "")}
                    >
                      {isSelected ? "Selected" : "Use"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {villagePasses.length === 0 && villagePassBalance > 0n && (
            <p className="mt-3 text-[11px] text-amber-200/80">
              Village pass detected, but token enumeration is unavailable for this contract.
            </p>
          )}
          {villagePassInventoryError && (
            <p className="mt-2 text-[11px] text-amber-200/80">{villagePassInventoryError}</p>
          )}
        </section>

        <section className="rounded-xl border border-gold/25 bg-gradient-to-b from-[#1a140b]/95 via-[#100d08]/95 to-[#0b0906]/95 p-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gold">Realm + Direction</p>
              <p className="text-[11px] text-gold/60">Available directions are highlighted in green.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] text-gold/85">
              <span className="font-semibold">Step 3 / 3</span>
              <span className="text-gold/60">Village Placement</span>
            </div>
          </div>

          <label className="mt-3 block text-xs text-gold/70">
            Settled Realm
            <select
              value={selectedRealmEntityId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  onSelectRealmEntityId(null);
                  return;
                }
                onSelectRealmEntityId(Number(value));
              }}
              className="mt-1 w-full rounded-md border border-gold/20 bg-black/30 px-2 py-1.5 text-sm text-gold"
            >
              <option value="">Select a realm</option>
              {settleableRealms.map((realm) => (
                <option key={realm.entityId} value={realm.entityId}>
                  {realm.label} · {realm.freeDirectionCount}/6 free slots
                </option>
              ))}
            </select>
          </label>

          {settleableRealms.length === 0 && (
            <p className="mt-2 text-[11px] text-amber-200/85">
              No settled realm currently has a free village slot. Each realm supports up to 6 village slots.
            </p>
          )}
          {villageSlotsError && <p className="mt-2 text-[11px] text-amber-200/85">{villageSlotsError}</p>}

          <div className="mt-4 rounded-lg border border-gold/20 bg-black/20 p-3">
            <div className="grid grid-cols-3 grid-rows-3 gap-2">
              {VILLAGE_DIRECTION_LAYOUT.map(([direction, row, column]) => {
                const slot = directionSlotLookup.get(direction);
                const isAvailable = slot?.isAvailable ?? false;
                const isSelected = selectedDirection === direction;
                return (
                  <button
                    key={direction}
                    type="button"
                    style={{ gridRow: row, gridColumn: column }}
                    disabled={!isAvailable}
                    onClick={() => onSelectDirection(direction)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-xs transition-colors",
                      isAvailable
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                        : "border-red-500/30 bg-red-500/10 text-red-200/80 cursor-not-allowed",
                      isSelected && isAvailable && "border-gold/70 bg-gold/20 text-gold",
                    )}
                  >
                    <span className="block font-semibold">{DirectionName[direction]}</span>
                    <span className="text-[10px] opacity-80">{isAvailable ? "Free" : "Occupied"}</span>
                  </button>
                );
              })}
              <div className="col-start-2 row-start-2 flex items-center justify-center rounded-md border border-gold/25 bg-black/35 px-2 py-2 text-center text-[11px] text-gold/80">
                {selectedRealm ? (
                  <span>
                    Realm #{selectedRealm.realmId ?? "?"}
                    <br />
                    Entity {selectedRealm.entityId}
                  </span>
                ) : (
                  <span>Select realm</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <VillagePassDistributorPanel
        distributorAddress={distributorAddress}
        distributorBalance={distributorBalance}
        distributorPasses={distributorPasses}
        isLoadingDistributorInventory={isLoadingDistributorInventory}
        distributorInventoryError={distributorInventoryError}
        onSendVillagePassToConnectedWallet={onSendVillagePassToConnectedWallet}
        isSendingVillagePass={isSendingVillagePass}
        sendVillagePassError={sendVillagePassError}
        isWalletConnected={isWalletConnected}
      />

      {settlementError && <p className="text-[11px] text-red-200">{settlementError}</p>}

      <div className="sticky bottom-0 z-10 rounded-xl border border-gold/30 bg-gradient-to-r from-[#1a1309]/95 via-[#20170c]/95 to-[#120d07]/95 px-3 py-3 shadow-[0_-10px_25px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gold/75">
            <span className="rounded border border-gold/25 bg-black/25 px-2 py-1">
              Pass: {selectedVillagePassTokenId != null ? `#${selectedVillagePassTokenId.toString()}` : "None"}
            </span>
            <span className="rounded border border-gold/25 bg-black/25 px-2 py-1">
              Realm: {selectedRealm ? `#${selectedRealm.realmId ?? "?"}` : "None"}
            </span>
            <span className="rounded border border-gold/25 bg-black/25 px-2 py-1">
              Direction: {selectedDirection != null ? DirectionName[selectedDirection] : "None"}
            </span>
          </div>
          <Button
            disabled={!canSubmit}
            onClick={onConfirmSettlement}
            className="h-11 w-full min-w-[190px] !rounded-md !bg-gold !text-brown md:w-auto"
            forceUppercase={false}
          >
            <div className="flex items-center justify-center gap-2">
              {isSubmittingSettlement ? <Loader2 className="h-4 w-4 animate-spin" /> : <Castle className="h-4 w-4" />}
              <span>{isSubmittingSettlement ? "Settling Village..." : "Settle Village"}</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

const SettlementPlannerPhase = ({
  plannerData,
  selectedTarget,
  onSelectTarget,
  isLoadingPlanner,
  plannerDataError,
  plannerConflict,
  plannerSuccess,
  seasonTimingValid,
  spiresSettled,
  spiresSettledCount,
  spiresMaxCount,
  canEnterGame,
  seasonPassBalance,
  seasonPasses,
  selectedSeasonPassTokenId,
  onSelectSeasonPass,
  onRefreshSeasonPassInventory,
  isRefreshingSeasonPassInventory,
  seasonPassInventoryError,
  villagePassBalance,
  villagePasses,
  selectedVillagePassTokenId,
  onSelectVillagePass,
  onRefreshVillagePassInventory,
  isRefreshingVillagePassInventory,
  villagePassInventoryError,
  distributorAddress,
  distributorBalance,
  distributorPasses,
  isLoadingDistributorInventory,
  distributorInventoryError,
  onSendVillagePassToConnectedWallet,
  isSendingVillagePass,
  sendVillagePassError,
  isWalletConnected,
  onGetSeasonPass,
  onGetVillagePass,
  canUseSandboxMintFlow,
  mintRealmTokenIdInput,
  onMintRealmTokenIdInputChange,
  onAutoSelectNextRealmTokenId,
  isAutoSelectingNextRealmTokenId,
  autoSelectNextRealmTokenIdError,
  onMintRealmAndSeasonPass,
  isMintingRealmAndSeasonPass,
  mintRealmAndSeasonPassError,
  onConfirmRealmSettlement,
  onConfirmVillageSettlement,
  isSubmittingRealmSettlement,
  isSubmittingVillageSettlement,
  seasonSettlementError,
  villageSettlementError,
  onEnterGame,
  plannerComponents,
}: {
  plannerData: ReturnType<typeof useSettlementPlannerData>;
  selectedTarget: SettlementPlannerTarget | null;
  onSelectTarget: (target: SettlementPlannerTarget) => void;
  isLoadingPlanner: boolean;
  plannerDataError: string | null;
  plannerConflict: string | null;
  plannerSuccess: string | null;
  seasonTimingValid: boolean;
  spiresSettled: boolean;
  spiresSettledCount: number | null;
  spiresMaxCount: number | null;
  canEnterGame: boolean;
  seasonPassBalance: bigint;
  seasonPasses: SeasonPassInventoryItem[];
  selectedSeasonPassTokenId: bigint | null;
  onSelectSeasonPass: (tokenId: bigint | null) => void;
  onRefreshSeasonPassInventory: () => void;
  isRefreshingSeasonPassInventory: boolean;
  seasonPassInventoryError: string | null;
  villagePassBalance: bigint;
  villagePasses: VillagePassInventoryItem[];
  selectedVillagePassTokenId: bigint | null;
  onSelectVillagePass: (tokenId: bigint) => void;
  onRefreshVillagePassInventory: () => void;
  isRefreshingVillagePassInventory: boolean;
  villagePassInventoryError: string | null;
  distributorAddress: string;
  distributorBalance: bigint;
  distributorPasses: VillagePassInventoryItem[];
  isLoadingDistributorInventory: boolean;
  distributorInventoryError: string | null;
  onSendVillagePassToConnectedWallet: () => void;
  isSendingVillagePass: boolean;
  sendVillagePassError: string | null;
  isWalletConnected: boolean;
  onGetSeasonPass: () => void;
  onGetVillagePass: () => void;
  canUseSandboxMintFlow: boolean;
  mintRealmTokenIdInput: string;
  onMintRealmTokenIdInputChange: (value: string) => void;
  onAutoSelectNextRealmTokenId: () => void;
  isAutoSelectingNextRealmTokenId: boolean;
  autoSelectNextRealmTokenIdError: string | null;
  onMintRealmAndSeasonPass: () => void;
  isMintingRealmAndSeasonPass: boolean;
  mintRealmAndSeasonPassError: string | null;
  onConfirmRealmSettlement: () => void;
  onConfirmVillageSettlement: () => void;
  isSubmittingRealmSettlement: boolean;
  isSubmittingVillageSettlement: boolean;
  seasonSettlementError: string | null;
  villageSettlementError: string | null;
  onEnterGame: () => void;
  plannerComponents: SetupResult["components"] | null;
}) => {
  const selectedRealmInfo = selectedTarget?.type === "realm" ? selectedTarget.realm : null;
  const selectedRealmSlot = selectedTarget?.type === "realm_slot" ? selectedTarget.slot : null;
  const selectedVillageSlot = selectedTarget?.type === "village_slot" ? selectedTarget.slot : null;
  const selectedOccupiedTarget = selectedTarget?.type === "occupied_target" ? selectedTarget : null;
  const selectedTerrainTile = selectedTarget?.type === "terrain" ? selectedTarget.tile : null;
  const selectedPlannerRealm =
    selectedVillageSlot != null
      ? (plannerData.realms.find((realm) => realm.entityId === selectedVillageSlot.realmEntityId) ?? null)
      : selectedRealmInfo;
  const selectedSeasonPass = seasonPasses.find((pass) => pass.tokenId === selectedSeasonPassTokenId) ?? null;
  const selectedVillagePass = villagePasses.find((pass) => pass.tokenId === selectedVillagePassTokenId) ?? null;
  const plannerAction = selectedRealmSlot != null ? "realm" : selectedVillageSlot != null ? "village" : "info";
  const spiresProgressLabel =
    spiresSettledCount != null && spiresMaxCount != null
      ? `${Math.min(spiresSettledCount, spiresMaxCount)} / ${spiresMaxCount}`
      : "unknown";
  const selectedPlannerRealmLiveInfo = useMemo(() => {
    if (!plannerComponents) return null;

    const realmEntityId = selectedPlannerRealm?.entityId ?? selectedRealmInfo?.entityId ?? null;
    if (realmEntityId == null) return null;
    return getRealmInfo(getEntityIdFromKeys([BigInt(realmEntityId)]), plannerComponents) ?? null;
  }, [plannerComponents, selectedPlannerRealm?.entityId, selectedRealmInfo?.entityId]);
  const selectedPlannerRealmDetails = useMemo<PlannerRealmSelectionDetails | null>(() => {
    return buildPlannerRealmSelectionDetails({
      sourceRealm: selectedPlannerRealm ?? selectedRealmInfo,
      liveRealm:
        selectedPlannerRealmLiveInfo == null
          ? null
          : {
              realmId: selectedPlannerRealmLiveInfo.realmId,
              owner: selectedPlannerRealmLiveInfo.owner,
              ownerName: selectedPlannerRealmLiveInfo.ownerName,
              resources: selectedPlannerRealmLiveInfo.resources,
            },
    });
  }, [selectedPlannerRealm, selectedPlannerRealmLiveInfo, selectedRealmInfo]);
  const selectedPlannerOwnerLabel = resolvePlannerOwnerLabel(
    selectedPlannerRealmDetails?.ownerName,
    selectedPlannerRealmDetails?.ownerAddress,
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
      <SettlementPlannerMap
        plannerData={plannerData}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        isLoading={isLoadingPlanner}
        mapHeightClassName="h-[380px] md:h-[min(56vh,560px)]"
      />

      <aside className="flex min-h-0 flex-col gap-3 rounded-2xl border border-gold/25 bg-gradient-to-b from-[#181108]/95 via-[#120d07]/95 to-[#090603]/95 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gold">Action Panel</p>
            <p className="text-[11px] text-gold/60">
              {selectedTarget
                ? plannerAction === "realm"
                  ? "Realm settlement is driven by the selected hex."
                  : plannerAction === "village"
                    ? "Village settlement is driven by the selected slot."
                    : "Inspect the current map target."
                : "Select a map target to settle or inspect it."}
            </p>
          </div>
          {canEnterGame && (
            <Button onClick={onEnterGame} className="h-9 !rounded-md !bg-gold !text-brown" forceUppercase={false}>
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                <span>Enter Game</span>
              </div>
            </Button>
          )}
        </div>

        {plannerSuccess && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            {plannerSuccess}
          </div>
        )}
        {plannerConflict && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {plannerConflict}
          </div>
        )}
        {plannerDataError && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {plannerDataError}
          </div>
        )}

        {!selectedTarget && (
          <div className="rounded-xl border border-gold/20 bg-black/25 p-3">
            <p className="text-sm font-semibold text-gold">Choose your next move</p>
            <p className="mt-2 text-xs text-gold/70">
              Free realm hexes create realms. Free slots around any settled realm create villages. Busy targets stay
              visible so you can plan around them.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-gold/75">
              <div className="rounded-md border border-gold/20 bg-black/25 px-2 py-1.5">
                Season timing: {seasonTimingValid ? "open" : "closed"}
              </div>
              <div className="rounded-md border border-gold/20 bg-black/25 px-2 py-1.5">
                Realm settlement auto-creates missing spires when needed.
              </div>
              <div className="rounded-md border border-gold/20 bg-black/25 px-2 py-1.5">
                Village settlement works on any realm with a free slot.
              </div>
            </div>
          </div>
        )}

        {selectedRealmSlot && (
          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-xl border border-gold/20 bg-black/25 p-3">
              <p className="text-sm font-semibold text-gold">Settle Realm</p>
              <p className="mt-1 text-xs text-gold/70">
                Side {selectedRealmSlot.side}, layer {selectedRealmSlot.layer}, point {selectedRealmSlot.point}
              </p>
              <p className="mt-1 text-[11px] text-gold/60">
                Target coordinate: x {selectedRealmSlot.coordX}, y {selectedRealmSlot.coordY}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 text-[11px]">
              <div
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  seasonTimingValid
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-red-500/25 bg-red-500/10 text-red-200",
                )}
              >
                Season timing: {seasonTimingValid ? "ready" : "closed"}
              </div>
              <div
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  spiresSettled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-amber-400/30 bg-amber-500/10 text-amber-100",
                )}
              >
                Spires settled: {spiresSettled ? "ready" : `auto-create on submit (${spiresProgressLabel})`}
              </div>
              <div
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  selectedSeasonPassTokenId != null
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-red-500/25 bg-red-500/10 text-red-200",
                )}
              >
                Season pass:{" "}
                {selectedSeasonPass
                  ? `${selectedSeasonPass.realmName} (Realm #${selectedSeasonPass.realmId})`
                  : selectedSeasonPassTokenId != null
                    ? `#${selectedSeasonPassTokenId.toString()}`
                    : "missing"}
              </div>
            </div>

            {selectedSeasonPassTokenId != null ? (
              <div className="min-h-0 rounded-xl border border-gold/20 bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gold">Season Pass</p>
                  <Button
                    onClick={onRefreshSeasonPassInventory}
                    disabled={isRefreshingSeasonPassInventory}
                    variant="outline"
                    size="xs"
                    forceUppercase={false}
                  >
                    {isRefreshingSeasonPassInventory ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
                  {seasonPasses.map((pass) => {
                    const isSelected = selectedSeasonPassTokenId === pass.tokenId;
                    return (
                      <SeasonPassOptionCard
                        key={pass.tokenId.toString()}
                        pass={pass}
                        isSelected={isSelected}
                        onSelect={onSelectSeasonPass}
                        className="bg-black/30"
                      />
                    );
                  })}
                </div>
                {selectedSeasonPass && (
                  <div className="mt-2 rounded-lg border border-gold/20 bg-black/20 px-3 py-2">
                    <p className="text-[11px] text-gold/70">
                      Selected pass: {selectedSeasonPass.realmName} (Realm #{selectedSeasonPass.realmId})
                    </p>
                    <SettlementResourceBadges resourceIds={selectedSeasonPass.resourceIds} className="mt-2" />
                  </div>
                )}
                {seasonPassInventoryError && (
                  <p className="mt-2 text-[11px] text-amber-200/85">{seasonPassInventoryError}</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3">
                <p className="text-sm font-semibold text-gold">Season Pass Needed</p>
                <p className="mt-1 text-xs text-gold/70">
                  Keep this realm hex selected, then add a season pass and come straight back to confirm.
                </p>
                <Button
                  onClick={onGetSeasonPass}
                  className="mt-3 h-10 w-full !rounded-md !bg-gold !text-brown"
                  forceUppercase={false}
                >
                  <div className="flex items-center justify-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <span>Get a Season Pass</span>
                  </div>
                </Button>
                <Button
                  onClick={onRefreshSeasonPassInventory}
                  disabled={isRefreshingSeasonPassInventory}
                  variant="outline"
                  className="mt-2 h-9 w-full"
                  forceUppercase={false}
                >
                  {isRefreshingSeasonPassInventory ? "Refreshing..." : "Refresh Pass Status"}
                </Button>
                {canUseSandboxMintFlow && (
                  <div className="mt-3 rounded-lg border border-gold/20 bg-black/25 p-3">
                    <p className="text-[11px] text-gold/70">Sandbox shortcut: mint a mock realm and season pass.</p>
                    <label className="mt-2 block text-[11px] text-gold/70">
                      Realm ID
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mintRealmTokenIdInput}
                        onChange={(event) => onMintRealmTokenIdInputChange(event.target.value)}
                        className="mt-1 w-full rounded-md border border-gold/20 bg-black/30 px-2 py-1.5 text-sm text-gold"
                      />
                    </label>
                    <Button
                      onClick={onAutoSelectNextRealmTokenId}
                      disabled={isAutoSelectingNextRealmTokenId || isMintingRealmAndSeasonPass}
                      variant="outline"
                      className="mt-2 h-9 w-full"
                      forceUppercase={false}
                    >
                      {isAutoSelectingNextRealmTokenId ? "Finding..." : "Auto-select Next Free ID"}
                    </Button>
                    <Button
                      onClick={onMintRealmAndSeasonPass}
                      disabled={isMintingRealmAndSeasonPass}
                      className="mt-2 h-10 w-full !rounded-md !bg-emerald-400 !text-brown"
                      forceUppercase={false}
                    >
                      {isMintingRealmAndSeasonPass ? "Minting..." : "Mint Realm + Season Pass"}
                    </Button>
                    {autoSelectNextRealmTokenIdError && (
                      <p className="mt-2 text-[11px] text-amber-200/85">{autoSelectNextRealmTokenIdError}</p>
                    )}
                    {mintRealmAndSeasonPassError && (
                      <p className="mt-2 text-[11px] text-red-200">{mintRealmAndSeasonPassError}</p>
                    )}
                  </div>
                )}
                {seasonPassBalance > 0n && seasonPasses.length === 0 && (
                  <p className="mt-2 text-[11px] text-amber-100/85">
                    A season pass is detected but token enumeration is unavailable for this wallet.
                  </p>
                )}
              </div>
            )}

            {seasonSettlementError && <p className="text-[11px] text-red-200">{seasonSettlementError}</p>}

            <Button
              onClick={onConfirmRealmSettlement}
              disabled={!seasonTimingValid || selectedSeasonPassTokenId == null || isSubmittingRealmSettlement}
              className="h-11 w-full !rounded-md !bg-gold !text-brown"
              forceUppercase={false}
            >
              <div className="flex items-center justify-center gap-2">
                {isSubmittingRealmSettlement ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Castle className="h-4 w-4" />
                )}
                <span>{isSubmittingRealmSettlement ? "Settling Realm..." : "Settle Realm"}</span>
              </div>
            </Button>
          </div>
        )}

        {selectedVillageSlot && (
          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-xl border border-gold/20 bg-black/25 p-3">
              <p className="text-sm font-semibold text-gold">Settle Village</p>
              <p className="mt-1 text-xs text-gold/70">
                {selectedPlannerRealmDetails?.realmId != null
                  ? `Realm #${selectedPlannerRealmDetails.realmId}`
                  : "Realm target"}{" "}
                · {DirectionName[selectedVillageSlot.direction]}
              </p>
              {selectedPlannerRealmDetails?.realmName && (
                <p className="mt-1 text-sm text-gold">{selectedPlannerRealmDetails.realmName}</p>
              )}
              <p className="mt-1 text-[11px] text-gold/60">Owner: {selectedPlannerOwnerLabel}</p>
              <p className="mt-1 text-[11px] text-gold/60">
                Coordinate: x {selectedVillageSlot.coordX}, y {selectedVillageSlot.coordY}
              </p>
              <div className="mt-3 rounded-lg border border-gold/20 bg-black/20 px-3 py-2">
                <p className="text-[11px] text-gold/60">Realm resources</p>
                <SettlementResourceBadges
                  resourceIds={selectedPlannerRealmDetails?.resourceIds ?? []}
                  className="mt-2"
                  emptyLabel="Realm resources unavailable."
                />
              </div>
            </div>

            {selectedVillagePassTokenId != null ? (
              <div className="min-h-0 rounded-xl border border-gold/20 bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gold">Village Pass</p>
                  <Button
                    onClick={onRefreshVillagePassInventory}
                    disabled={isRefreshingVillagePassInventory}
                    variant="outline"
                    size="xs"
                    forceUppercase={false}
                  >
                    {isRefreshingVillagePassInventory ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
                  {villagePasses.map((pass) => {
                    const isSelected = selectedVillagePassTokenId === pass.tokenId;
                    return (
                      <button
                        key={pass.tokenId.toString()}
                        type="button"
                        onClick={() => onSelectVillagePass(pass.tokenId)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                          isSelected ? "border-gold/55 bg-gold/15" : "border-gold/20 bg-black/30 hover:border-gold/35",
                        )}
                      >
                        <p className="text-sm text-gold">Village Pass #{pass.tokenId.toString()}</p>
                      </button>
                    );
                  })}
                </div>
                {selectedVillagePass && (
                  <p className="mt-2 text-[11px] text-gold/70">
                    Selected pass: #{selectedVillagePass.tokenId.toString()}
                  </p>
                )}
                {villagePassInventoryError && (
                  <p className="mt-2 text-[11px] text-amber-200/85">{villagePassInventoryError}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3">
                  <p className="text-sm font-semibold text-gold">Village Pass Needed</p>
                  <p className="mt-1 text-xs text-gold/70">
                    Keep this slot selected, then add a village pass and confirm from the same map target.
                  </p>
                  <Button
                    onClick={onGetVillagePass}
                    className="mt-3 h-10 w-full !rounded-md !bg-gold !text-brown"
                    forceUppercase={false}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      <span>Open Marketplace</span>
                    </div>
                  </Button>
                </div>
                <VillagePassDistributorPanel
                  distributorAddress={distributorAddress}
                  distributorBalance={distributorBalance}
                  distributorPasses={distributorPasses}
                  isLoadingDistributorInventory={isLoadingDistributorInventory}
                  distributorInventoryError={distributorInventoryError}
                  onSendVillagePassToConnectedWallet={onSendVillagePassToConnectedWallet}
                  isSendingVillagePass={isSendingVillagePass}
                  sendVillagePassError={sendVillagePassError}
                  isWalletConnected={isWalletConnected}
                />
                {villagePassBalance > 0n && villagePasses.length === 0 && (
                  <p className="text-[11px] text-amber-100/85">
                    A village pass is detected but token enumeration is unavailable for this wallet.
                  </p>
                )}
              </div>
            )}

            {villageSettlementError && <p className="text-[11px] text-red-200">{villageSettlementError}</p>}

            <Button
              onClick={onConfirmVillageSettlement}
              disabled={!seasonTimingValid || selectedVillagePassTokenId == null || isSubmittingVillageSettlement}
              className="h-11 w-full !rounded-md !bg-gold !text-brown"
              forceUppercase={false}
            >
              <div className="flex items-center justify-center gap-2">
                {isSubmittingVillageSettlement ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Castle className="h-4 w-4" />
                )}
                <span>{isSubmittingVillageSettlement ? "Settling Village..." : "Settle Village"}</span>
              </div>
            </Button>
          </div>
        )}

        {selectedRealmInfo && (
          <div className="rounded-xl border border-gold/20 bg-black/25 p-3">
            <p className="text-sm font-semibold text-gold">
              {selectedPlannerRealmDetails?.realmName ??
                (selectedRealmInfo.realmId != null ? `Realm #${selectedRealmInfo.realmId}` : "Settled Realm")}
            </p>
            <p className="mt-1 text-xs text-gold/70">
              {selectedPlannerRealmDetails?.realmId != null
                ? `Realm #${selectedPlannerRealmDetails.realmId}`
                : "Settled Realm"}
            </p>
            <p className="mt-1 text-[11px] text-gold/60">Owner: {selectedPlannerOwnerLabel}</p>
            <div className="mt-3 rounded-lg border border-gold/20 bg-black/20 px-3 py-2">
              <p className="text-[11px] text-gold/60">Realm resources</p>
              <SettlementResourceBadges
                resourceIds={selectedPlannerRealmDetails?.resourceIds ?? []}
                className="mt-2"
                emptyLabel="Realm resources unavailable."
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gold/75">
              <div className="rounded-md border border-gold/20 bg-black/25 px-2 py-1.5">
                Villages: {selectedRealmInfo.villagesCount}
              </div>
              <div className="rounded-md border border-gold/20 bg-black/25 px-2 py-1.5">
                Free slots: {selectedRealmInfo.freeDirectionCount}
              </div>
            </div>
            {selectedRealmInfo.optimistic && (
              <p className="mt-2 text-[11px] text-amber-100/85">
                This realm is newly settled and still syncing. Its village slots will become actionable once indexed.
              </p>
            )}
          </div>
        )}

        {selectedOccupiedTarget && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3">
            <p className="text-sm font-semibold text-gold">
              {selectedOccupiedTarget.occupiedType === "realm_slot" ? "Realm Hex Occupied" : "Village Slot Busy"}
            </p>
            {"direction" in selectedOccupiedTarget.slot && selectedOccupiedTarget.slot.pending ? (
              <p className="mt-2 text-xs text-gold/70">
                This realm was just settled. Wait for sync to finish before village slots become actionable.
              </p>
            ) : (
              <p className="mt-2 text-xs text-gold/70">
                This target is already taken. Inspect it on the map, then choose another free location.
              </p>
            )}
          </div>
        )}

        {selectedTerrainTile && (
          <div className="rounded-xl border border-gold/20 bg-black/25 p-3">
            <p className="text-sm font-semibold text-gold">Explored Hex</p>
            <p className="mt-1 text-xs text-gold/70">
              Coordinate x {selectedTerrainTile.coordX}, y {selectedTerrainTile.coordY}
            </p>
            <p className="mt-1 text-[11px] text-gold/60">Biome index {selectedTerrainTile.biome}</p>
          </div>
        )}
      </aside>
    </div>
  );
};

const VillageRevealPhase = ({
  result,
  onEnterGame,
  onSettleAnotherVillage,
}: {
  result: VillageRevealResult;
  onEnterGame: () => void;
  onSettleAnotherVillage: () => void;
}) => {
  const reelLabels = useMemo(
    () =>
      VILLAGE_REVEAL_RESOURCE_IDS.map((resourceId) => resolveResourceLabel(resourceId)).filter(
        (resourceLabel): resourceLabel is string => Boolean(resourceLabel),
      ),
    [],
  );
  const initialRevealLabel = reelLabels[0] ?? result.resourceLabel;
  const [displayedResourceLabel, setDisplayedResourceLabel] = useState(initialRevealLabel);
  const [spinning, setSpinning] = useState(true);

  useEffect(() => {
    const spinSequence = [...reelLabels.filter((label) => label !== result.resourceLabel), result.resourceLabel];
    let tick = 0;
    const intervalId = window.setInterval(() => {
      setDisplayedResourceLabel(spinSequence[tick % spinSequence.length] ?? result.resourceLabel);
      tick += 1;
    }, 110);

    const stopTimerId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      setDisplayedResourceLabel(result.resourceLabel);
      setSpinning(false);
    }, 2600);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(stopTimerId);
    };
  }, [result.resourceLabel, result.villageEntityId, reelLabels]);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mx-auto w-16 h-16 mb-3 rounded-full bg-gold/20 flex items-center justify-center">
        <TreasureChest className="w-8 h-8 fill-gold text-gold" />
      </div>
      <h2 className="text-lg font-semibold text-gold mb-1">
        {spinning ? "Revealing Village Resource..." : "Village Resource Revealed"}
      </h2>
      <p className="text-xs text-gold/60 mb-4">
        {spinning ? "Resolving on-chain assignment from Torii..." : `Your village produces ${displayedResourceLabel}.`}
      </p>

      <motion.div
        className="w-36 rounded-xl border border-gold/35 bg-gradient-to-b from-black/45 to-black/25 px-4 py-5"
        animate={spinning ? { rotateY: [0, 90, 180, 270, 360] } : { rotateY: 0 }}
        transition={{
          duration: spinning ? 0.45 : 0.2,
          repeat: spinning ? Infinity : 0,
          ease: "linear",
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <ResourceIcon resource={displayedResourceLabel} size="xl" withTooltip={false} />
          <p className="text-sm font-semibold text-gold">{displayedResourceLabel}</p>
        </div>
      </motion.div>

      {!spinning && (
        <>
          <div className="mt-4 w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left">
            <p className="text-xs text-emerald-100">
              Your village produces <span className="font-semibold">{result.resourceLabel}</span>.
            </p>
            <p className="text-[11px] text-emerald-200/80 mt-1">Village entity #{result.villageEntityId}</p>
          </div>
          <Button
            onClick={onEnterGame}
            className="mt-4 w-full h-11 !text-brown !bg-gold rounded-md"
            forceUppercase={false}
          >
            <div className="flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              <span>Play</span>
            </div>
          </Button>
          <Button
            onClick={onSettleAnotherVillage}
            variant="outline"
            className="mt-2 w-full h-10"
            forceUppercase={false}
          >
            Settle Another Village
          </Button>
        </>
      )}
    </div>
  );
};

/**
 * Hyperstructure initialization phase - shows hyperstructures that need to be initialized
 */
const HyperstructurePhase = ({
  hyperstructures,
  isInitializing,
  currentInitializingId,
  onInitialize,
  onInitializeAll,
}: {
  hyperstructures: HyperstructureInfo[];
  isInitializing: boolean;
  currentInitializingId: number | null;
  onInitialize: (entityId: number) => void;
  onInitializeAll: () => void;
}) => {
  const uninitializedCount = hyperstructures.filter((h) => !h.initialized).length;
  const initializedCount = hyperstructures.length - uninitializedCount;
  const progress = hyperstructures.length > 0 ? (initializedCount / hyperstructures.length) * 100 : 0;
  const allInitialized = uninitializedCount === 0;

  return (
    <div className="flex flex-col">
      <div className="text-center mb-4">
        <div className="mx-auto w-16 h-16 mb-3 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-gold">
          {allInitialized ? "Hyperstructures Ready!" : "Initialize Hyperstructures"}
        </h2>
        <p className="text-xs text-gold/60 mt-1">
          {allInitialized
            ? "All hyperstructures have been activated. Ready to settle!"
            : "Hyperstructures must be activated before you can settle your realms"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2 mb-4">
        <div className="h-2 bg-brown/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500/80 to-amber-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between text-xs text-gold/70">
          <span>
            {initializedCount} / {hyperstructures.length} initialized
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Hyperstructure list */}
      {!allInitialized && (
        <div className="space-y-2 mb-4 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
          {hyperstructures.map((hs) => (
            <div
              key={hs.entityId}
              className={cn(
                "flex items-center justify-between gap-2 p-2 rounded-lg transition-colors",
                hs.initialized
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : currentInitializingId === hs.entityId
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-white/5 border border-white/10",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                    hs.initialized
                      ? "bg-emerald-500/20 text-emerald-400"
                      : currentInitializingId === hs.entityId
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-brown/30 text-gold/50",
                  )}
                >
                  {hs.initialized ? (
                    <Check className="w-3 h-3" />
                  ) : currentInitializingId === hs.entityId ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm truncate",
                    hs.initialized
                      ? "text-emerald-400"
                      : currentInitializingId === hs.entityId
                        ? "text-amber-400"
                        : "text-gold/70",
                  )}
                >
                  {hs.name}
                </span>
              </div>
              {!hs.initialized && currentInitializingId !== hs.entityId && (
                <Button
                  onClick={() => onInitialize(hs.entityId)}
                  disabled={isInitializing}
                  variant="outline"
                  size="xs"
                  className="flex-shrink-0"
                >
                  Initialize
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action button */}
      {!allInitialized && uninitializedCount > 1 && (
        <Button
          onClick={onInitializeAll}
          disabled={isInitializing}
          className="w-full h-11 !text-brown !bg-gold rounded-md mb-2"
          forceUppercase={false}
        >
          {isInitializing ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Initializing...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Initialize All ({uninitializedCount})</span>
            </div>
          )}
        </Button>
      )}

      {allInitialized && (
        <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
          <Check className="w-4 h-4" />
          <span>Proceeding to settlement...</span>
        </div>
      )}
    </div>
  );
};

/**
 * Forge hyperstructures phase - creates new hyperstructures during registration period
 * This is different from initialization - forging creates new ones, initializing activates existing ones
 */
const ForgeHyperstructuresPhase = ({
  numHyperstructuresLeft,
  isForging,
  onForge,
  onClose,
}: {
  numHyperstructuresLeft: number;
  isForging: boolean;
  onForge: () => void;
  onClose: () => void;
}) => {
  const allForged = numHyperstructuresLeft <= 0;

  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-4">
        <div className="mx-auto w-16 h-16 mb-3 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-gold">
          {allForged ? "All Hyperstructures Forged!" : "Forge Hyperstructures"}
        </h2>
        <p className="text-xs text-gold/60 mt-1">
          {allForged
            ? "All hyperstructures have been created for this game."
            : "Create hyperstructures for the upcoming game. Anyone can forge them!"}
        </p>
      </div>

      {!allForged && (
        <>
          {/* Forge button - golden orb style similar to HyperstructureForge */}
          <motion.button
            onClick={onForge}
            disabled={isForging}
            initial={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-24 h-24 rounded-full cursor-pointer transform-gpu disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-yellow-300/50 mb-4"
            style={{
              background: "radial-gradient(circle at 30% 30%, #facc15, #ca8a04, #f59e0b)",
              boxShadow:
                "0 8px 32px rgba(251, 191, 36, 0.4), inset 0 2px 8px rgba(255, 255, 255, 0.4), inset 0 -2px 8px rgba(0, 0, 0, 0.1)",
              border: "4px solid #fef3c7",
            }}
          >
            {/* Ripple Effect */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-yellow-400/40"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.6, 0, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Content */}
            <div className="flex items-center justify-center w-full h-full text-4xl font-black text-amber-900">
              {isForging ? (
                <motion.img
                  src="/images/logos/eternum-loader.png"
                  className="w-8 h-8"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <motion.span
                  key={numHyperstructuresLeft}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {numHyperstructuresLeft}
                </motion.span>
              )}
            </div>

            {/* Sparkles */}
            {!isForging && (
              <>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-white rounded-full"
                    style={{
                      top: `${20 + i * 20}%`,
                      left: `${10 + i * 30}%`,
                    }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </>
            )}
          </motion.button>

          <p className="text-xs text-gold/50 text-center mb-4">
            Click to forge {numHyperstructuresLeft} hyperstructure{numHyperstructuresLeft !== 1 ? "s" : ""}
          </p>
        </>
      )}

      {/* Close button */}
      <Button variant="outline" onClick={onClose} className="w-full" forceUppercase={false}>
        {allForged ? "Done" : "Close"}
      </Button>
    </div>
  );
};

/**
 * Main GameEntryModal component
 */
export const GameEntryModal = ({
  isOpen,
  onClose,
  worldName,
  chain,
  isSpectateMode = false,
  eternumEntryIntent = "play",
  isForgeMode = false,
  numHyperstructuresLeft: initialNumHyperstructuresLeft,
}: GameEntryModalProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const syncProgress = useSyncStore((state) => state.initialSyncProgress);
  const account = useAccountStore((state) => state.account);
  const { usernameFelt } = useUsername();
  const playerFeltAddress = useMemo(() => {
    if (!account?.address) return null;
    try {
      return toPaddedFeltAddress(account.address);
    } catch {
      return null;
    }
  }, [account?.address]);

  const worldAvailabilityInputs = useMemo(() => [{ name: worldName, chain }], [worldName, chain]);
  const { results: worldAvailabilityResults, isAnyLoading: isCheckingWorldAvailability } = useWorldsAvailability(
    worldAvailabilityInputs,
    isOpen && Boolean(worldName),
    playerFeltAddress,
  );
  const worldAvailability = worldAvailabilityResults.get(getWorldKey({ name: worldName, chain }));
  const worldMeta = worldAvailability?.meta ?? null;
  const worldMode = worldMeta?.mode ?? "unknown";
  const isBlitzMode = worldMode === "blitz";
  const isEternumMode = worldMode === "eternum";
  const unifiedSettlementPlannerEnabled = env.VITE_PUBLIC_ETERNUM_UNIFIED_SETTLEMENT_PLANNER;

  // Bootstrap state
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>("idle");
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);

  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);
  const [tasks, setTasks] = useState<BootstrapTask[]>(BOOTSTRAP_TASKS);

  // Settlement state
  const [settleStage, setSettleStage] = useState<SettleStage>("idle");
  const [isSettling, setIsSettling] = useState(false);
  const [assignedRealmCount, setAssignedRealmCount] = useState(0);
  const [settledRealmCount, setSettledRealmCount] = useState(0);
  const [needsSettlement, setNeedsSettlement] = useState(false);
  const [settlementCheckComplete, setSettlementCheckComplete] = useState(false);

  // Hyperstructure state
  const [hyperstructures, setHyperstructures] = useState<HyperstructureInfo[]>([]);
  const [needsHyperstructureInit, setNeedsHyperstructureInit] = useState(false);
  const [hyperstructureCheckComplete, setHyperstructureCheckComplete] = useState(false);
  const [isInitializingHyperstructure, setIsInitializingHyperstructure] = useState(false);
  const [currentInitializingId, setCurrentInitializingId] = useState<number | null>(null);

  // Forge hyperstructures state (for creating new ones during registration)
  const [numHyperstructuresLeft, setNumHyperstructuresLeft] = useState(initialNumHyperstructuresLeft ?? 0);
  const [isForging, setIsForging] = useState(false);
  const [eternumSettlementMode, setEternumSettlementMode] = useState<EternumSettlementMode>("realm");
  const [seasonPlacement, setSeasonPlacement] = useState<SeasonPlacement>(DEFAULT_SEASON_PLACEMENT);
  const [selectedSeasonPassTokenId, setSelectedSeasonPassTokenId] = useState<bigint | null>(null);
  const [isSubmittingSeasonSettlement, setIsSubmittingSeasonSettlement] = useState(false);
  const [seasonSettlementError, setSeasonSettlementError] = useState<string | null>(null);
  const [seasonSettlementComplete, setSeasonSettlementComplete] = useState(false);
  const [selectedVillagePassTokenId, setSelectedVillagePassTokenId] = useState<bigint | null>(null);
  const [selectedVillageRealmEntityId, setSelectedVillageRealmEntityId] = useState<number | null>(null);
  const [selectedVillageDirection, setSelectedVillageDirection] = useState<Direction | null>(null);
  const [isSendingVillagePassFromDistributor, setIsSendingVillagePassFromDistributor] = useState(false);
  const [villagePassDistributorTransferError, setVillagePassDistributorTransferError] = useState<string | null>(null);
  const [isSubmittingVillageSettlement, setIsSubmittingVillageSettlement] = useState(false);
  const [villageSettlementError, setVillageSettlementError] = useState<string | null>(null);
  const [villageRevealResult, setVillageRevealResult] = useState<VillageRevealResult | null>(null);
  const [settlementPlannerTarget, setSettlementPlannerTarget] = useState<SettlementPlannerTarget | null>(null);
  const [settlementPlannerConflict, setSettlementPlannerConflict] = useState<string | null>(null);
  const [settlementPlannerSuccess, setSettlementPlannerSuccess] = useState<string | null>(null);
  const [optimisticRealmPlacements, setOptimisticRealmPlacements] = useState<SettlementPlannerOptimisticRealm[]>([]);
  const [mintRealmTokenIdInput, setMintRealmTokenIdInput] = useState("1");
  const [isAutoSelectingNextRealmTokenId, setIsAutoSelectingNextRealmTokenId] = useState(false);
  const [autoSelectNextRealmTokenIdError, setAutoSelectNextRealmTokenIdError] = useState<string | null>(null);
  const [isMintingRealmAndSeasonPass, setIsMintingRealmAndSeasonPass] = useState(false);
  const [mintRealmAndSeasonPassError, setMintRealmAndSeasonPassError] = useState<string | null>(null);
  const hasEnteredGameRef = useRef(false);
  const plannerOpenedRef = useRef(false);

  const activeWorldProfile = getActiveWorld();
  const selectedWorldRpcUrl = activeWorldProfile?.name === worldName ? (activeWorldProfile.rpcUrl ?? null) : null;
  const seasonAddresses = getSeasonAddresses(chain);
  // realm_systems.create reads season_pass_address from world config, so prefer world metadata when available.
  const seasonPassAddress = worldMeta?.seasonPassAddress || seasonAddresses.seasonPass || null;
  const villagePassAddress = worldMeta?.villagePassAddress || seasonAddresses.villagePass || null;
  const realmsAddress = seasonAddresses.realms;
  const {
    seasonPassBalance,
    seasonPasses,
    isLoading: isLoadingSeasonPassInventory,
    error: seasonPassInventoryError,
    refetch: refetchSeasonPassInventory,
  } = useSeasonPassInventory({
    chain,
    ownerAddress: account?.address,
    seasonPassAddress,
    rpcUrl: selectedWorldRpcUrl,
    enabled: isOpen && isEternumMode,
    refetchIntervalMs: 0,
  });
  const {
    villagePassBalance,
    villagePasses,
    isLoading: isLoadingVillagePassInventory,
    error: villagePassInventoryError,
    refetch: refetchVillagePassInventory,
  } = useVillagePassInventory({
    chain,
    ownerAddress: account?.address,
    villagePassAddress,
    rpcUrl: selectedWorldRpcUrl,
    enabled: isOpen && isEternumMode,
    refetchIntervalMs: 0,
  });
  const {
    villagePassBalance: distributorVillagePassBalance,
    villagePasses: distributorVillagePasses,
    isLoading: isLoadingDistributorVillagePassInventory,
    error: distributorVillagePassInventoryError,
    refetch: refetchDistributorVillagePassInventory,
  } = useVillagePassInventory({
    chain,
    ownerAddress: VILLAGE_PASS_DISTRIBUTOR_ADDRESS,
    villagePassAddress,
    rpcUrl: selectedWorldRpcUrl,
    enabled: isOpen && isEternumMode,
    refetchIntervalMs: 0,
  });
  const {
    data: ownedStructures = [],
    isLoading: isLoadingOwnedStructures,
    error: ownedStructuresErrorRaw,
    refetch: refetchOwnedStructures,
  } = useQuery({
    queryKey: ["eternumOwnedStructures", chain, worldName, account?.address],
    enabled: isOpen && isEternumMode && bootstrapStatus === "ready" && Boolean(account?.address),
    queryFn: async () => {
      if (!account?.address) return [];
      return await sqlApi.fetchPlayerStructures(account.address);
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const {
    data: realmVillageSlots = [],
    error: villageSlotsErrorRaw,
    refetch: refetchRealmVillageSlots,
  } = useQuery({
    queryKey: ["eternumRealmVillageSlots", chain, worldName],
    enabled: isOpen && isEternumMode && bootstrapStatus === "ready",
    queryFn: async () => await sqlApi.fetchRealmVillageSlots(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const {
    data: seasonOccupiedCoordKeys = [],
    isLoading: isLoadingSeasonOccupiedSlots,
    error: seasonOccupiedSlotsErrorRaw,
  } = useQuery({
    queryKey: ["seasonPlacementOccupiedSlots", chain, worldName],
    enabled:
      isOpen &&
      isEternumMode &&
      bootstrapStatus === "ready" &&
      (worldMeta?.settlementLayerMax ?? null) != null &&
      (worldMeta?.settlementBaseDistance ?? null) != null,
    queryFn: async () => {
      const settlements = await sqlApi.fetchRealmSettlements();
      const coordKeys = new Set<string>();
      for (const settlement of settlements) {
        coordKeys.add(`${settlement.coord_x}:${settlement.coord_y}`);
      }
      return Array.from(coordKeys);
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const seasonOccupiedSlotsError =
    seasonOccupiedSlotsErrorRaw instanceof Error ? seasonOccupiedSlotsErrorRaw.message : null;
  const ownedStructuresError = ownedStructuresErrorRaw instanceof Error ? ownedStructuresErrorRaw.message : null;
  const villageSlotsError = villageSlotsErrorRaw instanceof Error ? villageSlotsErrorRaw.message : null;
  const settlementPlannerData = useSettlementPlannerData({
    enabled: isOpen && isEternumMode && bootstrapStatus === "ready" && unifiedSettlementPlannerEnabled,
    chain,
    worldName,
    layerMax: worldMeta?.settlementLayerMax ?? null,
    layersSkipped: worldMeta?.settlementLayersSkipped ?? null,
    baseDistance: worldMeta?.settlementBaseDistance ?? null,
    mapCenterOffset: worldMeta?.mapCenterOffset ?? 0,
    optimisticRealms: optimisticRealmPlacements,
  });
  const seasonPassInventoryWarning = useMemo(() => {
    if (!seasonPassInventoryError) return null;
    const normalized = seasonPassInventoryError.toLowerCase();
    if (normalized.includes("does not expose token enumeration")) {
      return null;
    }
    return seasonPassInventoryError;
  }, [seasonPassInventoryError]);
  const villagePassInventoryWarning = useMemo(() => {
    if (!villagePassInventoryError) return null;
    const normalized = villagePassInventoryError.toLowerCase();
    if (normalized.includes("does not expose token enumeration")) {
      return null;
    }
    return villagePassInventoryError;
  }, [villagePassInventoryError]);
  const distributorVillagePassInventoryWarning = useMemo(() => {
    if (!distributorVillagePassInventoryError) return null;
    const normalized = distributorVillagePassInventoryError.toLowerCase();
    if (normalized.includes("does not expose token enumeration")) {
      return null;
    }
    return distributorVillagePassInventoryError;
  }, [distributorVillagePassInventoryError]);
  const ownedRealms = useMemo<OwnedRealmOption[]>(() => {
    return (ownedStructures as PlayerStructure[])
      .filter((structure) => structure.category === StructureType.Realm)
      .map((structure) => {
        const realmId = structure.realm_id ?? null;
        return {
          entityId: structure.entity_id,
          realmId,
          coordX: structure.coord_x,
          coordY: structure.coord_y,
          label:
            realmId != null
              ? `Realm #${realmId} · Entity ${structure.entity_id}`
              : `Entity ${structure.entity_id} · (${structure.coord_x}, ${structure.coord_y})`,
        };
      })
      .toSorted((left, right) => {
        if (left.realmId != null && right.realmId != null && left.realmId !== right.realmId) {
          return left.realmId - right.realmId;
        }
        return left.entityId - right.entityId;
      });
  }, [ownedStructures]);
  const hasSettledRealm = ownedRealms.length > 0;
  const ownedVillageIdSet = useMemo(
    () =>
      new Set(
        (ownedStructures as PlayerStructure[])
          .filter((structure) => structure.category === StructureType.Village)
          .map((structure) => structure.entity_id),
      ),
    [ownedStructures],
  );
  const villageDirectionsByRealmEntityId = useMemo(() => {
    const lookup = new Map<number, Set<Direction>>();
    for (const slot of realmVillageSlots as RealmVillageSlot[]) {
      lookup.set(slot.connected_realm_entity_id, parseAvailableVillageDirections(slot));
    }
    return lookup;
  }, [realmVillageSlots]);
  const settleableVillageRealms = useMemo<SettleableVillageRealmOption[]>(() => {
    return ownedRealms
      .map((realm) => {
        const freeDirections = resolveRealmAvailableVillageDirections(villageDirectionsByRealmEntityId, realm.entityId);
        return {
          ...realm,
          freeDirectionCount: freeDirections.size,
        };
      })
      .filter((realm) => realm.freeDirectionCount > 0);
  }, [ownedRealms, villageDirectionsByRealmEntityId]);
  const selectedVillageAvailableDirections = useMemo(() => {
    return resolveRealmAvailableVillageDirections(villageDirectionsByRealmEntityId, selectedVillageRealmEntityId);
  }, [selectedVillageRealmEntityId, villageDirectionsByRealmEntityId]);
  const villageDirectionSlots = useMemo<VillageDirectionSlot[]>(
    () =>
      ALL_VILLAGE_DIRECTIONS.map((direction) => ({
        direction,
        isAvailable: selectedVillageAvailableDirections.has(direction),
      })),
    [selectedVillageAvailableDirections],
  );

  useEffect(() => {
    if (!isOpen) {
      hasEnteredGameRef.current = false;
      setEternumSettlementMode("realm");
      setSelectedSeasonPassTokenId(null);
      setSelectedVillagePassTokenId(null);
      setSelectedVillageRealmEntityId(null);
      setSelectedVillageDirection(null);
      setIsSendingVillagePassFromDistributor(false);
      setVillagePassDistributorTransferError(null);
      setIsSubmittingSeasonSettlement(false);
      setSeasonSettlementError(null);
      setSeasonSettlementComplete(false);
      setIsSubmittingVillageSettlement(false);
      setVillageSettlementError(null);
      setVillageRevealResult(null);
      setSettlementPlannerTarget(null);
      setSettlementPlannerConflict(null);
      setSettlementPlannerSuccess(null);
      setOptimisticRealmPlacements([]);
      setIsAutoSelectingNextRealmTokenId(false);
      setAutoSelectNextRealmTokenIdError(null);
      setIsMintingRealmAndSeasonPass(false);
      setMintRealmAndSeasonPassError(null);
      plannerOpenedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isEternumMode) {
      setSelectedSeasonPassTokenId(null);
      return;
    }
    if (seasonPasses.length === 0) return;

    setSelectedSeasonPassTokenId((current) => {
      if (current != null && seasonPasses.some((pass) => pass.tokenId === current)) {
        return current;
      }
      return seasonPasses[0]?.tokenId ?? null;
    });
  }, [isEternumMode, seasonPasses]);

  useEffect(() => {
    if (!isEternumMode) {
      setSelectedVillagePassTokenId(null);
      return;
    }
    if (villagePasses.length === 0) return;

    setSelectedVillagePassTokenId((current) => {
      if (current != null && villagePasses.some((pass) => pass.tokenId === current)) {
        return current;
      }
      return villagePasses[0]?.tokenId ?? null;
    });
  }, [isEternumMode, villagePasses]);

  useEffect(() => {
    if (!isEternumMode) {
      setSelectedVillageRealmEntityId(null);
      return;
    }
    if (unifiedSettlementPlannerEnabled) {
      return;
    }
    if (settleableVillageRealms.length === 0) {
      setSelectedVillageRealmEntityId(null);
      return;
    }

    setSelectedVillageRealmEntityId((current) => {
      if (current != null && settleableVillageRealms.some((realm) => realm.entityId === current)) {
        return current;
      }
      return settleableVillageRealms[0]?.entityId ?? null;
    });
  }, [isEternumMode, settleableVillageRealms, unifiedSettlementPlannerEnabled]);

  useEffect(() => {
    if (!isEternumMode) {
      setSelectedVillageDirection(null);
      return;
    }
    if (unifiedSettlementPlannerEnabled) {
      return;
    }

    setSelectedVillageDirection((current) => {
      if (current != null && selectedVillageAvailableDirections.has(current)) {
        return current;
      }
      const firstAvailableDirection = selectedVillageAvailableDirections.values().next().value as Direction | undefined;
      return firstAvailableDirection ?? null;
    });
  }, [isEternumMode, selectedVillageAvailableDirections, unifiedSettlementPlannerEnabled]);

  useEffect(() => {
    if (!isEternumMode) return;
    if (unifiedSettlementPlannerEnabled) return;
    const minimumLayer = Math.max(1, (worldMeta?.settlementLayersSkipped ?? 0) + 1);
    setSeasonPlacement((current) => {
      if (current.layer >= minimumLayer) return current;
      return {
        ...current,
        layer: minimumLayer,
        point: 0,
      };
    });
  }, [isEternumMode, worldMeta?.settlementLayersSkipped, unifiedSettlementPlannerEnabled]);

  useEffect(() => {
    setSeasonSettlementError(null);
  }, [selectedSeasonPassTokenId, seasonPlacement.side, seasonPlacement.layer, seasonPlacement.point]);

  useEffect(() => {
    setVillageSettlementError(null);
  }, [selectedVillagePassTokenId, selectedVillageRealmEntityId, selectedVillageDirection]);

  useEffect(() => {
    setVillagePassDistributorTransferError(null);
  }, [account?.address, villagePassAddress, chain, worldName]);

  useEffect(() => {
    if (!unifiedSettlementPlannerEnabled || !settlementPlannerTarget) {
      return;
    }
    if (settlementPlannerData.isLoading) {
      return;
    }
    if (isSettlementPlannerTargetStillValid(settlementPlannerTarget, settlementPlannerData)) {
      return;
    }

    setSettlementPlannerTarget(null);
    setSettlementPlannerConflict("That location just changed. The planner refreshed and cleared the stale selection.");
    captureClientEvent("planner_conflict_refreshed", {
      worldName,
      chain,
    });
  }, [unifiedSettlementPlannerEnabled, settlementPlannerTarget, settlementPlannerData, worldName, chain]);

  useEffect(() => {
    if (optimisticRealmPlacements.length === 0) {
      return;
    }

    const syncedCoordKeys = new Set(
      settlementPlannerData.snapshot.realms.map((realm) => `${realm.coordX}:${realm.coordY}`),
    );

    setOptimisticRealmPlacements((current) =>
      current.filter((realm) => !syncedCoordKeys.has(`${realm.coordX}:${realm.coordY}`)),
    );
  }, [optimisticRealmPlacements.length, settlementPlannerData.snapshot.realms]);

  // Update task status
  const updateTask = useCallback((taskId: string, status: BootstrapTask["status"]) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  }, []);

  // Calculate progress
  const progress = useMemo(() => {
    if (bootstrapStatus === "ready") return 100;
    if (bootstrapStatus === "error" || bootstrapStatus === "idle" || bootstrapStatus === "pending-world") return 0;

    const weights: Record<string, number> = { world: 5, manifest: 10, dojo: 25, sync: 50, renderer: 10 };
    let completed = 0;
    tasks.forEach((t) => {
      if (t.status === "complete") {
        completed += weights[t.id] || 0;
      } else if (t.status === "running" && t.id === "sync") {
        completed += (weights[t.id] || 0) * (syncProgress / 100);
      }
    });
    return Math.min(99, Math.round(completed));
  }, [bootstrapStatus, tasks, syncProgress]);

  const nowSeconds = Date.now() / 1000;
  const seasonStartAt = worldMeta?.startSettlingAt ?? worldMeta?.startMainAt ?? null;
  const seasonHasStarted = seasonStartAt != null && seasonStartAt <= nowSeconds;
  const seasonNotEnded = worldMeta?.endAt == null || worldMeta.endAt === 0 || nowSeconds <= worldMeta.endAt;
  const seasonTimingValid = seasonHasStarted && seasonNotEnded;
  const spiresSettledCount = worldMeta?.spiresSettledCount ?? null;
  const spiresMaxCount = worldMeta?.spiresMaxCount ?? null;
  const spiresSettled =
    spiresSettledCount != null && spiresMaxCount != null
      ? spiresMaxCount === 0 || spiresSettledCount >= spiresMaxCount
      : (spiresSettledCount ?? 0) > 0;
  const hasSeasonPass = seasonPassBalance > 0n || seasonPasses.length > 0;
  const hasVillagePass = villagePassBalance > 0n || villagePasses.length > 0;
  const canAttemptSeasonSettle = seasonTimingValid && hasSeasonPass;
  const isLoadingEternumPrereqs =
    isCheckingWorldAvailability ||
    isLoadingSeasonPassInventory ||
    isLoadingVillagePassInventory ||
    isLoadingOwnedStructures ||
    !worldMeta;
  const seasonPlacementValidationErrors = useMemo(
    () =>
      validateSeasonPlacement({
        side: seasonPlacement.side,
        layer: seasonPlacement.layer,
        point: seasonPlacement.point,
        layerMax: worldMeta?.settlementLayerMax ?? null,
        layersSkipped: worldMeta?.settlementLayersSkipped ?? null,
      }),
    [
      seasonPlacement.side,
      seasonPlacement.layer,
      seasonPlacement.point,
      worldMeta?.settlementLayerMax,
      worldMeta?.settlementLayersSkipped,
    ],
  );
  const targetCoordPreview = useMemo(() => {
    if (seasonPlacementValidationErrors.length > 0) return null;
    const baseDistance = worldMeta?.settlementBaseDistance;
    if (baseDistance == null || baseDistance <= 0) return null;
    return computeSeasonPlacementPreview({
      side: seasonPlacement.side,
      layer: seasonPlacement.layer,
      point: seasonPlacement.point,
      baseDistance,
      mapCenterOffset: worldMeta?.mapCenterOffset ?? 0,
    });
  }, [
    seasonPlacementValidationErrors,
    seasonPlacement.side,
    seasonPlacement.layer,
    seasonPlacement.point,
    worldMeta?.settlementBaseDistance,
    worldMeta?.mapCenterOffset,
  ]);
  const seasonOccupiedCoordLookup = useMemo(() => new Set(seasonOccupiedCoordKeys), [seasonOccupiedCoordKeys]);
  const selectedSeasonPlacementIsOccupied = useMemo(() => {
    if (!targetCoordPreview) return false;
    return seasonOccupiedCoordLookup.has(`${targetCoordPreview.x}:${targetCoordPreview.y}`);
  }, [targetCoordPreview, seasonOccupiedCoordLookup]);
  const seasonPlacementErrors = useMemo(() => {
    if (!selectedSeasonPlacementIsOccupied) return seasonPlacementValidationErrors;
    return [...seasonPlacementValidationErrors, "Destination occupied. Choose another side/layer/point."];
  }, [seasonPlacementValidationErrors, selectedSeasonPlacementIsOccupied]);
  const settlementPlannerRealmTarget =
    settlementPlannerTarget?.type === "realm_slot" ? settlementPlannerTarget.slot : null;
  const settlementPlannerVillageTarget =
    settlementPlannerTarget?.type === "village_slot" ? settlementPlannerTarget.slot : null;

  useEffect(() => {
    if (!isEternumMode) {
      setEternumSettlementMode("realm");
      return;
    }
    if (unifiedSettlementPlannerEnabled) {
      return;
    }
    setEternumSettlementMode((current) => {
      if (current === "realm" && !hasSeasonPass && hasVillagePass) return "village";
      if (current === "village" && !hasVillagePass && hasSeasonPass) return "realm";
      return current;
    });
  }, [isEternumMode, hasSeasonPass, hasVillagePass, unifiedSettlementPlannerEnabled]);

  // Both checks must complete before we can determine the final phase
  const checksComplete = settlementCheckComplete && hyperstructureCheckComplete;
  const worldAvailabilityErrorMessage =
    worldAvailability?.error instanceof Error ? worldAvailability.error.message : null;
  const phaseError = useMemo(
    () =>
      bootstrapError ??
      resolveGameEntryBlockingError({
        worldAvailabilityErrorMessage,
        isCheckingWorldAvailability,
        isWorldAvailable: worldAvailability?.isAvailable ?? null,
        hasWorldMeta: worldMeta != null,
        worldMode,
      }),
    [
      bootstrapError,
      worldAvailabilityErrorMessage,
      isCheckingWorldAvailability,
      worldAvailability?.isAvailable,
      worldMeta,
      worldMode,
    ],
  );

  // Determine current phase
  const phase: ModalPhase = useMemo(() => {
    const result = resolveGameEntryModalPhase({
      bootstrapStatus,
      hasPhaseError: phaseError != null,
      isForgeMode,
      isBlitzMode,
      isSpectateMode,
      worldMode,
      isCheckingWorldAvailability,
      hasWorldMeta: worldMeta != null,
      isEternumMode,
      isLoadingEternumPrereqs,
      hasVillageRevealResult: villageRevealResult != null,
      unifiedSettlementPlannerEnabled,
      hasSettledRealm,
      eternumEntryIntent,
      seasonSettlementComplete,
      eternumSettlementMode,
      hasVillagePass,
      hasSeasonPass,
      checksComplete,
      needsHyperstructureInit,
      needsSettlement,
    });

    debugLog(worldName, "Phase determined:", result, {
      bootstrapStatus,
      hasError: phaseError != null,
      isForgeMode,
      isBlitzMode,
      isSpectateMode,
      checksComplete,
      settlementCheckComplete,
      hyperstructureCheckComplete,
      needsHyperstructureInit,
      needsSettlement,
      worldMode,
      startSettlingAt: worldMeta?.startSettlingAt,
      startMainAt: worldMeta?.startMainAt,
      endAt: worldMeta?.endAt,
      spiresMaxCount: worldMeta?.spiresMaxCount,
      spiresSettledCount: worldMeta?.spiresSettledCount,
      seasonPassAddress: worldMeta?.seasonPassAddress,
      villagePassAddress: worldMeta?.villagePassAddress,
      settlementLayerMax: worldMeta?.settlementLayerMax,
      settlementLayersSkipped: worldMeta?.settlementLayersSkipped,
      mapCenterOffset: worldMeta?.mapCenterOffset,
      seasonPassCount: seasonPasses.length,
      villagePassCount: villagePasses.length,
      selectedSeasonPassTokenId: selectedSeasonPassTokenId?.toString() ?? null,
      selectedVillagePassTokenId: selectedVillagePassTokenId?.toString() ?? null,
      selectedVillageRealmEntityId,
      selectedVillageDirection,
      villageDirectionSlots,
      villageRevealResult,
      eternumSettlementMode,
      unifiedSettlementPlannerEnabled,
      eternumEntryIntent,
      seasonPlacement,
      seasonPlacementErrors,
      selectedSeasonPlacementIsOccupied,
      targetCoordPreview,
      seasonSettlementComplete,
      hasSettledRealm,
      hasSeasonPass,
      hasVillagePass,
      canAttemptSeasonSettle,
    });

    return result;
  }, [
    bootstrapStatus,
    phaseError,
    isForgeMode,
    isBlitzMode,
    isSpectateMode,
    checksComplete,
    settlementCheckComplete,
    hyperstructureCheckComplete,
    needsHyperstructureInit,
    needsSettlement,
    isEternumMode,
    isLoadingEternumPrereqs,
    isCheckingWorldAvailability,
    seasonSettlementComplete,
    hasSettledRealm,
    hasSeasonPass,
    hasVillagePass,
    worldMode,
    worldMeta,
    seasonPasses,
    villagePasses,
    selectedSeasonPassTokenId,
    selectedVillagePassTokenId,
    selectedVillageRealmEntityId,
    selectedVillageDirection,
    villageDirectionSlots,
    villageRevealResult,
    eternumSettlementMode,
    unifiedSettlementPlannerEnabled,
    eternumEntryIntent,
    seasonPlacement,
    seasonPlacementErrors,
    selectedSeasonPlacementIsOccupied,
    targetCoordPreview,
    canAttemptSeasonSettle,
    worldName,
  ]);

  useEffect(() => {
    if (phase !== "settlement-planner" || !unifiedSettlementPlannerEnabled || plannerOpenedRef.current) {
      return;
    }

    plannerOpenedRef.current = true;
    captureClientEvent("planner_opened", {
      worldName,
      chain,
      entryIntent: eternumEntryIntent,
    });
  }, [phase, unifiedSettlementPlannerEnabled, worldName, chain, eternumEntryIntent]);

  const readSettlementSnapshot = useCallback(async (): Promise<SettlementSnapshot | null> => {
    if (!setupResult || !account?.address) return null;

    const { components } = setupResult;
    const playerAddress = account.address;

    const { getEntityIdFromKeys } = await import("@bibliothecadao/eternum");
    const { getComponentValue, HasValue, runQuery } = await import("@dojoengine/recs");

    const entityId = getEntityIdFromKeys([BigInt(playerAddress)]);
    const playerRegister = getComponentValue(components.BlitzRealmPlayerRegister, entityId) as {
      registered?: boolean;
      once_registered?: boolean;
    } | null;
    const settleFinish = getComponentValue(components.BlitzRealmSettleFinish, entityId) as SettleFinishValue | null;
    const playerStructures = runQuery([HasValue(components.Structure, { owner: BigInt(playerAddress) })]);

    return {
      registered: playerRegister?.registered === true,
      onceRegistered: playerRegister?.once_registered === true,
      hasSettledStructure: playerStructures.size > 0,
      coordsCount: settleFinish?.coords?.length ?? 0,
      settledCount: settleFinish?.structure_ids?.length ?? 0,
    };
  }, [setupResult, account]);

  const syncSettlementStateFromSnapshot = useCallback(
    (snapshot: SettlementSnapshot) => {
      const status = deriveSettlementStatus(snapshot);
      setAssignedRealmCount(status.assignedCount);
      setSettledRealmCount(status.settledCount);
      setNeedsSettlement(status.needsSettlement);
      return status;
    },
    [setAssignedRealmCount, setSettledRealmCount, setNeedsSettlement],
  );

  const waitForSettlementTarget = useCallback(
    async (
      targetSettleCount: number,
      timeoutMs = SETTLEMENT_PROGRESS_TIMEOUT_MS,
    ): Promise<SettlementSnapshot | null> => {
      const startedAt = Date.now();
      let latestSnapshot: SettlementSnapshot | null = null;

      while (Date.now() - startedAt < timeoutMs) {
        const snapshot = await readSettlementSnapshot();
        if (snapshot) {
          latestSnapshot = snapshot;
          const status = syncSettlementStateFromSnapshot(snapshot);
          if (status.settledCount >= targetSettleCount || status.remainingToSettle === 0) {
            return snapshot;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, SETTLEMENT_PROGRESS_POLL_MS));
      }

      return latestSnapshot;
    },
    [readSettlementSnapshot, syncSettlementStateFromSnapshot],
  );

  const waitForSubmittedTransaction = useCallback(
    async (
      result: unknown,
      label: string,
      fallbackWaitAccount?: {
        waitForTransaction?: (txHash: string) => Promise<unknown>;
      },
    ) => {
      const txHash = extractTransactionHash(result);
      if (!txHash) {
        throw new Error(`Missing transaction hash for ${label}`);
      }

      const provider = setupResult?.network?.provider as
        | {
            waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
          }
        | undefined;

      if (provider && typeof provider.waitForTransactionWithCheck === "function") {
        await provider.waitForTransactionWithCheck(txHash);
        return;
      }

      const accountWithWait = account as unknown as { waitForTransaction?: (txHash: string) => Promise<unknown> };
      if (typeof accountWithWait.waitForTransaction === "function") {
        await accountWithWait.waitForTransaction(txHash);
        return;
      }

      if (fallbackWaitAccount && typeof fallbackWaitAccount.waitForTransaction === "function") {
        await fallbackWaitAccount.waitForTransaction(txHash);
        return;
      }

      throw new Error(`Unable to confirm ${label}: no transaction wait method available`);
    },
    [setupResult, account],
  );

  const resolveWorldSystemAddress = useCallback(
    (systemName: string): string => {
      if (!setupResult) {
        throw new Error("Game setup is still loading.");
      }

      const providerWithManifest = setupResult.network.provider as unknown as { manifest?: unknown };
      if (!providerWithManifest.manifest) {
        throw new Error("World manifest unavailable.");
      }

      const contract = getContractByName(providerWithManifest.manifest as any, ETERNUM_NAMESPACE, systemName);
      const contractAddress =
        typeof contract === "string"
          ? contract
          : contract && typeof contract === "object" && "address" in contract
            ? (contract as { address?: string }).address
            : null;

      if (!contractAddress) {
        throw new Error(`${systemName} contract not found for selected world`);
      }

      return contractAddress;
    },
    [setupResult],
  );

  const resolveOptionalPlayerNameForSettlement = useCallback(async (): Promise<string | null> => {
    if (!setupResult || !account?.address) return null;

    const { getEntityIdFromKeys } = await import("@bibliothecadao/eternum");
    const { getComponentValue } = await import("@dojoengine/recs");

    const playerEntityId = getEntityIdFromKeys([BigInt(account.address)]);
    const addressName = getComponentValue(setupResult.components.AddressName, playerEntityId) as {
      name?: unknown;
    } | null;

    if (hasAddressNameValue(addressName?.name)) {
      return null;
    }

    if (!usernameFelt) {
      throw new Error("Unable to resolve player name for settlement.");
    }

    return usernameFelt;
  }, [setupResult, account?.address, usernameFelt]);

  const buildSetAddressNameCall = useCallback(
    (playerName: string): Call => ({
      contractAddress: resolveWorldSystemAddress("name_systems"),
      entrypoint: "set_address_name",
      calldata: CallData.compile([playerName]),
    }),
    [resolveWorldSystemAddress],
  );

  const buildVillageSettlementCalls = useCallback(
    ({
      signerAddress,
      villagePassTokenId,
      connectedRealmEntityId,
      direction,
      villagePassAddress,
      optionalPlayerName,
    }: {
      signerAddress: string;
      villagePassTokenId: bigint;
      connectedRealmEntityId: number;
      direction: Direction;
      villagePassAddress: string;
      optionalPlayerName: string | null;
    }): Call[] => {
      const villageSystemsAddress = resolveWorldSystemAddress("village_systems");
      const calls: Call[] = [];

      if (optionalPlayerName) {
        calls.push(buildSetAddressNameCall(optionalPlayerName));
      }

      calls.push({
        contractAddress: villagePassAddress,
        entrypoint: "set_approval_for_all",
        calldata: CallData.compile([villageSystemsAddress, true]),
      });

      const providerWithVrf = setupResult?.network.provider as unknown as { VRF_PROVIDER_ADDRESS?: string } | null;
      const vrfProviderAddress = providerWithVrf?.VRF_PROVIDER_ADDRESS;
      if (hasNonZeroNumericValue(vrfProviderAddress)) {
        calls.push({
          contractAddress: vrfProviderAddress as string,
          entrypoint: "request_random",
          calldata: CallData.compile([villageSystemsAddress, 0, signerAddress]),
        });
      }

      calls.push({
        contractAddress: villageSystemsAddress,
        entrypoint: "create",
        calldata: CallData.compile([villagePassTokenId, connectedRealmEntityId, direction]),
      });

      return calls;
    },
    [buildSetAddressNameCall, resolveWorldSystemAddress, setupResult?.network.provider],
  );

  const waitForVillageResourceReveal = useCallback(
    async ({
      ownerAddress,
      existingVillageIds,
      timeoutMs = 45_000,
    }: {
      ownerAddress: string;
      existingVillageIds: Set<number>;
      timeoutMs?: number;
    }): Promise<VillageRevealResult> => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const structures = await sqlApi.fetchPlayerStructures(ownerAddress);
        const newVillage = structures
          .filter(
            (structure) => structure.category === StructureType.Village && !existingVillageIds.has(structure.entity_id),
          )
          .toSorted((left, right) => right.entity_id - left.entity_id)[0];

        if (newVillage) {
          const resourceId = resolvePrimaryVillageResource(newVillage.resources_packed);
          const resourceLabel = resourceId != null ? resolveResourceLabel(resourceId) : null;
          if (resourceId != null && resourceLabel) {
            return {
              villageEntityId: newVillage.entity_id,
              resourceId,
              resourceLabel,
            };
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }

      throw new Error("Village created but resource assignment is not indexed in Torii yet.");
    },
    [],
  );

  // Check settlement status after bootstrap completes
  useEffect(() => {
    debugLog(
      worldName,
      "Settlement check effect - bootstrapStatus:",
      bootstrapStatus,
      "hasSetupResult:",
      !!setupResult,
      "isSpectateMode:",
      isSpectateMode,
    );

    if (bootstrapStatus !== "ready" || !setupResult) {
      debugLog(worldName, "Skipping settlement check - bootstrap not ready");
      return;
    }

    if (isEternumMode) {
      debugLog(worldName, "Skipping settlement check - Eternum mode");
      setNeedsSettlement(false);
      setSettlementCheckComplete(true);
      return;
    }

    if (!isBlitzMode) {
      debugLog(worldName, "Skipping settlement check - world mode unresolved");
      return;
    }

    if (isSpectateMode || (isForgeMode && isBlitzMode)) {
      debugLog(worldName, "Skipping settlement check - spectate or forge mode");
      setSettlementCheckComplete(true);
      return;
    }

    // Query player's settlement status from Dojo components
    const checkSettlementStatus = async () => {
      debugLog(worldName, "Running settlement status check...");
      try {
        if (!account?.address) {
          debugLog(worldName, "No player address, skipping settlement check");
          setNeedsSettlement(false);
          setSettlementCheckComplete(true);
          return;
        }

        const snapshot = await readSettlementSnapshot();
        if (!snapshot) {
          setNeedsSettlement(false);
          setSettlementCheckComplete(true);
          return;
        }
        const status = syncSettlementStateFromSnapshot(snapshot);

        debugLog(worldName, "Settlement check result:", {
          registered: snapshot.registered,
          onceRegistered: snapshot.onceRegistered,
          hasSettledStructure: snapshot.hasSettledStructure,
          coordsCount: snapshot.coordsCount,
          settledCount: snapshot.settledCount,
          assignedCount: status.assignedCount,
          canPlay: status.canPlay,
          needsSettlement: status.needsSettlement,
        });

        setSettlementCheckComplete(true);
      } catch (error) {
        debugLog(worldName, "Failed to check settlement status:", error);
        // On error, assume no settlement needed and let user enter game
        setNeedsSettlement(false);
        setSettlementCheckComplete(true);
      }
    };

    // Run the check
    checkSettlementStatus();
  }, [
    bootstrapStatus,
    setupResult,
    account,
    isBlitzMode,
    isEternumMode,
    isSpectateMode,
    isForgeMode,
    worldName,
    readSettlementSnapshot,
    syncSettlementStateFromSnapshot,
  ]);

  // Check hyperstructure initialization status after bootstrap completes
  useEffect(() => {
    debugLog(
      worldName,
      "Hyperstructure check effect - bootstrapStatus:",
      bootstrapStatus,
      "hasSetupResult:",
      !!setupResult,
      "isSpectateMode:",
      isSpectateMode,
      "isForgeMode:",
      isForgeMode,
    );

    if (bootstrapStatus !== "ready" || !setupResult) {
      debugLog(worldName, "Skipping hyperstructure check - bootstrap not ready");
      return;
    }

    if (isEternumMode) {
      debugLog(worldName, "Skipping hyperstructure check - Eternum mode");
      setNeedsHyperstructureInit(false);
      setHyperstructureCheckComplete(true);
      return;
    }

    if (!isBlitzMode) {
      debugLog(worldName, "Skipping hyperstructure check - world mode unresolved");
      return;
    }

    if (isSpectateMode || (isForgeMode && isBlitzMode)) {
      debugLog(worldName, "Skipping hyperstructure check - spectate or forge mode");
      setHyperstructureCheckComplete(true);
      return;
    }

    const checkHyperstructures = async () => {
      debugLog(worldName, "Running hyperstructure status check...");
      try {
        const { components } = setupResult;

        // Import Dojo utilities
        const { getHyperstructureProgress, getHyperstructureName } = await import("@bibliothecadao/eternum");
        const { getComponentValue, Has, runQuery } = await import("@dojoengine/recs");

        // Get all hyperstructures
        const hyperstructureEntities = runQuery([Has(components.Hyperstructure)]);
        debugLog(worldName, "Found hyperstructure entities:", hyperstructureEntities.size);

        const hsInfoList: HyperstructureInfo[] = [];

        for (const entity of hyperstructureEntities) {
          const structure = getComponentValue(components.Structure, entity);
          if (!structure) continue;

          const entityId = Number(structure.entity_id);
          const progress = getHyperstructureProgress(entityId, components);
          const name = getHyperstructureName(structure);

          hsInfoList.push({
            entityId,
            initialized: progress.initialized,
            name,
          });

          debugLog(worldName, "Hyperstructure:", name, "entityId:", entityId, "initialized:", progress.initialized);
        }

        debugLog(worldName, "Hyperstructure info:", hsInfoList);
        setHyperstructures(hsInfoList);

        // Check if any hyperstructures need initialization
        const uninitializedCount = hsInfoList.filter((h) => !h.initialized).length;
        const needsInit = uninitializedCount > 0;

        debugLog(
          worldName,
          "Hyperstructures need initialization:",
          needsInit,
          "uninitialized count:",
          uninitializedCount,
          "total:",
          hsInfoList.length,
        );
        setNeedsHyperstructureInit(needsInit);
        setHyperstructureCheckComplete(true);
      } catch (error) {
        debugLog(worldName, "Failed to check hyperstructure status:", error);
        // On error, assume no initialization needed
        setNeedsHyperstructureInit(false);
        setHyperstructureCheckComplete(true);
      }
    };

    checkHyperstructures();
  }, [bootstrapStatus, setupResult, isBlitzMode, isEternumMode, isSpectateMode, isForgeMode, worldName]);

  // Start bootstrap when modal opens
  useEffect(() => {
    if (!isOpen) {
      debugLog(worldName, "Modal not open, skipping bootstrap");
      return;
    }
    if (isForgeMode && isBlitzMode) {
      debugLog(worldName, "Forge mode active, skipping game bootstrap");
      return;
    }

    debugLog(worldName, "Starting bootstrap for", worldName, "chain:", chain);

    const startBootstrap = async () => {
      try {
        setBootstrapStatus("loading");
        setBootstrapError(null);
        setTasks(BOOTSTRAP_TASKS.map((t) => ({ ...t, status: "pending" })));
        setNeedsSettlement(false);
        setSettlementCheckComplete(false);
        setSettleStage("idle");
        setHyperstructures([]);
        setNeedsHyperstructureInit(false);
        setHyperstructureCheckComplete(false);
        setEternumSettlementMode("realm");
        setSeasonPlacement(DEFAULT_SEASON_PLACEMENT);
        setSelectedSeasonPassTokenId(null);
        setIsSubmittingSeasonSettlement(false);
        setSeasonSettlementError(null);
        setSeasonSettlementComplete(false);
        setSelectedVillagePassTokenId(null);
        setSelectedVillageRealmEntityId(null);
        setSelectedVillageDirection(null);
        setIsSendingVillagePassFromDistributor(false);
        setVillagePassDistributorTransferError(null);
        setIsSubmittingVillageSettlement(false);
        setVillageSettlementError(null);
        setVillageRevealResult(null);
        setSettlementPlannerTarget(null);
        setSettlementPlannerConflict(null);
        setSettlementPlannerSuccess(null);
        setOptimisticRealmPlacements([]);

        // Apply world selection first
        debugLog(worldName, "Applying world selection...");
        markGameEntryMilestone("destination-resolved");
        markGameEntryMilestone("world-selection-started");
        updateTask("world", "running");
        await applyWorldSelection({ name: worldName, chain }, chain);
        updateTask("world", "complete");
        markGameEntryMilestone("world-selection-completed");
        debugLog(worldName, "World selection complete");

        // Start bootstrap
        debugLog(worldName, "Starting game bootstrap...");
        updateTask("manifest", "running");
        markGameEntryMilestone("bootstrap-started");
        markGameEntryMilestone("asset-prefetch-scheduled");
        primePlayEntryAssets();
        const result = await bootstrapGame();
        markGameEntryMilestone("bootstrap-completed");
        debugLog(worldName, "Bootstrap complete, got setupResult:", !!result);

        // After bootstrap patches the manifest with the selected world's
        // contract addresses, refresh the controller's session policies
        // if they changed. This recreates the keychain iframe with correct
        // policies and re-probes to restore the user's account.
        const connector = useAccountStore.getState().connector;
        if (connector) {
          markGameEntryMilestone("session-policies-refresh-started");
          const updated = await refreshSessionPolicies(connector);
          markGameEntryMilestone("session-policies-refresh-completed");
          if (updated) {
            debugLog(worldName, "Session policies refreshed for new world");
          }
        } else {
          markGameEntryMilestone("session-policies-refresh-skipped");
        }

        // Mark all tasks complete
        setTasks((prev) => prev.map((t) => ({ ...t, status: "complete" })));
        setSetupResult(result);
        setBootstrapStatus("ready");
        markGameEntryMilestone("entry-ready");
        debugLog(worldName, "Bootstrap status set to ready");
      } catch (error) {
        debugLog(worldName, "Bootstrap failed:", error);
        setBootstrapError(error instanceof Error ? error : new Error("Bootstrap failed"));
        setBootstrapStatus("error");
        setTasks((prev) => prev.map((t) => (t.status === "running" ? { ...t, status: "error" } : t)));
      }
    };

    startBootstrap();
  }, [isOpen, isForgeMode, isBlitzMode, worldName, chain, updateTask, bootstrapAttempt]);

  // Update task progress based on sync
  useEffect(() => {
    if (bootstrapStatus !== "loading") return;

    if (syncProgress > 0 && syncProgress < 100) {
      updateTask("manifest", "complete");
      updateTask("dojo", "complete");
      updateTask("sync", "running");
    } else if (syncProgress >= 100) {
      updateTask("sync", "complete");
      updateTask("renderer", "running");
    }
  }, [syncProgress, bootstrapStatus, updateTask]);

  // Retry handler
  const handleRetry = useCallback(() => {
    setBootstrapStatus("idle");
    setBootstrapError(null);
    setSetupResult(null);
    setTasks(BOOTSTRAP_TASKS.map((t) => ({ ...t, status: "pending" })));
    setNeedsSettlement(false);
    setSettlementCheckComplete(false);
    setSettleStage("idle");
    setHyperstructures([]);
    setNeedsHyperstructureInit(false);
    setHyperstructureCheckComplete(false);
    setIsInitializingHyperstructure(false);
    setCurrentInitializingId(null);
    setEternumSettlementMode("realm");
    setSeasonPlacement(DEFAULT_SEASON_PLACEMENT);
    setSelectedSeasonPassTokenId(null);
    setIsSubmittingSeasonSettlement(false);
    setSeasonSettlementError(null);
    setSeasonSettlementComplete(false);
    setSelectedVillagePassTokenId(null);
    setSelectedVillageRealmEntityId(null);
    setSelectedVillageDirection(null);
    setIsSendingVillagePassFromDistributor(false);
    setVillagePassDistributorTransferError(null);
    setIsSubmittingVillageSettlement(false);
    setVillageSettlementError(null);
    setVillageRevealResult(null);
    setSettlementPlannerTarget(null);
    setSettlementPlannerConflict(null);
    setSettlementPlannerSuccess(null);
    setOptimisticRealmPlacements([]);
    plannerOpenedRef.current = false;
    // Trigger re-bootstrap
    setTimeout(() => {
      setBootstrapAttempt((attempt) => attempt + 1);
    }, 100);
  }, []);

  const handleSettlementPlannerTargetSelect = useCallback(
    (target: SettlementPlannerTarget) => {
      setSettlementPlannerTarget(target);
      setSettlementPlannerConflict(null);
      setSettlementPlannerSuccess(null);

      if (target.type === "realm_slot") {
        setSeasonPlacement({
          side: target.slot.side,
          layer: target.slot.layer,
          point: target.slot.point,
        });
      }

      if (target.type === "village_slot") {
        setSelectedVillageRealmEntityId(target.slot.realmEntityId);
        setSelectedVillageDirection(target.slot.direction);
      }

      captureClientEvent("planner_target_selected", {
        worldName,
        chain,
        targetType: target.type,
        occupiedType: target.type === "occupied_target" ? target.occupiedType : null,
      });
    },
    [worldName, chain],
  );

  const handleGetSeasonPass = useCallback(() => {
    window.open("https://empire.realms.world/trade", "_blank", "noopener,noreferrer");
  }, []);

  const handleGetVillagePass = useCallback(() => {
    window.open("https://empire.realms.world/trade", "_blank", "noopener,noreferrer");
  }, []);

  const handleSendVillagePassToConnectedWallet = useCallback(async () => {
    if (!account?.address) {
      setVillagePassDistributorTransferError("Connect your wallet first.");
      return;
    }
    if (!villagePassAddress) {
      setVillagePassDistributorTransferError("Village pass contract not configured for this world.");
      return;
    }

    const tokenIdToTransfer = distributorVillagePasses[0]?.tokenId ?? null;
    if (tokenIdToTransfer == null) {
      setVillagePassDistributorTransferError("No village pass is available in distributor wallet.");
      return;
    }

    setIsSendingVillagePassFromDistributor(true);
    setVillagePassDistributorTransferError(null);

    try {
      const distributorProvider = new RpcProvider({
        nodeUrl: selectedWorldRpcUrl ?? getRpcUrlForChain(chain),
      });
      const distributorAccount = new Account({
        provider: distributorProvider,
        address: VILLAGE_PASS_DISTRIBUTOR_ADDRESS,
        signer: VILLAGE_PASS_DISTRIBUTOR_PRIVATE_KEY,
      });

      try {
        const transferResult = await distributorAccount.execute(
          buildVillagePassTransferFromCall({
            villagePassAddress,
            fromAddress: VILLAGE_PASS_DISTRIBUTOR_ADDRESS,
            toAddress: account.address,
            tokenId: tokenIdToTransfer,
          }),
        );
        await waitForSubmittedTransaction(transferResult, "village_pass.transfer_from", distributorAccount);
      } catch (transferError) {
        const normalizedMessage = getNormalizedErrorMessage(transferError);
        if (!isMissingEntrypointError(normalizedMessage)) {
          throw transferError;
        }

        const safeTransferResult = await distributorAccount.execute(
          buildVillagePassSafeTransferFromCall({
            villagePassAddress,
            fromAddress: VILLAGE_PASS_DISTRIBUTOR_ADDRESS,
            toAddress: account.address,
            tokenId: tokenIdToTransfer,
          }),
        );
        await waitForSubmittedTransaction(safeTransferResult, "village_pass.safe_transfer_from", distributorAccount);
      }

      refetchDistributorVillagePassInventory();
      refetchVillagePassInventory();
      setVillagePassDistributorTransferError(null);
    } catch (error) {
      setVillagePassDistributorTransferError(mapVillagePassDistributorTransferError(error));
    } finally {
      setIsSendingVillagePassFromDistributor(false);
    }
  }, [
    account,
    villagePassAddress,
    distributorVillagePasses,
    selectedWorldRpcUrl,
    chain,
    waitForSubmittedTransaction,
    refetchDistributorVillagePassInventory,
    refetchVillagePassInventory,
  ]);

  const canUseSandboxMintFlow = isEternumMode && (chain === "slot" || chain === "slottest");

  const handleAutoSelectNextRealmTokenId = useCallback(async () => {
    if (!realmsAddress) {
      setAutoSelectNextRealmTokenIdError("Realms contract is not configured for this world.");
      return;
    }

    setIsAutoSelectingNextRealmTokenId(true);
    setAutoSelectNextRealmTokenIdError(null);

    try {
      const baseRpcUrl = selectedWorldRpcUrl ?? getRpcUrlForChain(chain);
      const provider = new RpcProvider({ nodeUrl: baseRpcUrl });

      let startingRealmId = 1n;
      const rawInput = mintRealmTokenIdInput.trim();
      if (rawInput.length > 0) {
        try {
          const parsedInput = BigInt(rawInput);
          if (parsedInput > 0n) {
            startingRealmId = parsedInput;
          }
        } catch {
          // Ignore invalid manual input and fall back to realm id 1.
        }
      }

      let candidateRealmId = startingRealmId;
      for (let attempt = 0; attempt < NEXT_FREE_REALM_ID_SCAN_LIMIT; attempt += 1) {
        const tokenExists = await doesErc721TokenExist(provider, realmsAddress, candidateRealmId);
        if (!tokenExists) {
          setMintRealmTokenIdInput(candidateRealmId.toString());
          setAutoSelectNextRealmTokenIdError(null);
          return;
        }

        candidateRealmId += 1n;
      }

      setAutoSelectNextRealmTokenIdError(`No free realm ID found in the next ${NEXT_FREE_REALM_ID_SCAN_LIMIT} slots.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to auto-select next realm ID.";
      setAutoSelectNextRealmTokenIdError(message);
    } finally {
      setIsAutoSelectingNextRealmTokenId(false);
    }
  }, [chain, mintRealmTokenIdInput, realmsAddress, selectedWorldRpcUrl]);

  const handleMintRealmAndSeasonPass = useCallback(async () => {
    if (!account?.address) {
      setMintRealmAndSeasonPassError("Connect your wallet first.");
      return;
    }
    if (!seasonPassAddress || !realmsAddress) {
      setMintRealmAndSeasonPassError("Season contracts are not configured for this world.");
      return;
    }

    const tokenInput = mintRealmTokenIdInput.trim();
    if (tokenInput.length === 0) {
      setMintRealmAndSeasonPassError("Enter a realm ID to mint.");
      return;
    }

    let realmId: bigint;
    try {
      realmId = BigInt(tokenInput);
    } catch {
      setMintRealmAndSeasonPassError("Realm ID must be a valid integer.");
      return;
    }

    if (realmId < 0n) {
      setMintRealmAndSeasonPassError("Realm ID cannot be negative.");
      return;
    }

    setIsMintingRealmAndSeasonPass(true);
    setMintRealmAndSeasonPassError(null);
    setAutoSelectNextRealmTokenIdError(null);

    try {
      const signer = account as unknown as Account;
      const buildMintRealmCall = () => ({
        contractAddress: realmsAddress,
        entrypoint: "mint",
        calldata: CallData.compile([uint256.bnToUint256(realmId)]),
      });
      const buildMintSeasonPassCall = () => ({
        contractAddress: seasonPassAddress,
        entrypoint: "mint",
        calldata: CallData.compile([account.address, uint256.bnToUint256(realmId)]),
      });

      try {
        const mintRealmAndPassResult = await signer.execute([buildMintRealmCall(), buildMintSeasonPassCall()]);
        await waitForSubmittedTransaction(mintRealmAndPassResult, "mint realm + season pass");
      } catch (mintError) {
        if (!isRealmAlreadyMintedError(mintError)) {
          throw mintError;
        }

        // Realm exists already; fall back to minting just the season pass.
        const mintSeasonPassResult = await signer.execute(buildMintSeasonPassCall());
        await waitForSubmittedTransaction(mintSeasonPassResult, "mint season pass");
      }

      await refetchSeasonPassInventory();
      setSelectedSeasonPassTokenId(realmId);
      setMintRealmAndSeasonPassError(null);
    } catch (error) {
      setMintRealmAndSeasonPassError(mapSeasonPassMintError(error));
    } finally {
      setIsMintingRealmAndSeasonPass(false);
    }
  }, [
    account,
    seasonPassAddress,
    realmsAddress,
    mintRealmTokenIdInput,
    waitForSubmittedTransaction,
    refetchSeasonPassInventory,
  ]);

  // Enter game handler - navigates to the game.
  const handleEnterGame = useCallback(() => {
    const uiStore = useUIStore.getState();
    uiStore.setShowBlankOverlay(true);
    markGameEntryMilestone("enter-game-started");

    if (isSpectateMode) {
      const directEntryTarget = resolveGameEntryTarget({
        structureEntityId: uiStore.structureEntityId,
        worldMapReturnPosition: uiStore.worldMapReturnPosition,
        isSpectateMode: true,
      });

      if (directEntryTarget) {
        uiStore.setStructureEntityId(directEntryTarget.structureEntityId, {
          spectator: directEntryTarget.spectator,
          worldMapPosition: directEntryTarget.worldMapPosition,
        });

        navigate(directEntryTarget.url);
        window.dispatchEvent(new Event("urlChanged"));
        return;
      }
    }

    const setStructureEntityId = uiStore.setStructureEntityId;
    setStructureEntityId(0, {
      spectator: isSpectateMode,
    });

    const url = isSpectateMode ? `/play/map?col=0&row=0&spectate=true` : `/play/hex?col=0&row=0`;
    navigate(url);
    window.dispatchEvent(new Event("urlChanged"));
  }, [navigate, isSpectateMode]);

  const handleSeasonSettle = useCallback(async () => {
    if (!account?.address) return;
    const activeSeasonPlacement =
      unifiedSettlementPlannerEnabled && settlementPlannerRealmTarget
        ? {
            side: settlementPlannerRealmTarget.side,
            layer: settlementPlannerRealmTarget.layer,
            point: settlementPlannerRealmTarget.point,
          }
        : seasonPlacement;
    const activeSeasonPlacementErrors =
      unifiedSettlementPlannerEnabled && settlementPlannerRealmTarget ? [] : seasonPlacementErrors;

    if (unifiedSettlementPlannerEnabled && !settlementPlannerRealmTarget) {
      setSeasonSettlementError("Select a free realm hex on the planner map.");
      return;
    }
    if (!selectedSeasonPassTokenId) {
      setSeasonSettlementError("Select a season pass before settling.");
      return;
    }
    if (activeSeasonPlacementErrors.length > 0) {
      setSeasonSettlementError(activeSeasonPlacementErrors[0] ?? "Invalid settlement placement.");
      return;
    }
    if (!seasonTimingValid) {
      setSeasonSettlementError("Season timing invalid. Settlement is currently unavailable.");
      return;
    }
    if (!hasSeasonPass) {
      setSeasonSettlementError("Season pass not found in this wallet.");
      return;
    }
    if (!seasonPassAddress) {
      setSeasonSettlementError("Season pass contract not configured for this world.");
      return;
    }
    if (villagePassAddress && seasonPassAddress.toLowerCase() === villagePassAddress.toLowerCase()) {
      setSeasonSettlementError(
        `World config mismatch: season pass address points to village pass (${seasonPassAddress}). Update season_addresses_config on-chain.`,
      );
      return;
    }

    const realmIdBigInt = selectedSeasonPassTokenId;
    if (realmIdBigInt < 0n || realmIdBigInt > 4_294_967_295n) {
      setSeasonSettlementError("Season pass realm id is out of bounds.");
      return;
    }

    setIsSubmittingSeasonSettlement(true);
    setSeasonSettlementError(null);
    setSettlementPlannerConflict(null);

    if (unifiedSettlementPlannerEnabled && settlementPlannerRealmTarget) {
      captureClientEvent("planner_submit_clicked", {
        worldName,
        chain,
        targetType: "realm_slot",
      });
    }

    try {
      const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
      if (!factorySqlBaseUrl) {
        throw new Error(`Factory SQL base URL not configured for chain: ${chain}`);
      }

      const contracts = await resolveWorldContracts(factorySqlBaseUrl, worldName);
      const signer = account as unknown as Account;

      if (!spiresSettled) {
        if (worldMeta?.spiresMaxCount == null || worldMeta?.spiresSettledCount == null) {
          throw new Error("Unable to read spire settlement status for this world.");
        }

        const spirePlan = buildPendingSpireCreationPlan({
          spiresMaxCount: worldMeta.spiresMaxCount,
          spiresSettledCount: worldMeta.spiresSettledCount,
          spiresLayerDistance: worldMeta?.spiresLayerDistance ?? null,
          settlementLayerMax: worldMeta?.settlementLayerMax ?? null,
        });

        if (spirePlan.remainingCount > 0) {
          const spireSelector = normalizeSelector(SPIRE_SYSTEMS_SELECTOR);
          const spireSystemsAddress = contracts[spireSelector];
          if (!spireSystemsAddress) {
            throw new Error("spire_systems contract not found for selected world");
          }

          debugLog(worldName, "Submitting create_spires call:", {
            includeCenterSpire: spirePlan.includeCenterSpire,
            settlementsCount: spirePlan.settlements.length,
            remainingCount: spirePlan.remainingCount,
          });

          try {
            const createSpiresResult = await signer.execute({
              contractAddress: spireSystemsAddress,
              entrypoint: "create_spires",
              calldata: CallData.compile([
                spirePlan.includeCenterSpire,
                spirePlan.settlements.map((settlement) => ({
                  side: settlement.side,
                  layer: settlement.layer,
                  point: settlement.point,
                })),
              ]),
            });
            await waitForSubmittedTransaction(createSpiresResult, "create_spires");
          } catch (spireError) {
            if (!isSpiresAlreadySatisfiedError(spireError)) {
              throw spireError;
            }
            debugLog(worldName, "create_spires skipped - already satisfied", spireError);
          }

          const worldKey = getWorldKey({ name: worldName, chain });
          await queryClient.invalidateQueries({ queryKey: ["worldAvailability", worldKey] });
        }
      }

      const selector = normalizeSelector(REALM_SYSTEMS_SELECTOR);
      const realmSystemsAddress = contracts[selector];
      if (!realmSystemsAddress) {
        throw new Error("realm_systems contract not found for selected world");
      }

      const realmId = Number(realmIdBigInt);
      const owner = account.address;
      const frontend = account.address;

      const seasonPassTokenId = uint256.bnToUint256(realmIdBigInt);
      const optionalPlayerName = await resolveOptionalPlayerNameForSettlement();
      const settlementCalls: Call[] = [];
      if (optionalPlayerName) {
        settlementCalls.push(buildSetAddressNameCall(optionalPlayerName));
      }
      settlementCalls.push(
        {
          contractAddress: seasonPassAddress,
          entrypoint: "approve",
          calldata: CallData.compile([realmSystemsAddress, seasonPassTokenId]),
        },
        {
          contractAddress: realmSystemsAddress,
          entrypoint: "create",
          calldata: CallData.compile([
            owner,
            realmId,
            frontend,
            activeSeasonPlacement.side,
            activeSeasonPlacement.layer,
            activeSeasonPlacement.point,
          ]),
        },
      );

      const executeResult = await signer.execute(settlementCalls);
      await waitForSubmittedTransaction(
        executeResult,
        optionalPlayerName
          ? "set address name + approve season pass + season realm create"
          : "approve season pass + season realm create",
      );

      setSeasonSettlementError(null);
      void refetchSeasonPassInventory();
      void refetchDistributorVillagePassInventory();
      void refetchOwnedStructures();
      setSeasonSettlementComplete(true);
      setSettlementPlannerSuccess("Realm settled. New village slots will unlock on the planner as sync catches up.");

      if (unifiedSettlementPlannerEnabled && settlementPlannerRealmTarget) {
        setOptimisticRealmPlacements((current) => [
          ...current.filter((realm) => realm.id !== settlementPlannerRealmTarget.id),
          {
            id: settlementPlannerRealmTarget.id,
            coordX: settlementPlannerRealmTarget.coordX,
            coordY: settlementPlannerRealmTarget.coordY,
          },
        ]);
        setSettlementPlannerTarget(null);
        void settlementPlannerData.refetch();
        captureClientEvent("planner_submit_succeeded", {
          worldName,
          chain,
          targetType: "realm_slot",
        });
      }
    } catch (error) {
      debugLog(worldName, "Season settlement failed:", error);
      setSeasonSettlementError(mapSeasonSettleError(error));
      if (unifiedSettlementPlannerEnabled) {
        captureClientEvent("planner_submit_failed", {
          worldName,
          chain,
          targetType: "realm_slot",
        });
      }
    } finally {
      setIsSubmittingSeasonSettlement(false);
    }
  }, [
    account,
    unifiedSettlementPlannerEnabled,
    settlementPlannerRealmTarget,
    selectedSeasonPassTokenId,
    seasonPlacementErrors,
    seasonTimingValid,
    spiresSettled,
    hasSeasonPass,
    seasonPassAddress,
    villagePassAddress,
    chain,
    worldName,
    worldMeta?.spiresMaxCount,
    worldMeta?.spiresSettledCount,
    worldMeta?.spiresLayerDistance,
    worldMeta?.settlementLayerMax,
    seasonPlacement.side,
    seasonPlacement.layer,
    seasonPlacement.point,
    waitForSubmittedTransaction,
    resolveOptionalPlayerNameForSettlement,
    buildSetAddressNameCall,
    refetchSeasonPassInventory,
    refetchDistributorVillagePassInventory,
    refetchOwnedStructures,
    settlementPlannerData,
    queryClient,
  ]);

  const handleVillageSettle = useCallback(async () => {
    const activeVillageRealmEntityId =
      unifiedSettlementPlannerEnabled && settlementPlannerVillageTarget
        ? settlementPlannerVillageTarget.realmEntityId
        : selectedVillageRealmEntityId;
    const activeVillageDirection =
      unifiedSettlementPlannerEnabled && settlementPlannerVillageTarget
        ? settlementPlannerVillageTarget.direction
        : selectedVillageDirection;
    const activeVillageDirectionAvailable =
      unifiedSettlementPlannerEnabled && settlementPlannerVillageTarget
        ? !settlementPlannerVillageTarget.occupied && !settlementPlannerVillageTarget.pending
        : activeVillageDirection != null && selectedVillageAvailableDirections.has(activeVillageDirection);

    if (!account?.address) {
      setVillageSettlementError("Connect your wallet first.");
      return;
    }
    if (!setupResult) {
      setVillageSettlementError("Game setup is still loading.");
      return;
    }
    if (!seasonTimingValid) {
      setVillageSettlementError("Season timing invalid. Village settlement is currently unavailable.");
      return;
    }
    if (!villagePassAddress) {
      setVillageSettlementError("Village pass contract not configured for this world.");
      return;
    }
    if (!selectedVillagePassTokenId) {
      setVillageSettlementError("Select a village pass token before settling.");
      return;
    }
    if (unifiedSettlementPlannerEnabled && !settlementPlannerVillageTarget) {
      setVillageSettlementError("Select a free village slot on the planner map.");
      return;
    }
    if (activeVillageRealmEntityId == null) {
      setVillageSettlementError("Select a settled realm with a free village slot.");
      return;
    }
    if (activeVillageDirection == null) {
      setVillageSettlementError("Select an available direction slot.");
      return;
    }
    if (!activeVillageDirectionAvailable) {
      setVillageSettlementError("This direction slot is occupied. Choose another slot.");
      return;
    }

    setIsSubmittingVillageSettlement(true);
    setVillageSettlementError(null);
    setSettlementPlannerConflict(null);

    if (unifiedSettlementPlannerEnabled && settlementPlannerVillageTarget) {
      captureClientEvent("planner_submit_clicked", {
        worldName,
        chain,
        targetType: "village_slot",
      });
    }

    try {
      const signer = account as unknown as Account;
      const existingVillageIds = new Set(ownedVillageIdSet);
      const optionalPlayerName = await resolveOptionalPlayerNameForSettlement();
      const villageSettlementCalls = buildVillageSettlementCalls({
        signerAddress: account.address,
        villagePassTokenId: selectedVillagePassTokenId,
        connectedRealmEntityId: activeVillageRealmEntityId,
        direction: activeVillageDirection,
        villagePassAddress,
        optionalPlayerName,
      });

      const executeResult = await signer.execute(villageSettlementCalls);

      await waitForSubmittedTransaction(
        executeResult,
        optionalPlayerName ? "set address name + village_systems.create" : "village_systems.create",
      );

      const revealResult = await waitForVillageResourceReveal({
        ownerAddress: account.address,
        existingVillageIds,
      });

      setVillageRevealResult(revealResult);
      setVillageSettlementError(null);
      setEternumSettlementMode("village");
      setSettlementPlannerSuccess("Village settled. Reveal complete; you can keep planning from the map.");

      refetchVillagePassInventory();
      void refetchOwnedStructures();
      void refetchRealmVillageSlots();
      void settlementPlannerData.refetch();
      if (unifiedSettlementPlannerEnabled) {
        captureClientEvent("planner_submit_succeeded", {
          worldName,
          chain,
          targetType: "village_slot",
        });
      }
    } catch (error) {
      debugLog(worldName, "Village settlement failed:", error);
      setVillageSettlementError(mapVillageSettleError(error));
      if (unifiedSettlementPlannerEnabled) {
        captureClientEvent("planner_submit_failed", {
          worldName,
          chain,
          targetType: "village_slot",
        });
      }
    } finally {
      setIsSubmittingVillageSettlement(false);
    }
  }, [
    account,
    setupResult,
    unifiedSettlementPlannerEnabled,
    settlementPlannerVillageTarget,
    seasonTimingValid,
    villagePassAddress,
    selectedVillagePassTokenId,
    selectedVillageRealmEntityId,
    selectedVillageDirection,
    selectedVillageAvailableDirections,
    ownedVillageIdSet,
    resolveOptionalPlayerNameForSettlement,
    buildVillageSettlementCalls,
    waitForSubmittedTransaction,
    waitForVillageResourceReveal,
    refetchVillagePassInventory,
    refetchOwnedStructures,
    refetchRealmVillageSlots,
    settlementPlannerData,
    worldName,
    chain,
  ]);

  const handleSettleAnotherVillage = useCallback(() => {
    setVillageRevealResult(null);
    setVillageSettlementError(null);
    setEternumSettlementMode("village");
    setSettlementPlannerSuccess("Village settled. Choose another free slot or enter the game.");
    void refetchOwnedStructures();
    void refetchRealmVillageSlots();
    refetchVillagePassInventory();
    void settlementPlannerData.refetch();
  }, [refetchOwnedStructures, refetchRealmVillageSlots, refetchVillagePassInventory, settlementPlannerData]);

  // Settlement handler - calls actual Dojo system calls
  const handleSettle = useCallback(async () => {
    debugLog(worldName, "handleSettle called - hasSetupResult:", !!setupResult, "hasAccount:", !!account);
    if (!isBlitzMode) {
      debugLog(worldName, "Skipping blitz settlement call outside blitz mode");
      return;
    }
    if (!setupResult || !account) return;

    setIsSettling(true);

    try {
      const { systemCalls } = setupResult;
      const { configManager } = await import("@bibliothecadao/eternum");

      const isMainnet = env.VITE_PUBLIC_CHAIN === "mainnet";
      const blitzConfig = configManager.getBlitzConfig?.();
      const singleRealmMode = blitzConfig?.blitz_settlement_config?.single_realm_mode ?? false;

      debugLog(worldName, "Settlement config:", { isMainnet, singleRealmMode, blitzConfig });

      const initialSnapshot = await readSettlementSnapshot();
      if (!initialSnapshot) {
        throw new Error("Unable to read settlement status for current player.");
      }
      const initialStatus = syncSettlementStateFromSnapshot(initialSnapshot);
      let targetProgress = initialStatus.settledCount;

      const plan = buildSettlementExecutionPlan({
        isMainnet,
        singleRealmMode,
        snapshot: initialSnapshot,
      });
      debugLog(worldName, "Settlement execution plan:", plan);

      if (plan.missingAssignmentRegistration) {
        throw new Error("Cannot assign realm positions because the player is no longer in registered state.");
      }

      if (plan.shouldAssignAndSettle && plan.initialSettleCount > 0) {
        setSettleStage("assigning");
        debugLog(worldName, "Submitting assign + settle call:", { settlement_count: plan.initialSettleCount });
        const assignResult = await systemCalls.blitz_realm_assign_and_settle_realms({
          signer: account,
          settlement_count: plan.initialSettleCount,
        });
        await waitForSubmittedTransaction(assignResult, "assign_and_settle_realms");
        targetProgress = Math.min(plan.targetSettleCount, targetProgress + plan.initialSettleCount);
        await waitForSettlementTarget(targetProgress);
      }

      if (plan.extraSettleCalls > 0) {
        setSettleStage("settling");
        for (let i = 0; i < plan.extraSettleCalls; i++) {
          debugLog(worldName, `Extra settle call ${i + 1}/${plan.extraSettleCalls}`);
          const settleResult = await systemCalls.blitz_realm_settle_realms({ signer: account, settlement_count: 1 });
          await waitForSubmittedTransaction(settleResult, `settle_realms ${i + 1}/${plan.extraSettleCalls}`);
          targetProgress = Math.min(plan.targetSettleCount, targetProgress + 1);
          await waitForSettlementTarget(targetProgress);
        }
      }

      const finalSnapshot = await waitForSettlementTarget(plan.targetSettleCount);
      if (!finalSnapshot) {
        throw new Error("Timed out waiting for settlement progress.");
      }
      const finalStatus = syncSettlementStateFromSnapshot(finalSnapshot);
      if (finalStatus.settledCount < plan.targetSettleCount) {
        throw new Error(`Settlement incomplete: ${finalStatus.settledCount}/${plan.targetSettleCount} realms settled.`);
      }

      debugLog(worldName, "Settlement complete!");
      setSettleStage("done");
      setNeedsSettlement(false);

      // Auto-enter game after successful settlement
      setTimeout(() => {
        handleEnterGame();
      }, 1000);
    } catch (error) {
      debugLog(worldName, "Settlement failed:", error);
      setSettleStage("error");
    } finally {
      setIsSettling(false);
    }
  }, [
    setupResult,
    account,
    isBlitzMode,
    handleEnterGame,
    worldName,
    readSettlementSnapshot,
    syncSettlementStateFromSnapshot,
    waitForSettlementTarget,
    waitForSubmittedTransaction,
  ]);

  // Forge hyperstructures handler - creates new hyperstructures during registration period
  const handleForgeHyperstructures = useCallback(async () => {
    debugLog(worldName, "handleForgeHyperstructures called - hasAccount:", !!account);
    if (!isBlitzMode) {
      debugLog(worldName, "Skipping blitz forge flow outside blitz mode");
      return;
    }
    if (!account) return;

    setIsForging(true);

    try {
      const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
      if (!factorySqlBaseUrl) {
        throw new Error(`Factory SQL base URL not configured for chain: ${chain}`);
      }

      const contracts = await resolveWorldContracts(factorySqlBaseUrl, worldName);
      const selector = normalizeSelector(BLITZ_REALM_SYSTEMS_SELECTOR);
      const blitzRealmSystemsAddress = contracts[selector];
      if (!blitzRealmSystemsAddress) {
        throw new Error("blitz_realm_systems contract not found for selected world");
      }

      const batchSize = chain === "mainnet" ? 1 : 4;
      const hyperstructureCount = numHyperstructuresLeft > 0 ? Math.min(numHyperstructuresLeft, batchSize) : batchSize;
      const signer = account as unknown as Account;

      const { env } = await import("../../../../../env");
      const vrfProviderAddress = env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS;

      const calls = [];
      if (vrfProviderAddress !== undefined && Number(vrfProviderAddress) !== 0) {
        calls.push({
          contractAddress: vrfProviderAddress,
          entrypoint: "request_random",
          calldata: [blitzRealmSystemsAddress, 0, signer.address],
        });
      }
      calls.push({
        contractAddress: blitzRealmSystemsAddress,
        entrypoint: "make_hyperstructures",
        calldata: [hyperstructureCount.toString()],
      });

      debugLog(worldName, "Forging hyperstructures, count:", hyperstructureCount);
      await signer.execute(calls);

      debugLog(worldName, "Hyperstructures forged!");
      // Update local count
      setNumHyperstructuresLeft((prev) => Math.max(0, prev - hyperstructureCount));

      // Invalidate the world availability cache so the count updates on the landing page
      const worldKey = getWorldKey({ name: worldName, chain });
      queryClient.invalidateQueries({ queryKey: ["worldAvailability", worldKey] });
    } catch (error) {
      debugLog(worldName, "Forge hyperstructures failed:", error);
    } finally {
      setIsForging(false);
    }
  }, [account, isBlitzMode, worldName, chain, queryClient, numHyperstructuresLeft]);

  // Initialize a single hyperstructure
  const handleInitializeHyperstructure = useCallback(
    async (entityId: number) => {
      debugLog(worldName, "handleInitializeHyperstructure called for entityId:", entityId);
      if (!setupResult || !account) return;

      setIsInitializingHyperstructure(true);
      setCurrentInitializingId(entityId);

      try {
        const { systemCalls } = setupResult;

        await systemCalls.initialize_hyperstructure({
          signer: account,
          hyperstructure_id: entityId,
        });

        debugLog(worldName, "Hyperstructure initialized:", entityId);

        // Update local state
        setHyperstructures((prev) => prev.map((h) => (h.entityId === entityId ? { ...h, initialized: true } : h)));

        // Check if all are now initialized
        const remaining = hyperstructures.filter((h) => !h.initialized && h.entityId !== entityId);
        if (remaining.length === 0) {
          debugLog(worldName, "All hyperstructures initialized!");
          setNeedsHyperstructureInit(false);
        }
      } catch (error) {
        debugLog(worldName, "Failed to initialize hyperstructure:", error);
      } finally {
        setIsInitializingHyperstructure(false);
        setCurrentInitializingId(null);
      }
    },
    [setupResult, account, hyperstructures, worldName],
  );

  // Initialize all hyperstructures
  const handleInitializeAllHyperstructures = useCallback(async () => {
    debugLog(worldName, "handleInitializeAllHyperstructures called");
    if (!setupResult || !account) return;

    const uninitialized = hyperstructures.filter((h) => !h.initialized);
    if (uninitialized.length === 0) return;

    setIsInitializingHyperstructure(true);

    try {
      const { systemCalls } = setupResult;

      for (const hs of uninitialized) {
        setCurrentInitializingId(hs.entityId);
        debugLog(worldName, "Initializing hyperstructure:", hs.entityId);

        try {
          await systemCalls.initialize_hyperstructure({
            signer: account,
            hyperstructure_id: hs.entityId,
          });

          // Update local state
          setHyperstructures((prev) => prev.map((h) => (h.entityId === hs.entityId ? { ...h, initialized: true } : h)));
        } catch (error) {
          debugLog(worldName, "Failed to initialize hyperstructure:", hs.entityId, error);
          // Continue with next hyperstructure even if one fails
        }
      }

      debugLog(worldName, "All hyperstructures initialization complete!");
      setNeedsHyperstructureInit(false);
    } catch (error) {
      debugLog(worldName, "Failed to initialize hyperstructures:", error);
    } finally {
      setIsInitializingHyperstructure(false);
      setCurrentInitializingId(null);
    }
  }, [setupResult, account, hyperstructures, worldName]);

  // Auto-enter game when ready (spectate mode or already settled players)
  useEffect(() => {
    debugLog(worldName, "Auto-enter check - phase:", phase, "isSpectateMode:", isSpectateMode);
    const shouldAutoEnter = phase === "ready" && (!isEternumMode || eternumEntryIntent === "play");
    if (shouldAutoEnter) {
      debugLog(worldName, "Auto-entering game...");
      handleEnterGame();
    }
  }, [phase, handleEnterGame, worldName, isSpectateMode, isEternumMode, eternumEntryIntent]);

  debugLog(worldName, "Render - isOpen:", isOpen, "phase:", phase, "bootstrapStatus:", bootstrapStatus);

  if (!isOpen) return null;

  const handleClose = () => {
    debugLog(worldName, "Close button clicked");
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      debugLog(worldName, "Backdrop clicked");
      onClose();
    }
  };

  const showEternumSettlementModeToggle =
    isEternumMode &&
    !unifiedSettlementPlannerEnabled &&
    (phase === "season-pass-required" ||
      phase === "season-placement" ||
      phase === "village-pass-required" ||
      phase === "village-placement" ||
      phase === "ready");
  const usesDesktopCenteredSettlementLayout =
    isEternumMode &&
    (phase === "settlement-planner" ||
      phase === "season-pass-required" ||
      phase === "season-placement" ||
      phase === "village-pass-required" ||
      phase === "village-placement" ||
      phase === "village-reveal" ||
      phase === "ready");

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-black/70 backdrop-blur-sm",
        usesDesktopCenteredSettlementLayout
          ? "items-start pt-16 sm:pt-24 lg:items-center lg:px-6 lg:py-8 lg:pt-8"
          : "items-start pt-16 sm:pt-24",
      )}
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          "relative mx-4 flex w-full flex-col overflow-hidden rounded-xl border border-gold/40 bg-brown/95 shadow-2xl backdrop-blur-sm lg:mx-0",
          phase === "settlement-planner"
            ? "max-h-[92vh] max-w-7xl"
            : phase === "season-placement" || phase === "village-placement"
              ? "max-h-[88vh] max-w-6xl"
              : phase === "village-reveal"
                ? "max-w-lg"
                : "max-w-md",
          usesDesktopCenteredSettlementLayout && "lg:max-h-[min(54rem,calc(100vh-4rem))]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 text-xs text-gold/60 mb-1">
            {isForgeMode ? (
              <Sparkles className="w-3 h-3" />
            ) : isSpectateMode ? (
              <Eye className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            <span>{isForgeMode ? "Forging Hyperstructures" : isSpectateMode ? "Spectating" : "Entering"}</span>
          </div>
          <h3 className="text-lg font-bold text-gold truncate">{worldName}</h3>
        </div>

        {/* Content */}
        <div
          className={cn(
            "px-6 pb-6",
            phase === "settlement-planner"
              ? "max-h-[calc(92vh-86px)] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent"
              : (phase === "season-placement" || phase === "village-placement") &&
                  "max-h-[calc(88vh-86px)] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent",
            usesDesktopCenteredSettlementLayout &&
              "lg:min-h-0 lg:flex-1 lg:max-h-none lg:overflow-y-auto lg:pr-4 lg:scrollbar-thin lg:scrollbar-thumb-gold/20 lg:scrollbar-track-transparent",
          )}
        >
          {showEternumSettlementModeToggle && (
            <div className="mb-3 flex items-center justify-center">
              <div className="inline-flex rounded-lg border border-gold/25 bg-black/30 p-1">
                <button
                  type="button"
                  onClick={() => setEternumSettlementMode("realm")}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs transition-colors",
                    eternumSettlementMode === "realm"
                      ? "bg-gold text-brown font-semibold"
                      : "text-gold/75 hover:text-gold hover:bg-gold/10",
                  )}
                >
                  Realm Pass
                </button>
                <button
                  type="button"
                  onClick={() => setEternumSettlementMode("village")}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs transition-colors",
                    eternumSettlementMode === "village"
                      ? "bg-gold text-brown font-semibold"
                      : "text-gold/75 hover:text-gold hover:bg-gold/10",
                  )}
                >
                  Village Pass
                </button>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {(phase === "loading" || phase === "error") && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <BootstrapLoadingPanel tasks={tasks} progress={progress} error={phaseError} onRetry={handleRetry} />
              </motion.div>
            )}
            {phase === "forge" && (
              <motion.div key="forge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ForgeHyperstructuresPhase
                  numHyperstructuresLeft={numHyperstructuresLeft}
                  isForging={isForging}
                  onForge={handleForgeHyperstructures}
                  onClose={onClose}
                />
              </motion.div>
            )}
            {phase === "hyperstructure" && (
              <motion.div key="hyperstructure" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <HyperstructurePhase
                  hyperstructures={hyperstructures}
                  isInitializing={isInitializingHyperstructure}
                  currentInitializingId={currentInitializingId}
                  onInitialize={handleInitializeHyperstructure}
                  onInitializeAll={handleInitializeAllHyperstructures}
                />
              </motion.div>
            )}
            {phase === "settlement" && (
              <motion.div key="settlement" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SettlementPhase
                  stage={settleStage}
                  assignedCount={assignedRealmCount}
                  settledCount={settledRealmCount}
                  isSettling={isSettling}
                  onSettle={handleSettle}
                  onEnterGame={handleEnterGame}
                />
              </motion.div>
            )}
            {phase === "settlement-planner" && (
              <motion.div
                key="settlement-planner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SettlementPlannerPhase
                  plannerData={settlementPlannerData}
                  selectedTarget={settlementPlannerTarget}
                  onSelectTarget={handleSettlementPlannerTargetSelect}
                  isLoadingPlanner={settlementPlannerData.isLoading}
                  plannerDataError={settlementPlannerData.snapshotError ?? settlementPlannerData.exploredTilesError}
                  plannerConflict={settlementPlannerConflict}
                  plannerSuccess={settlementPlannerSuccess}
                  seasonTimingValid={seasonTimingValid}
                  spiresSettled={spiresSettled}
                  spiresSettledCount={spiresSettledCount}
                  spiresMaxCount={spiresMaxCount}
                  canEnterGame={hasSettledRealm || seasonSettlementComplete}
                  seasonPassBalance={seasonPassBalance}
                  seasonPasses={seasonPasses}
                  selectedSeasonPassTokenId={selectedSeasonPassTokenId}
                  onSelectSeasonPass={setSelectedSeasonPassTokenId}
                  onRefreshSeasonPassInventory={refetchSeasonPassInventory}
                  isRefreshingSeasonPassInventory={isLoadingSeasonPassInventory}
                  seasonPassInventoryError={seasonPassInventoryWarning}
                  villagePassBalance={villagePassBalance}
                  villagePasses={villagePasses}
                  selectedVillagePassTokenId={selectedVillagePassTokenId}
                  onSelectVillagePass={setSelectedVillagePassTokenId}
                  onRefreshVillagePassInventory={refetchVillagePassInventory}
                  isRefreshingVillagePassInventory={isLoadingVillagePassInventory}
                  villagePassInventoryError={villagePassInventoryWarning}
                  distributorAddress={VILLAGE_PASS_DISTRIBUTOR_ADDRESS}
                  distributorBalance={distributorVillagePassBalance}
                  distributorPasses={distributorVillagePasses}
                  isLoadingDistributorInventory={isLoadingDistributorVillagePassInventory}
                  distributorInventoryError={distributorVillagePassInventoryWarning}
                  onSendVillagePassToConnectedWallet={handleSendVillagePassToConnectedWallet}
                  isSendingVillagePass={isSendingVillagePassFromDistributor}
                  sendVillagePassError={villagePassDistributorTransferError}
                  isWalletConnected={Boolean(account?.address)}
                  onGetSeasonPass={handleGetSeasonPass}
                  onGetVillagePass={handleGetVillagePass}
                  canUseSandboxMintFlow={canUseSandboxMintFlow}
                  mintRealmTokenIdInput={mintRealmTokenIdInput}
                  onMintRealmTokenIdInputChange={setMintRealmTokenIdInput}
                  onAutoSelectNextRealmTokenId={handleAutoSelectNextRealmTokenId}
                  isAutoSelectingNextRealmTokenId={isAutoSelectingNextRealmTokenId}
                  autoSelectNextRealmTokenIdError={autoSelectNextRealmTokenIdError}
                  onMintRealmAndSeasonPass={handleMintRealmAndSeasonPass}
                  isMintingRealmAndSeasonPass={isMintingRealmAndSeasonPass}
                  mintRealmAndSeasonPassError={mintRealmAndSeasonPassError}
                  onConfirmRealmSettlement={handleSeasonSettle}
                  onConfirmVillageSettlement={handleVillageSettle}
                  isSubmittingRealmSettlement={isSubmittingSeasonSettlement}
                  isSubmittingVillageSettlement={isSubmittingVillageSettlement}
                  seasonSettlementError={seasonSettlementError}
                  villageSettlementError={villageSettlementError ?? ownedStructuresError}
                  onEnterGame={handleEnterGame}
                  plannerComponents={setupResult?.components ?? null}
                />
              </motion.div>
            )}
            {phase === "season-pass-required" && (
              <motion.div
                key="season-pass-required"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SeasonPassRequiredPhase
                  onGetSeasonPass={handleGetSeasonPass}
                  onSwitchToVillageMode={() => setEternumSettlementMode("village")}
                  showVillageShortcut={true}
                  canUseSandboxMintFlow={canUseSandboxMintFlow}
                  mintRealmTokenIdInput={mintRealmTokenIdInput}
                  onMintRealmTokenIdInputChange={setMintRealmTokenIdInput}
                  onAutoSelectNextRealmTokenId={handleAutoSelectNextRealmTokenId}
                  isAutoSelectingNextRealmTokenId={isAutoSelectingNextRealmTokenId}
                  autoSelectNextRealmTokenIdError={autoSelectNextRealmTokenIdError}
                  onMintRealmAndSeasonPass={handleMintRealmAndSeasonPass}
                  isMintingRealmAndSeasonPass={isMintingRealmAndSeasonPass}
                  mintRealmAndSeasonPassError={mintRealmAndSeasonPassError}
                  onRefreshSeasonPassInventory={refetchSeasonPassInventory}
                  isRefreshingSeasonPassInventory={isLoadingSeasonPassInventory}
                  seasonPassInventoryError={seasonPassInventoryWarning}
                />
              </motion.div>
            )}
            {phase === "season-placement" && (
              <motion.div
                key="season-placement"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SeasonPlacementPhase
                  placement={seasonPlacement}
                  onPlacementChange={setSeasonPlacement}
                  canSettle={canAttemptSeasonSettle}
                  seasonTimingValid={seasonTimingValid}
                  spiresSettled={spiresSettled}
                  spiresSettledCount={spiresSettledCount}
                  spiresMaxCount={spiresMaxCount}
                  hasSeasonPass={hasSeasonPass}
                  seasonPassBalance={seasonPassBalance}
                  seasonPasses={seasonPasses}
                  selectedSeasonPassTokenId={selectedSeasonPassTokenId}
                  onSelectSeasonPass={setSelectedSeasonPassTokenId}
                  onConfirmSettlement={handleSeasonSettle}
                  isSubmittingSettlement={isSubmittingSeasonSettlement}
                  placementValidationErrors={seasonPlacementErrors}
                  targetCoordPreview={targetCoordPreview}
                  settlementError={seasonSettlementError}
                  layerMax={worldMeta?.settlementLayerMax ?? null}
                  layersSkipped={worldMeta?.settlementLayersSkipped ?? null}
                  settlementBaseDistance={worldMeta?.settlementBaseDistance ?? null}
                  mapCenterOffset={worldMeta?.mapCenterOffset ?? null}
                  occupiedCoordKeys={seasonOccupiedCoordKeys}
                  isLoadingOccupiedSlots={isLoadingSeasonOccupiedSlots}
                  occupiedSlotsError={seasonOccupiedSlotsError}
                  seasonPassInventoryError={seasonPassInventoryWarning}
                />
              </motion.div>
            )}
            {phase === "village-pass-required" && (
              <motion.div
                key="village-pass-required"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <VillagePassRequiredPhase
                  distributorAddress={VILLAGE_PASS_DISTRIBUTOR_ADDRESS}
                  distributorBalance={distributorVillagePassBalance}
                  distributorPasses={distributorVillagePasses}
                  isLoadingDistributorInventory={isLoadingDistributorVillagePassInventory}
                  distributorInventoryError={distributorVillagePassInventoryWarning}
                  onSendVillagePassToConnectedWallet={handleSendVillagePassToConnectedWallet}
                  isSendingVillagePass={isSendingVillagePassFromDistributor}
                  sendVillagePassError={villagePassDistributorTransferError}
                  isWalletConnected={Boolean(account?.address)}
                  onGetVillagePass={handleGetVillagePass}
                  onSwitchToRealmMode={() => setEternumSettlementMode("realm")}
                  showRealmShortcut={true}
                />
              </motion.div>
            )}
            {phase === "village-placement" && (
              <motion.div
                key="village-placement"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <VillagePlacementPhase
                  villagePassBalance={villagePassBalance}
                  villagePasses={villagePasses}
                  distributorAddress={VILLAGE_PASS_DISTRIBUTOR_ADDRESS}
                  distributorBalance={distributorVillagePassBalance}
                  distributorPasses={distributorVillagePasses}
                  isLoadingDistributorInventory={isLoadingDistributorVillagePassInventory}
                  distributorInventoryError={distributorVillagePassInventoryWarning}
                  onSendVillagePassToConnectedWallet={handleSendVillagePassToConnectedWallet}
                  isSendingVillagePass={isSendingVillagePassFromDistributor}
                  sendVillagePassError={villagePassDistributorTransferError}
                  isWalletConnected={Boolean(account?.address)}
                  selectedVillagePassTokenId={selectedVillagePassTokenId}
                  onSelectVillagePass={setSelectedVillagePassTokenId}
                  settleableRealms={settleableVillageRealms}
                  selectedRealmEntityId={selectedVillageRealmEntityId}
                  onSelectRealmEntityId={setSelectedVillageRealmEntityId}
                  directionSlots={villageDirectionSlots}
                  selectedDirection={selectedVillageDirection}
                  onSelectDirection={setSelectedVillageDirection}
                  onConfirmSettlement={handleVillageSettle}
                  isSubmittingSettlement={isSubmittingVillageSettlement}
                  settlementError={villageSettlementError ?? ownedStructuresError}
                  villagePassInventoryError={villagePassInventoryWarning}
                  villageSlotsError={villageSlotsError}
                />
              </motion.div>
            )}
            {phase === "village-reveal" && villageRevealResult && (
              <motion.div key="village-reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VillageRevealPhase
                  key={villageRevealResult.villageEntityId}
                  result={villageRevealResult}
                  onEnterGame={handleEnterGame}
                  onSettleAnotherVillage={handleSettleAnotherVillage}
                />
              </motion.div>
            )}
            {phase === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-4"
              >
                <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-gold mb-2">Ready!</h2>
                <p className="text-sm text-white/60 mb-4">
                  {isSpectateMode ? "Entering spectate mode..." : "Your realm awaits"}
                </p>
                {!isSpectateMode && (
                  <Button
                    onClick={handleEnterGame}
                    className="w-full h-11 !text-brown !bg-gold rounded-md"
                    forceUppercase={false}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Play className="w-4 h-4" />
                      <span>Play</span>
                    </div>
                  </Button>
                )}
                {!isSpectateMode && isEternumMode && (
                  <Button
                    onClick={() => setEternumSettlementMode("village")}
                    variant="outline"
                    className="w-full h-10 mt-2"
                    forceUppercase={false}
                  >
                    Settle Village
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
