/**
 * GameEntryModal - Combined loading + settlement modal for seamless game entry
 *
 * This modal shows:
 * 1. Loading phase - Bootstrap progress (world config, Dojo setup, sync)
 * 2. Settlement phase - If user is registered but hasn't settled
 * 3. Auto-transitions to game when ready
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Eye,
  Loader2,
  Check,
  Castle,
  MapPin,
  Pickaxe,
  Sparkles,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import type { BootstrapTask } from "@/hooks/context/use-eager-bootstrap";
import type { SetupResult } from "@/init/bootstrap";
import { bootstrapGame } from "@/init/bootstrap";
import { applyWorldSelection } from "@/runtime/world";
import { getFactorySqlBaseUrl } from "@/runtime/world/factory-endpoints";
import { resolveWorldContracts } from "@/runtime/world/factory-resolver";
import { normalizeSelector } from "@/runtime/world/normalize";
import { sqlApi } from "@/services/api";
import { refreshSessionPolicies } from "@/hooks/context/session-policy-refresh";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getWorldKey, useWorldsAvailability } from "@/hooks/use-world-availability";
import { useSeasonPassInventory, type SeasonPassInventoryItem } from "@/hooks/use-season-pass-inventory";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { BootstrapLoadingPanel } from "@/ui/layouts/bootstrap-loading/bootstrap-loading-panel";
import {
  buildSettlementExecutionPlan,
  deriveSettlementStatus,
  type SettlementSnapshot,
} from "./game-entry-settlement.utils";
import { Coord, Direction, ResourcesIds } from "@bibliothecadao/types";
import { getSeasonAddresses, type Chain } from "@contracts";
import { CallData, type Account } from "starknet";

const DEBUG_MODAL = false;
const BLITZ_REALM_SYSTEMS_SELECTOR = "0x3414be5ba2c90784f15eb572e9222b5c83a6865ec0e475a57d7dc18af9b3742";
const REALM_SYSTEMS_SELECTOR = "0x3b4cc14cbb49692c85e1b132ac8536fe7d0d1361cd2fb5ba8df29f726ca02d2";
const SETTLEMENT_PROGRESS_POLL_MS = 1000;
const SETTLEMENT_PROGRESS_TIMEOUT_MS = 30000;
const CONTRACT_MAP_CENTER = 2147483646;

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

const resolveResourceLabel = (resourceId: number): string | null => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : null;
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

type SeasonPlacementSlot = {
  id: string;
  side: number;
  layer: number;
  point: number;
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
  occupied: boolean;
};

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

  if (message.includes("occupied")) {
    return "Destination occupied. Choose another side/layer/point.";
  }

  if (
    message.includes("season is over") ||
    message.includes("settling") ||
    message.includes("timing") ||
    message.includes("spires")
  ) {
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

const SEASON_MAP_HEX_RADIUS = 6.5;
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

const buildSeasonMapHexPoints = (centerX: number, centerY: number): string => {
  const points: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    const x = centerX + SEASON_MAP_HEX_RADIUS * Math.cos(angle);
    const y = centerY + SEASON_MAP_HEX_RADIUS * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
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

const buildSeasonPlacementViewBox = (
  slots: SeasonPlacementSlot[],
  selectedSlot: SeasonPlacementSlot | null,
): string => {
  if (slots.length === 0) {
    return "-120 -120 240 240";
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const slot of slots) {
    minX = Math.min(minX, slot.pixelX - SEASON_MAP_HEX_RADIUS);
    maxX = Math.max(maxX, slot.pixelX + SEASON_MAP_HEX_RADIUS);
    minY = Math.min(minY, slot.pixelY - SEASON_MAP_HEX_RADIUS);
    maxY = Math.max(maxY, slot.pixelY + SEASON_MAP_HEX_RADIUS);
  }

  const padding = 22;
  const boundedMinX = minX - padding;
  const boundedMaxX = maxX + padding;
  const boundedMinY = minY - padding;
  const boundedMaxY = maxY + padding;
  const width = Math.max(1, boundedMaxX - boundedMinX);
  const height = Math.max(1, boundedMaxY - boundedMinY);

  if (!selectedSlot) {
    return `${boundedMinX} ${boundedMinY} ${width} ${height}`;
  }

  const focusWidth = Math.max(170, width * 0.78);
  const focusHeight = Math.max(170, height * 0.78);
  const rawViewX = selectedSlot.pixelX - focusWidth / 2;
  const rawViewY = selectedSlot.pixelY - focusHeight / 2;
  const clampedViewX = Math.max(boundedMinX, Math.min(rawViewX, boundedMaxX - focusWidth));
  const clampedViewY = Math.max(boundedMinY, Math.min(rawViewY, boundedMaxY - focusHeight));

  return `${clampedViewX} ${clampedViewY} ${focusWidth} ${focusHeight}`;
};

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

// Types
type BootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";
type SettleStage = "idle" | "assigning" | "settling" | "done" | "error";
type ModalPhase =
  | "loading"
  | "forge"
  | "hyperstructure"
  | "settlement"
  | "season-pass-required"
  | "season-placement"
  | "ready"
  | "error";

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

const SeasonPassRequiredPhase = ({ onGetSeasonPass }: { onGetSeasonPass: () => void }) => {
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
    </div>
  );
};

const SeasonPlacementPhase = ({
  placement,
  onPlacementChange,
  canSettle,
  seasonTimingValid,
  spiresSettled,
  hasSeasonPass,
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
  hasSeasonPass: boolean;
  seasonPasses: SeasonPassInventoryItem[];
  selectedSeasonPassTokenId: bigint | null;
  onSelectSeasonPass: (tokenId: bigint) => void;
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
  const minLayer = Math.max(1, (layersSkipped ?? 0) + 1);
  const maxPointForLayer = Math.max(0, placement.layer - 1);
  const canSubmit =
    Boolean(selectedSeasonPass) && canSettle && placementValidationErrors.length === 0 && !isSubmittingSettlement;
  const checks = [
    { id: "season", label: "Season timing valid", ok: seasonTimingValid },
    { id: "spires", label: "Spires settled", ok: spiresSettled },
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
  const occupiedSlotCount = useMemo(
    () => placementSlots.reduce((count, slot) => (slot.occupied ? count + 1 : count), 0),
    [placementSlots],
  );
  const selectedSlotId = toSeasonPlacementSlotId(placement.side, placement.layer, placement.point);
  const selectedPlacementSlot = useMemo(
    () => placementSlots.find((slot) => slot.id === selectedSlotId) ?? null,
    [placementSlots, selectedSlotId],
  );
  const mapViewBox = useMemo(
    () => buildSeasonPlacementViewBox(placementSlots, selectedPlacementSlot),
    [placementSlots, selectedPlacementSlot],
  );

  return (
    <div className="flex flex-col">
      <div className="text-center mb-4">
        <img src="/images/logos/eternum-loader.png" className="mx-auto w-20 mb-3" alt="Season settlement" />
        <h2 className="text-lg font-semibold text-gold">Choose Settlement Placement</h2>
        <p className="text-xs text-gold/60 mt-1">
          Click any valid hex on the map overlay to populate side/layer/point automatically.
        </p>
      </div>

      <div className="rounded-md border border-gold/20 bg-black/20 px-2 py-1.5 mb-4">
        <span className="text-xs text-gold/70">
          Placement format: <span className="text-gold">side (0-5), layer (ring), point (0..layer-1)</span>
        </span>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gold mb-2">Select a Season Pass:</p>
        <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
          {seasonPasses.map((pass) => {
            const isSelected = selectedSeasonPassTokenId === pass.tokenId;
            return (
              <div
                key={pass.tokenId.toString()}
                className={cn(
                  "rounded-lg border p-2 transition-colors",
                  isSelected ? "border-gold/50 bg-gold/10" : "border-gold/20 bg-black/20",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gold truncate">{pass.realmName}</p>
                    <p className="text-[11px] text-gold/50">Realm #{pass.realmId}</p>
                  </div>
                  <Button
                    onClick={() => onSelectSeasonPass(pass.tokenId)}
                    variant={isSelected ? "default" : "outline"}
                    size="xs"
                    forceUppercase={false}
                    className={cn(isSelected ? "!bg-gold !text-brown" : "")}
                  >
                    {isSelected ? "Selected" : "Settle"}
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pass.resourceIds.length > 0 ? (
                    pass.resourceIds.map((resourceId, index) => {
                      const resourceLabel = resolveResourceLabel(resourceId);
                      if (!resourceLabel) return null;
                      return (
                        <div
                          key={`${pass.tokenId.toString()}-${resourceId}-${index}`}
                          className="inline-flex items-center gap-1 rounded-md border border-gold/20 bg-black/25 px-1.5 py-1"
                        >
                          <ResourceIcon resource={resourceLabel} size="xs" withTooltip={false} />
                          <span className="text-[10px] text-gold/70">{resourceLabel}</span>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-[11px] text-gold/50">No allowed resources decoded.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedSeasonPass && (
        <div className="rounded-md border border-gold/20 bg-black/20 px-2 py-1.5 mb-4">
          <span className="text-xs text-gold/70">
            Selected pass: <span className="text-gold">{selectedSeasonPass.realmName}</span> (Realm #
            {selectedSeasonPass.realmId})
          </span>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-gold mb-2">Map placement overlay</p>
        <div className="relative h-64 overflow-hidden rounded-lg border border-gold/20 bg-black/35">
          <div
            className="absolute inset-0 bg-[url('/images/covers/blitz/07.png')] bg-cover bg-center opacity-20"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/70" aria-hidden />
          <svg
            viewBox={mapViewBox}
            className="relative z-10 h-full w-full"
            role="img"
            aria-label="Season settlement placement map"
          >
            {placementSlots.map((slot) => {
              const isSelected = slot.id === selectedSlotId;
              const isSelectable = !slot.occupied;
              return (
                <polygon
                  key={slot.id}
                  points={buildSeasonMapHexPoints(slot.pixelX, slot.pixelY)}
                  fill={isSelected ? "#f4d25a" : slot.occupied ? "#4b5563" : "#34d399"}
                  fillOpacity={isSelected ? 0.88 : slot.occupied ? 0.35 : 0.28}
                  stroke={isSelected ? "#fef3c7" : slot.occupied ? "#9ca3af" : "#86efac"}
                  strokeWidth={isSelected ? 1.15 : 0.85}
                  strokeOpacity={isSelected ? 1 : slot.occupied ? 0.45 : 0.72}
                  className={cn(isSelectable && "cursor-pointer")}
                  onClick={() => {
                    if (!isSelectable) return;
                    onPlacementChange({
                      side: slot.side,
                      layer: slot.layer,
                      point: slot.point,
                    });
                  }}
                />
              );
            })}
          </svg>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-gold/65">
          <span>Valid slots: {placementSlots.length}</span>
          <span>Occupied: {occupiedSlotCount}</span>
        </div>
        {selectedPlacementSlot && (
          <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5">
            <p className="text-xs text-emerald-200">
              Selected hex: side {selectedPlacementSlot.side}, layer {selectedPlacementSlot.layer}, point{" "}
              {selectedPlacementSlot.point}
              {" · "}x {selectedPlacementSlot.x}, y {selectedPlacementSlot.y}
            </p>
          </div>
        )}
        {isLoadingOccupiedSlots && (
          <p className="mt-2 text-[11px] text-gold/60">Loading occupied settlement slots...</p>
        )}
        {occupiedSlotsError && <p className="mt-2 text-[11px] text-amber-200/80">{occupiedSlotsError}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <label className="text-xs text-gold/60">
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
            className="mt-1 w-full rounded-md bg-black/20 border border-gold/20 px-2 py-1 text-sm text-gold"
          />
        </label>
        <label className="text-xs text-gold/60">
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
            className="mt-1 w-full rounded-md bg-black/20 border border-gold/20 px-2 py-1 text-sm text-gold"
          />
        </label>
        <label className="text-xs text-gold/60">
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
            className="mt-1 w-full rounded-md bg-black/20 border border-gold/20 px-2 py-1 text-sm text-gold"
          />
        </label>
      </div>

      <div className="space-y-2 mb-4">
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-center justify-between rounded-md border border-gold/20 bg-black/20 px-2 py-1.5"
          >
            <span className="text-xs text-gold/70">{check.label}</span>
            {check.ok ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-300" />}
          </div>
        ))}
      </div>

      {targetCoordPreview && (
        <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 mb-4">
          <p className="text-xs text-emerald-200">
            Target coordinate preview: <span className="text-emerald-100">x {targetCoordPreview.x}</span>,{" "}
            <span className="text-emerald-100">y {targetCoordPreview.y}</span>
          </p>
        </div>
      )}

      {placementValidationErrors.length > 0 && (
        <div className="rounded-md border border-red-400/20 bg-red-500/10 px-2 py-2 mb-3">
          {placementValidationErrors.map((placementError, index) => (
            <p key={`${placementError}-${index}`} className="text-xs text-red-200">
              {placementError}
            </p>
          ))}
        </div>
      )}

      <Button
        disabled={!canSubmit}
        onClick={onConfirmSettlement}
        className="w-full h-11 !text-brown !bg-gold rounded-md"
        forceUppercase={false}
      >
        <div className="flex items-center justify-center gap-2">
          {isSubmittingSettlement ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          <span>{isSubmittingSettlement ? "Settling..." : "Settle Realm"}</span>
        </div>
      </Button>

      {seasonPassInventoryError && (
        <p className="text-[11px] text-amber-200/80 mt-2">
          Could not refresh season pass metadata. Try reopening the modal.
        </p>
      )}
      {settlementError && <p className="text-[11px] text-red-200 mt-2">{settlementError}</p>}
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
  isForgeMode = false,
  numHyperstructuresLeft: initialNumHyperstructuresLeft,
}: GameEntryModalProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const syncProgress = useSyncStore((state) => state.initialSyncProgress);
  const account = useAccountStore((state) => state.account);
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

  // Bootstrap state
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>("idle");
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
  const [seasonPlacement, setSeasonPlacement] = useState<SeasonPlacement>(DEFAULT_SEASON_PLACEMENT);
  const [selectedSeasonPassTokenId, setSelectedSeasonPassTokenId] = useState<bigint | null>(null);
  const [isSubmittingSeasonSettlement, setIsSubmittingSeasonSettlement] = useState(false);
  const [seasonSettlementError, setSeasonSettlementError] = useState<string | null>(null);
  const [seasonSettlementComplete, setSeasonSettlementComplete] = useState(false);
  const hasEnteredGameRef = useRef(false);

  const seasonPassAddress = worldMeta?.seasonPassAddress ?? getSeasonAddresses(chain).seasonPass;
  const {
    seasonPasses,
    isLoading: isLoadingSeasonPassInventory,
    error: seasonPassInventoryError,
  } = useSeasonPassInventory({
    chain,
    ownerAddress: account?.address,
    seasonPassAddress,
    enabled: isOpen && isEternumMode,
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

  useEffect(() => {
    if (!isOpen) {
      hasEnteredGameRef.current = false;
      setIsSubmittingSeasonSettlement(false);
      setSeasonSettlementError(null);
      setSeasonSettlementComplete(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isEternumMode || seasonPasses.length === 0) {
      setSelectedSeasonPassTokenId(null);
      return;
    }

    setSelectedSeasonPassTokenId((current) => {
      if (current != null && seasonPasses.some((pass) => pass.tokenId === current)) {
        return current;
      }
      return seasonPasses[0]?.tokenId ?? null;
    });
  }, [isEternumMode, seasonPasses]);

  useEffect(() => {
    if (!isEternumMode) return;
    const minimumLayer = Math.max(1, (worldMeta?.settlementLayersSkipped ?? 0) + 1);
    setSeasonPlacement((current) => {
      if (current.layer >= minimumLayer) return current;
      return {
        ...current,
        layer: minimumLayer,
        point: 0,
      };
    });
  }, [isEternumMode, worldMeta?.settlementLayersSkipped]);

  useEffect(() => {
    setSeasonSettlementError(null);
  }, [selectedSeasonPassTokenId, seasonPlacement.side, seasonPlacement.layer, seasonPlacement.point]);

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
  const seasonTimingValid =
    worldMeta?.startMainAt != null &&
    worldMeta?.endAt != null &&
    worldMeta.startMainAt <= nowSeconds &&
    nowSeconds <= worldMeta.endAt;
  const spiresSettled = (worldMeta?.spiresSettledCount ?? 0) > 0;
  const hasSeasonPass = seasonPasses.length > 0;
  const canAttemptSeasonSettle = seasonTimingValid && spiresSettled && hasSeasonPass;
  const isLoadingEternumPrereqs = isCheckingWorldAvailability || isLoadingSeasonPassInventory || !worldMeta;
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

  // Both checks must complete before we can determine the final phase
  const checksComplete = settlementCheckComplete && hyperstructureCheckComplete;

  // Determine current phase
  const phase: ModalPhase = useMemo(() => {
    let result: ModalPhase;
    if (isForgeMode && isBlitzMode) {
      // Forge mode does not require game bootstrap or settlement checks
      result = "forge";
    } else if (bootstrapError || bootstrapStatus === "error") {
      result = "error";
    } else if (bootstrapStatus !== "ready") {
      result = "loading";
    } else if (isSpectateMode) {
      result = "ready";
    } else if (worldMode === "unknown" || isCheckingWorldAvailability || !worldMeta) {
      result = "loading";
    } else if (isEternumMode) {
      if (isLoadingEternumPrereqs) {
        result = "loading";
      } else if (!hasSeasonPass) {
        result = "season-pass-required";
      } else if (seasonSettlementComplete) {
        result = "ready";
      } else {
        result = "season-placement";
      }
    } else if (!checksComplete) {
      // Still checking settlement/hyperstructure status - stay in loading
      result = "loading";
    } else if (needsHyperstructureInit) {
      // Hyperstructure init takes priority over settlement
      result = "hyperstructure";
    } else if (needsSettlement) {
      result = "settlement";
    } else {
      result = "ready";
    }

    debugLog(worldName, "Phase determined:", result, {
      bootstrapStatus,
      hasError: !!bootstrapError,
      isForgeMode,
      isBlitzMode,
      isSpectateMode,
      checksComplete,
      settlementCheckComplete,
      hyperstructureCheckComplete,
      needsHyperstructureInit,
      needsSettlement,
      worldMode,
      startMainAt: worldMeta?.startMainAt,
      endAt: worldMeta?.endAt,
      spiresSettledCount: worldMeta?.spiresSettledCount,
      seasonPassAddress: worldMeta?.seasonPassAddress,
      settlementLayerMax: worldMeta?.settlementLayerMax,
      settlementLayersSkipped: worldMeta?.settlementLayersSkipped,
      mapCenterOffset: worldMeta?.mapCenterOffset,
      seasonPassCount: seasonPasses.length,
      selectedSeasonPassTokenId: selectedSeasonPassTokenId?.toString() ?? null,
      seasonPlacement,
      seasonPlacementErrors,
      selectedSeasonPlacementIsOccupied,
      targetCoordPreview,
      seasonSettlementComplete,
      hasSeasonPass,
      canAttemptSeasonSettle,
    });

    return result;
  }, [
    bootstrapStatus,
    bootstrapError,
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
    hasSeasonPass,
    worldMode,
    worldMeta,
    seasonPasses,
    selectedSeasonPassTokenId,
    seasonPlacement,
    seasonPlacementErrors,
    selectedSeasonPlacementIsOccupied,
    targetCoordPreview,
    canAttemptSeasonSettle,
    worldName,
  ]);

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
    async (result: unknown, label: string) => {
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

      throw new Error(`Unable to confirm ${label}: no transaction wait method available`);
    },
    [setupResult, account],
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
        setSeasonPlacement(DEFAULT_SEASON_PLACEMENT);
        setSelectedSeasonPassTokenId(null);
        setIsSubmittingSeasonSettlement(false);
        setSeasonSettlementError(null);
        setSeasonSettlementComplete(false);

        // Apply world selection first
        debugLog(worldName, "Applying world selection...");
        updateTask("world", "running");
        await applyWorldSelection({ name: worldName, chain }, chain);
        updateTask("world", "complete");
        debugLog(worldName, "World selection complete");

        // Start bootstrap
        debugLog(worldName, "Starting game bootstrap...");
        updateTask("manifest", "running");
        const result = await bootstrapGame();
        debugLog(worldName, "Bootstrap complete, got setupResult:", !!result);

        // After bootstrap patches the manifest with the selected world's
        // contract addresses, refresh the controller's session policies
        // if they changed. This recreates the keychain iframe with correct
        // policies and re-probes to restore the user's account.
        const connector = useAccountStore.getState().connector;
        if (connector) {
          const updated = await refreshSessionPolicies(connector);
          if (updated) {
            debugLog(worldName, "Session policies refreshed for new world");
          }
        }

        // Mark all tasks complete
        setTasks((prev) => prev.map((t) => ({ ...t, status: "complete" })));
        setSetupResult(result);
        setBootstrapStatus("ready");
        debugLog(worldName, "Bootstrap status set to ready");
      } catch (error) {
        debugLog(worldName, "Bootstrap failed:", error);
        setBootstrapError(error instanceof Error ? error : new Error("Bootstrap failed"));
        setBootstrapStatus("error");
        setTasks((prev) => prev.map((t) => (t.status === "running" ? { ...t, status: "error" } : t)));
      }
    };

    startBootstrap();
  }, [isOpen, isForgeMode, isBlitzMode, worldName, chain, updateTask]);

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
    setSeasonPlacement(DEFAULT_SEASON_PLACEMENT);
    setSelectedSeasonPassTokenId(null);
    setIsSubmittingSeasonSettlement(false);
    setSeasonSettlementError(null);
    setSeasonSettlementComplete(false);
    // Trigger re-bootstrap
    setTimeout(() => {
      setBootstrapStatus("loading");
    }, 100);
  }, []);

  const handleGetSeasonPass = useCallback(() => {
    window.open("https://empire.realms.world/trade", "_blank", "noopener,noreferrer");
  }, []);

  // Enter game handler - navigates to the game.
  // Does NOT prefetch structures from SQL — the GameLoadingOverlay will wait for
  // usePlayerStructureSync to populate RECS, then navigate to the player's realm.
  const handleEnterGame = useCallback(() => {
    // Ensure the loading overlay is visible (it may have been dismissed from a previous game)
    useUIStore.getState().setShowBlankOverlay(true);

    // Set initial state — structureEntityId=0 means "not yet known".
    // GameLoadingOverlay will update this once structures are synced into RECS.
    const setStructureEntityId = useUIStore.getState().setStructureEntityId;
    setStructureEntityId(0, {
      spectator: isSpectateMode,
      worldMapPosition: { col: 0, row: 0 },
    });

    // Navigate with placeholder coords (0,0). The loading overlay will
    // re-navigate to the player's realm once structures are available.
    const url = isSpectateMode ? `/play/map?col=0&row=0&spectate=true` : `/play/hex?col=0&row=0`;
    navigate(url);
    window.dispatchEvent(new Event("urlChanged"));
  }, [navigate, isSpectateMode]);

  const handleSeasonSettle = useCallback(async () => {
    if (!account?.address) return;
    if (!selectedSeasonPassTokenId) {
      setSeasonSettlementError("Select a season pass before settling.");
      return;
    }
    if (seasonPlacementErrors.length > 0) {
      setSeasonSettlementError(seasonPlacementErrors[0] ?? "Invalid settlement placement.");
      return;
    }
    if (!seasonTimingValid) {
      setSeasonSettlementError("Season timing invalid. Settlement is currently unavailable.");
      return;
    }
    if (!spiresSettled) {
      setSeasonSettlementError("All spires must be settled before creating new realms.");
      return;
    }
    if (!hasSeasonPass) {
      setSeasonSettlementError("Season pass not found in this wallet.");
      return;
    }

    const realmIdBigInt = selectedSeasonPassTokenId;
    if (realmIdBigInt < 0n || realmIdBigInt > 4_294_967_295n) {
      setSeasonSettlementError("Season pass realm id is out of bounds.");
      return;
    }

    setIsSubmittingSeasonSettlement(true);
    setSeasonSettlementError(null);

    try {
      const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
      if (!factorySqlBaseUrl) {
        throw new Error(`Factory SQL base URL not configured for chain: ${chain}`);
      }

      const contracts = await resolveWorldContracts(factorySqlBaseUrl, worldName);
      const selector = normalizeSelector(REALM_SYSTEMS_SELECTOR);
      const realmSystemsAddress = contracts[selector];
      if (!realmSystemsAddress) {
        throw new Error("realm_systems contract not found for selected world");
      }

      const signer = account as unknown as Account;
      const realmId = Number(realmIdBigInt);
      const owner = account.address;
      const frontend = account.address;

      const executeResult = await signer.execute({
        contractAddress: realmSystemsAddress,
        entrypoint: "create",
        calldata: CallData.compile([
          owner,
          realmId,
          frontend,
          seasonPlacement.side,
          seasonPlacement.layer,
          seasonPlacement.point,
        ]),
      });
      await waitForSubmittedTransaction(executeResult, "season realm create");

      setSeasonSettlementComplete(true);
      setSeasonSettlementError(null);
      setTimeout(() => {
        handleEnterGame();
      }, 500);
    } catch (error) {
      debugLog(worldName, "Season settlement failed:", error);
      setSeasonSettlementError(mapSeasonSettleError(error));
    } finally {
      setIsSubmittingSeasonSettlement(false);
    }
  }, [
    account,
    selectedSeasonPassTokenId,
    seasonPlacementErrors,
    seasonTimingValid,
    spiresSettled,
    hasSeasonPass,
    chain,
    worldName,
    seasonPlacement.side,
    seasonPlacement.layer,
    seasonPlacement.point,
    waitForSubmittedTransaction,
    handleEnterGame,
  ]);

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
      const { env } = await import("../../../../../env");

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
    if (phase === "ready") {
      debugLog(worldName, "Auto-entering game...");
      const timer = setTimeout(() => {
        handleEnterGame();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, handleEnterGame, worldName, isSpectateMode]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md mx-4 bg-brown/95 backdrop-blur-sm rounded-xl border border-gold/40 shadow-2xl"
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
        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            {(phase === "loading" || phase === "error") && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <BootstrapLoadingPanel tasks={tasks} progress={progress} error={bootstrapError} onRetry={handleRetry} />
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
            {phase === "season-pass-required" && (
              <motion.div
                key="season-pass-required"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SeasonPassRequiredPhase onGetSeasonPass={handleGetSeasonPass} />
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
                  hasSeasonPass={hasSeasonPass}
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
                  seasonPassInventoryError={seasonPassInventoryError}
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
                      <span>Enter Game</span>
                    </div>
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
