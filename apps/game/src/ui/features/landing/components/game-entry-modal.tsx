/**
 * GameEntryModal - Combined loading + settlement modal for seamless game entry
 *
 * This modal shows:
 * 1. Loading phase - Bootstrap progress (world config, Dojo setup, sync)
 * 2. Settlement phase - If user is registered but hasn't settled
 * 3. Auto-transitions to game when ready
 */

import { useQuery } from "@tanstack/react-query";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Castle, Check, ExternalLink, Eye, Loader2, Play, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { resolveEntryContextFromLandingSelection } from "@/game-entry/context";
import { buildBlitzSettleCalls, buildEternumSettleCalls } from "@/services/blitz/blitz-settlement-calls";
import { createAutoSettleEntryKey, useAutoSettleStore } from "@/hooks/store/use-auto-settle-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { identityUsername, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useUIStore } from "@/hooks/store/use-ui-store";

import { resolvePlayerNameFelt } from "@/services/identity/player-name";
import { useVillagePassInventory, type VillagePassInventoryItem } from "@/hooks/use-village-pass-inventory";
import { getWorldKey, useWorldsAvailability } from "@/hooks/use-world-availability";

import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { normalizeSelector } from "@/runtime/world/normalize";
import {
  createHeraldPreSessionReader,
  type PlayerStructure,
  type RealmVillageSlot,
  type SettlementSnapshot,
} from "@/runtime/world/herald-pre-session-reader";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getRpcUrlForChain } from "@/runtime/chain-rpc";
import { BootstrapLoadingPanel } from "@/ui/layouts/bootstrap-loading/bootstrap-loading-panel";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { getContractByName } from "@dojoengine/core";

import { Direction, DirectionName, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { getGameManifest, getSeasonAddresses } from "@contracts";
import type { GameChain as Chain } from "@realms-world/chain";
import { Account, Call, CallData } from "starknet";
import {
  isGameEntryPreflightComplete,
  resolveGameEntryBlockingError,
  resolveGameEntryModalPhase,
  type GameEntryModalPhase as ModalPhase,
} from "./game-entry-phase";
import { resolveBlitzSettlementAvailability } from "./game-entry-blitz-timing";

import { resolveGameEntryTarget } from "./game-entry-navigation";
import { isSelectedWorldEntityWaitAborted, waitForSelectedWorldEntityState } from "./selected-world-entity-wait";

import { env } from "../../../../../env";
import { namespaceForChain } from "@bibliothecadao/eternum/game-client";

const DEBUG_MODAL = false;
const SETTLEMENT_SYNC_TIMEOUT_MS = 90000;
const VILLAGE_REVEAL_SLOW_MS = 45_000;

const debugLog = (_worldName: string | null, ..._args: unknown[]) => {
  if (DEBUG_MODAL) {
    console.log("[GameEntryModal]", ..._args);
  }
};

type SettlementStatus = {
  settledCount: number;
  canPlay: boolean;
  needsSettlement: boolean;
};

type SettleStage = "idle" | "settling" | "syncing" | "done" | "error";

const getExpectedBlitzSettlementCount = (singleRealmMode: boolean): number => (singleRealmMode ? 1 : 3);

const deriveSettlementStatus = ({
  snapshot,
  expectedSettlementCount,
}: {
  snapshot: SettlementSnapshot;
  expectedSettlementCount: number;
}): SettlementStatus => {
  const settledCount = Math.max(0, snapshot.settledCount);
  const canPlay =
    snapshot.hasSettledStructure ||
    (snapshot.hasSettlementRecord && settledCount >= Math.max(1, expectedSettlementCount));

  return {
    settledCount,
    canPlay,
    needsSettlement: !canPlay,
  };
};

const formatUnlockCountdown = (secondsLeft: number): string => {
  const total = Math.max(0, Math.floor(secondsLeft));
  const hours = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
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

const resolveResourceLabel = (resourceId: number): string | null => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : null;
};

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

type ResolvedWorldSystemAddresses = {
  blitzRealmSystemsAddress: string | null;
  nameSystemsAddress: string | null;
  realmSystemsAddress: string | null;
  villageSystemsAddress: string | null;
};

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

// Types
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

interface GameEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldName: string;
  chain: Chain;
  isSpectateMode?: boolean;
  autoSettleEnabled?: boolean;
  /** Entry intent for route-owned landing entry */
  entryIntent?: "play" | "settle";
}

/**
 * Settlement phase - shows settlement wizard
 */
const SettlementPhase = ({
  stage,
  settledCount,
  expectedSettlementCount,
  isSettling,
  onSettle,
  onEnterGame,
  errorMessage,
}: {
  stage: SettleStage;
  settledCount: number;
  expectedSettlementCount: number;
  isSettling: boolean;
  onSettle: () => void;
  onEnterGame: () => void;
  errorMessage: string | null;
}) => {
  const realmLabel = expectedSettlementCount === 1 ? "realm" : "realms";
  const isSettlementSyncing = stage === "syncing";
  const isSettlementComplete = stage === "done" || settledCount >= expectedSettlementCount;
  const progress =
    expectedSettlementCount > 0 ? Math.min(100, (Math.max(0, settledCount) / expectedSettlementCount) * 100) : 0;
  const settlementSteps = [
    {
      id: "submit",
      label: "Submit Settlement",
      icon: Castle,
      description: `Create your starting ${realmLabel}.`,
      status: isSettlementComplete || isSettlementSyncing ? "complete" : isSettling ? "active" : "pending",
    },
    {
      id: "sync",
      label: "Prepare Your Realm",
      icon: Sparkles,
      description: "Your settlement is being confirmed.",
      status: isSettlementComplete ? "complete" : isSettlementSyncing ? "active" : "pending",
    },
  ] as const;

  return (
    <div className="flex flex-col">
      <div className="text-center mb-4">
        <img src="/images/logos/eternum-loader.png" className="mx-auto w-20 mb-3" alt="Settlement" />
        <h2 className="text-lg font-semibold text-gold">
          {isSettlementComplete
            ? "Settlement Complete!"
            : isSettlementSyncing
              ? "Finalizing Settlement"
              : "Settle Into The Game"}
        </h2>
        <p className="text-xs text-gold/60 mt-1">
          {isSettlementComplete
            ? `Your ${realmLabel} ${expectedSettlementCount === 1 ? "is" : "are"} ready.`
            : isSettlementSyncing
              ? "Your settlement was submitted. Waiting for confirmation."
              : `Settle to create your starting ${realmLabel} at a random location.`}
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
        {expectedSettlementCount > 0 && (
          <div className="flex justify-between text-xs text-gold/70">
            <span>
              {Math.min(settledCount, expectedSettlementCount)} / {expectedSettlementCount} {realmLabel} settled
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-4">
        {settlementSteps.map((step) => {
          const status = step.status;
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
      {isSettlementComplete ? (
        <Button onClick={onEnterGame} className="w-full h-11 !text-brown !bg-gold rounded-md" forceUppercase={false}>
          <div className="flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            <span>Enter Game</span>
          </div>
        </Button>
      ) : (
        <Button
          onClick={onSettle}
          disabled={isSettling || isSettlementSyncing}
          className="w-full h-11 !text-brown !bg-gold rounded-md"
          forceUppercase={false}
        >
          {isSettling || isSettlementSyncing ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isSettlementSyncing ? "Checking settlement..." : "Settling..."}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <TreasureChest className="w-4 h-4 fill-brown" />
              <span>Settle</span>
            </div>
          )}
        </Button>
      )}

      {stage === "error" && (
        <div className="mt-2 text-center">
          <p className="text-xs text-red-300">Settlement failed. Please try again.</p>
          {errorMessage && <p className="mt-1 text-[10px] text-red-300/70 break-words">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
};

const SettlementWaitingPhase = ({ secondsUntilUnlock }: { secondsUntilUnlock: number | null }) => {
  const countdownLabel =
    secondsUntilUnlock == null
      ? "Waiting for the registration window to open."
      : formatUnlockCountdown(secondsUntilUnlock);

  return (
    <div className="flex flex-col">
      <div className="text-center mb-4">
        <img src="/images/logos/eternum-loader.png" className="mx-auto w-20 mb-3" alt="Settlement pending" />
        <h2 className="text-lg font-semibold text-gold">Settlement Opens Soon</h2>
        <p className="text-xs text-gold/60 mt-1">Blitz settlement opens when the registration window begins.</p>
      </div>

      <div className="rounded-lg border border-gold/20 bg-black/25 px-4 py-5 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <AlertCircle className="h-5 w-5 text-gold" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-gold/60">Settlement Unlock</p>
        <p className="mt-2 font-mono text-2xl text-gold">{countdownLabel}</p>
        <p className="mt-2 text-xs text-white/60">
          This entry flow will switch to settlement automatically once registration opens.
        </p>
      </div>
    </div>
  );
};

const VillagePassRequiredPhase = ({
  onGetVillagePass,
  onSwitchToRealmMode,
  showRealmShortcut,
}: {
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
          Settle a Realm Instead
        </Button>
      )}
    </div>
  );
};

const VillagePlacementPhase = ({
  villagePassBalance,
  villagePasses,
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
        {spinning ? "Resolving on-chain assignment from Herald..." : `Your village produces ${displayedResourceLabel}.`}
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
 * Main GameEntryModal component
 */
export const GameEntryModal = ({
  isOpen,
  onClose,
  worldName,
  chain,
  isSpectateMode = false,
  autoSettleEnabled = false,
  entryIntent = "play",
}: GameEntryModalProps) => {
  const navigate = useNavigate();
  const account = useAccountStore((state) => state.account);
  // The chain name written at registration is the identity username, when one was chosen.
  const accountName = useIdentitySessionStore((state) => identityUsername(state.session));
  const usernameFelt = useMemo(
    () => (account?.address ? resolvePlayerNameFelt(account.address, accountName) : null),
    [account?.address, accountName],
  );
  const markOpening = useAutoSettleStore((state) => state.markOpening);
  const markSettling = useAutoSettleStore((state) => state.markSettling);
  const markCompleted = useAutoSettleStore((state) => state.markCompleted);
  const markFailed = useAutoSettleStore((state) => state.markFailed);
  const setAutoSettleEnabled = useAutoSettleStore((state) => state.setEnabled);
  const autoSettleAttemptedRef = useRef(false);
  const autoSettleEntryKey = useMemo(() => {
    if (!account?.address) return null;
    return createAutoSettleEntryKey({
      chain,
      worldName,
      walletAddress: account.address,
    });
  }, [account?.address, chain, worldName]);
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
  const resolvedEntryIntent = isSpectateMode ? "spectate" : entryIntent;
  const entryContext = useMemo(
    () =>
      resolveEntryContextFromLandingSelection({
        selection: {
          name: worldName,
          chain,
        },
        intent: resolvedEntryIntent,
        autoSettle: autoSettleEnabled,
      }),
    [autoSettleEnabled, chain, resolvedEntryIntent, worldName],
  );
  const [preflightError, setPreflightError] = useState<Error | null>(null);
  const [preflightRetryNonce, setPreflightRetryNonce] = useState(0);
  const [settlementCheckComplete, setSettlementCheckComplete] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  // Settlement state
  const [settleStage, setSettleStage] = useState<SettleStage>("idle");
  const [settleErrorMessage, setSettleErrorMessage] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settledRealmCount, setSettledRealmCount] = useState(0);
  const [needsSettlement, setNeedsSettlement] = useState(false);
  const [canPlay, setCanPlay] = useState(false);

  const [eternumSettlementMode, setEternumSettlementMode] = useState<EternumSettlementMode>("realm");
  const [selectedVillagePassTokenId, setSelectedVillagePassTokenId] = useState<bigint | null>(null);
  const [selectedVillageRealmEntityId, setSelectedVillageRealmEntityId] = useState<number | null>(null);
  const [selectedVillageDirection, setSelectedVillageDirection] = useState<Direction | null>(null);
  const [isSubmittingVillageSettlement, setIsSubmittingVillageSettlement] = useState(false);
  const [villageSettlementError, setVillageSettlementError] = useState<string | null>(null);
  const [villageRevealResult, setVillageRevealResult] = useState<VillageRevealResult | null>(null);

  const expectedSettlementCount = useMemo(
    () => (isEternumMode ? 1 : getExpectedBlitzSettlementCount(worldMeta?.singleRealmMode ?? false)),
    [isEternumMode, worldMeta?.singleRealmMode],
  );
  const hasEnteredGameRef = useRef(false);
  const entityWaitAbortControllerRef = useRef<AbortController | null>(null);

  const navigationEntryContext = entryContext;
  const selectedWorldRpcUrl = useMemo(() => getRpcUrlForChain(chain), [chain]);
  const selectedWorldReader = useMemo(
    () => createHeraldPreSessionReader(getWorldById(worldMeta?.worldId) ?? getDefaultWorld(), worldMeta?.gameId ?? 0),
    [worldMeta?.gameId, worldMeta?.worldId],
  );
  const seasonAddresses = getSeasonAddresses(chain);
  const villagePassAddress = worldMeta?.villagePassAddress || seasonAddresses.villagePass || null;
  const systemManifest = useMemo(() => getGameManifest(chain), [chain]);
  const resolvedSystemSelectors = useMemo(() => {
    const resolveSelector = (systemName: string): string | null => {
      try {
        const contract = getContractByName(systemManifest, namespaceForChain(chain), systemName) as {
          selector?: string;
        };
        return contract.selector ? normalizeSelector(contract.selector) : null;
      } catch {
        return null;
      }
    };

    return {
      blitzRealmSystemsSelector: resolveSelector("blitz_realm_systems"),
      nameSystemsSelector: resolveSelector("name_systems"),
      realmSystemsSelector: resolveSelector("realm_systems"),
      villageSystemsSelector: resolveSelector("village_systems"),
    };
  }, [systemManifest]);
  const resolvedWorldSystemAddresses = useMemo<ResolvedWorldSystemAddresses>(() => {
    const contracts = (getWorldById(worldMeta?.worldId) ?? getDefaultWorld()).contractsBySelector;
    const resolveAddress = (selector: string | null): string | null =>
      selector ? (contracts[selector] ?? null) : null;

    return {
      blitzRealmSystemsAddress: resolveAddress(resolvedSystemSelectors.blitzRealmSystemsSelector),
      nameSystemsAddress: resolveAddress(resolvedSystemSelectors.nameSystemsSelector),
      realmSystemsAddress: resolveAddress(resolvedSystemSelectors.realmSystemsSelector),
      villageSystemsAddress: resolveAddress(resolvedSystemSelectors.villageSystemsSelector),
    };
  }, [resolvedSystemSelectors, worldMeta?.worldId]);
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
  });
  const {
    data: ownedStructures = [],
    isLoading: isLoadingOwnedStructures,
    error: ownedStructuresErrorRaw,
    refetch: refetchOwnedStructures,
  } = useQuery({
    queryKey: ["eternumOwnedStructures", chain, worldName, worldMeta?.gameId, account?.address],
    enabled: isOpen && isEternumMode && Boolean(worldMeta?.gameId) && Boolean(account?.address),
    queryFn: async () => {
      if (!account?.address) return [];
      return await selectedWorldReader.fetchPlayerStructures(account.address);
    },
    staleTime: 10_000,
  });
  const {
    data: realmVillageSlots = [],
    error: villageSlotsErrorRaw,
    refetch: refetchRealmVillageSlots,
  } = useQuery({
    queryKey: ["eternumRealmVillageSlots", chain, worldName, worldMeta?.gameId],
    enabled: isOpen && isEternumMode && Boolean(worldMeta?.gameId),
    queryFn: async () => await selectedWorldReader.fetchRealmVillageSlots(),
    staleTime: 10_000,
  });
  const ownedStructuresError = ownedStructuresErrorRaw instanceof Error ? ownedStructuresErrorRaw.message : null;
  const villageSlotsError = villageSlotsErrorRaw instanceof Error ? villageSlotsErrorRaw.message : null;
  const villagePassInventoryWarning = useMemo(() => {
    if (!villagePassInventoryError) return null;
    const normalized = villagePassInventoryError.toLowerCase();
    if (normalized.includes("does not expose token enumeration")) {
      return null;
    }
    return villagePassInventoryError;
  }, [villagePassInventoryError]);
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
      setSelectedVillagePassTokenId(null);
      setSelectedVillageRealmEntityId(null);
      setSelectedVillageDirection(null);
      setIsSubmittingVillageSettlement(false);
      setVillageSettlementError(null);
      setVillageRevealResult(null);
    }
  }, [isOpen]);

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
  }, [isEternumMode, settleableVillageRealms]);

  useEffect(() => {
    if (!isEternumMode) {
      setSelectedVillageDirection(null);
      return;
    }

    setSelectedVillageDirection((current) => {
      if (current != null && selectedVillageAvailableDirections.has(current)) {
        return current;
      }
      const firstAvailableDirection = selectedVillageAvailableDirections.values().next().value as Direction | undefined;
      return firstAvailableDirection ?? null;
    });
  }, [isEternumMode, selectedVillageAvailableDirections]);

  useEffect(() => {
    setVillageSettlementError(null);
  }, [selectedVillagePassTokenId, selectedVillageRealmEntityId, selectedVillageDirection]);

  const resetBootstrapDependentState = useCallback(() => {
    setPreflightError(null);
    setNeedsSettlement(false);
    setCanPlay(false);
    setSettlementCheckComplete(false);
    setSettleStage("idle");
    setIsSettling(false);
    setSettledRealmCount(0);
    setEternumSettlementMode("realm");
    setSelectedVillagePassTokenId(null);
    setSelectedVillageRealmEntityId(null);
    setSelectedVillageDirection(null);
    setIsSubmittingVillageSettlement(false);
    setVillageSettlementError(null);
    setVillageRevealResult(null);
  }, []);

  const beginEntityWait = useCallback((): AbortSignal => {
    entityWaitAbortControllerRef.current?.abort();
    const controller = new AbortController();
    entityWaitAbortControllerRef.current = controller;
    return controller.signal;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      entityWaitAbortControllerRef.current?.abort();
      entityWaitAbortControllerRef.current = null;
      return;
    }

    return () => {
      entityWaitAbortControllerRef.current?.abort();
      entityWaitAbortControllerRef.current = null;
    };
  }, [chain, isOpen, worldName]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNowSec(Math.floor(Date.now() / 1000));
    const id = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [isOpen]);

  const blitzSettlementAvailability = resolveBlitzSettlementAvailability({
    registrationStartAt: worldMeta?.registrationStartAt ?? null,
    registrationEndAt: worldMeta?.registrationEndAt ?? null,
    devModeOn: worldMeta?.devModeOn ?? false,
    nowSec,
  });
  const nowSeconds = nowSec;
  const seasonStartAt = worldMeta?.startSettlingAt ?? worldMeta?.startMainAt ?? null;
  const seasonHasStarted = seasonStartAt != null && seasonStartAt <= nowSeconds;
  const seasonNotEnded = worldMeta?.endAt == null || worldMeta.endAt === 0 || nowSeconds <= worldMeta.endAt;
  const seasonTimingValid = seasonHasStarted && seasonNotEnded;
  const secondsUntilSeasonStart = seasonStartAt == null ? null : Math.max(0, seasonStartAt - nowSeconds);
  const hasVillagePass = villagePassBalance > 0n || villagePasses.length > 0;
  const isLoadingEternumPrereqs =
    isCheckingWorldAvailability || isLoadingVillagePassInventory || isLoadingOwnedStructures || !worldMeta;
  const entryPreflightComplete = isGameEntryPreflightComplete({
    isEternumMode,
    isSpectateMode,
    settlementCheckComplete,
  });
  const bootstrapStatus: "idle" | "pending-world" | "loading" | "ready" | "error" = preflightError
    ? "error"
    : isCheckingWorldAvailability || !entryPreflightComplete
      ? "loading"
      : "ready";
  const tasks = useMemo(
    () => [
      {
        id: "world",
        label: "Loading world metadata",
        status: worldMeta ? ("complete" as const) : ("running" as const),
      },
      {
        id: "preflight",
        label: isBlitzMode ? "Checking blitz settlement state" : "Checking world entry state",
        status: entryPreflightComplete ? ("complete" as const) : ("running" as const),
      },
    ],
    [entryPreflightComplete, isBlitzMode, worldMeta],
  );
  const progress = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "complete").length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  // Blitz entry preflight only needs settlement readiness. Hyperstructure initialization no longer blocks /enter.
  const checksComplete = settlementCheckComplete;
  const worldAvailabilityErrorMessage =
    worldAvailability?.error instanceof Error ? worldAvailability.error.message : null;
  const phaseError = useMemo(
    () =>
      preflightError ??
      resolveGameEntryBlockingError({
        worldAvailabilityErrorMessage,
        isCheckingWorldAvailability,
        isWorldAvailable: worldAvailability?.isAvailable ?? null,
        hasWorldMeta: worldMeta != null,
        worldMode,
      }),
    [
      preflightError,
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
      isBlitzMode,
      isSpectateMode,
      worldMode,
      isCheckingWorldAvailability,
      hasWorldMeta: worldMeta != null,
      isEternumMode,
      isLoadingEternumPrereqs,
      hasVillageRevealResult: villageRevealResult != null,
      eternumSettlementMode,
      hasVillagePass,
      checksComplete,
      needsSettlement,
      canPlay,
      isBlitzSettlementUnlocked: isEternumMode ? seasonTimingValid : blitzSettlementAvailability.isUnlocked,
    });

    return result;
  }, [
    bootstrapStatus,
    phaseError,
    isBlitzMode,
    isSpectateMode,
    checksComplete,
    settlementCheckComplete,
    needsSettlement,
    canPlay,
    blitzSettlementAvailability.isUnlocked,
    seasonTimingValid,
    isEternumMode,
    isLoadingEternumPrereqs,
    isCheckingWorldAvailability,
    hasVillagePass,
    worldMode,
    worldMeta,
    villagePasses,
    selectedVillagePassTokenId,
    selectedVillageRealmEntityId,
    selectedVillageDirection,
    villageDirectionSlots,
    villageRevealResult,
    eternumSettlementMode,
    entryIntent,
    worldName,
  ]);

  const readSettlementSnapshot = useCallback(async (): Promise<SettlementSnapshot | null> => {
    if (!account?.address || !worldMeta?.gameId) return null;
    return selectedWorldReader.fetchSettlementSnapshot(account.address);
  }, [account?.address, selectedWorldReader, worldMeta?.gameId]);

  const syncSettlementStateFromSnapshot = useCallback(
    (snapshot: SettlementSnapshot) => {
      const status = deriveSettlementStatus({
        snapshot,
        expectedSettlementCount: expectedSettlementCount,
      });
      setSettledRealmCount(status.settledCount);
      setNeedsSettlement(status.needsSettlement);
      setCanPlay(status.canPlay);
      return status;
    },
    [expectedSettlementCount],
  );

  const waitForSettlementTarget = useCallback(
    async (targetSettleCount: number): Promise<SettlementSnapshot> => {
      const observation = await waitForSelectedWorldEntityState({
        chain,
        description: "settlement indexing",
        gameId: worldMeta?.gameId ?? undefined,
        isTarget: ({ status }) =>
          status != null && (status.canPlay || status.settledCount >= Math.max(1, targetSettleCount)),
        modelNames: ["BlitzSettlement", "Structure"],
        onSlow: (elapsedMs) => {},
        read: async () => {
          const snapshot = await readSettlementSnapshot();
          return {
            snapshot,
            status: snapshot ? syncSettlementStateFromSnapshot(snapshot) : null,
          };
        },
        signal: beginEntityWait(),
        slowAfterMs: SETTLEMENT_SYNC_TIMEOUT_MS,
        worldId: worldMeta?.worldId,
        worldName,
      });

      if (!observation.snapshot) {
        throw new Error("Settlement subscription matched without an indexed settlement snapshot.");
      }
      return observation.snapshot;
    },
    [beginEntityWait, chain, readSettlementSnapshot, syncSettlementStateFromSnapshot, worldMeta, worldName],
  );

  const executeEntryObservedTransaction = useCallback(
    async ({
      signer,
      calls,
      operation,
      waitForConfirmation = true,
    }: {
      signer: Account;
      calls: Call | Call[];
      operation: string;
      waitForConfirmation?: boolean;
    }) => {
      return await executeObservedClientTransaction({
        account: signer,
        calls,
        surface: "settlement",
        operation,
        chain,
        worldName,
        waitForConfirmation,
      });
    },
    [chain, worldName],
  );

  const resolveWorldSystemAddress = useCallback(
    (systemName: string): string => {
      const contractAddress =
        systemName === "blitz_realm_systems"
          ? resolvedWorldSystemAddresses?.blitzRealmSystemsAddress
          : systemName === "name_systems"
            ? resolvedWorldSystemAddresses?.nameSystemsAddress
            : systemName === "realm_systems"
              ? resolvedWorldSystemAddresses?.realmSystemsAddress
              : systemName === "village_systems"
                ? resolvedWorldSystemAddresses?.villageSystemsAddress
                : null;

      if (!contractAddress) {
        throw new Error(`${systemName} contract not found for selected world`);
      }

      return contractAddress;
    },
    [resolvedWorldSystemAddresses],
  );

  const resolveOptionalPlayerNameForSettlement = useCallback(async (): Promise<string | null> => {
    if (!account?.address) return null;

    const addressName = await selectedWorldReader.fetchAddressName(account.address);
    if (hasAddressNameValue(addressName)) {
      return null;
    }

    if (!usernameFelt) {
      throw new Error("Unable to resolve player name for settlement.");
    }

    return usernameFelt;
  }, [account?.address, selectedWorldReader, usernameFelt]);

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
      optionalPlayerName,
    }: {
      signerAddress: string;
      villagePassTokenId: bigint;
      connectedRealmEntityId: number;
      direction: Direction;
      optionalPlayerName: string | null;
    }): Call[] => {
      const gameId = worldMeta?.gameId;
      if (!gameId) throw new Error("The selected game ID is required for settlement.");
      const villageSystemsAddress = resolveWorldSystemAddress("village_systems");
      const calls: Call[] = [];

      if (optionalPlayerName) {
        calls.push(buildSetAddressNameCall(optionalPlayerName));
      }

      const vrfProviderAddress = env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS;
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
        calldata: CallData.compile([gameId, villagePassTokenId, connectedRealmEntityId, direction]),
      });

      return calls;
    },
    [buildSetAddressNameCall, resolveWorldSystemAddress, worldMeta?.gameId],
  );

  const waitForVillageResourceReveal = useCallback(
    async ({
      ownerAddress,
      existingVillageIds,
    }: {
      ownerAddress: string;
      existingVillageIds: Set<number>;
    }): Promise<VillageRevealResult> => {
      const result = await waitForSelectedWorldEntityState<VillageRevealResult | null>({
        chain,
        description: "village resource indexing",
        gameId: worldMeta?.gameId ?? undefined,
        isTarget: (reveal) => reveal != null,
        modelNames: ["Structure"],
        onSlow: (elapsedMs) => {},
        read: async () => {
          const structures = await selectedWorldReader.fetchPlayerStructures(ownerAddress);
          const newVillage = structures
            .filter(
              (structure) =>
                structure.category === StructureType.Village && !existingVillageIds.has(structure.entity_id),
            )
            .toSorted((left, right) => right.entity_id - left.entity_id)[0];
          if (!newVillage) return null;

          const resourceId = resolvePrimaryVillageResource(newVillage.resources_packed);
          const resourceLabel = resourceId != null ? resolveResourceLabel(resourceId) : null;
          if (resourceId == null || !resourceLabel) return null;

          return {
            villageEntityId: newVillage.entity_id,
            resourceId,
            resourceLabel,
          };
        },
        signal: beginEntityWait(),
        slowAfterMs: VILLAGE_REVEAL_SLOW_MS,
        worldId: worldMeta?.worldId,
        worldName,
      });

      if (!result) {
        throw new Error("Village subscription matched without an indexed resource assignment.");
      }
      return result;
    },
    [beginEntityWait, chain, selectedWorldReader, worldMeta?.gameId, worldMeta?.worldId, worldName],
  );

  // Check settlement status after bootstrap completes
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!isBlitzMode && !isEternumMode) {
      debugLog(worldName, "Skipping settlement check - world mode unresolved");
      return;
    }

    if (isSpectateMode) {
      setNeedsSettlement(false);
      setCanPlay(true);
      setSettlementCheckComplete(true);
      return;
    }

    const checkSettlementStatus = async () => {
      try {
        if (!account?.address) {
          setNeedsSettlement(false);
          setCanPlay(false);
          setSettlementCheckComplete(true);
          return;
        }

        const snapshot = await readSettlementSnapshot();
        if (!snapshot) {
          setNeedsSettlement(false);
          setCanPlay(false);
          setSettlementCheckComplete(true);
          return;
        }
        syncSettlementStateFromSnapshot(snapshot);

        setSettlementCheckComplete(true);
      } catch (error) {
        setPreflightError(error instanceof Error ? error : new Error("Failed to check settlement status."));
        setNeedsSettlement(false);
        setCanPlay(false);
        setSettlementCheckComplete(true);
      }
    };

    void checkSettlementStatus();
  }, [
    account,
    isBlitzMode,
    isEternumMode,
    isOpen,
    isSpectateMode,
    worldName,
    preflightRetryNonce,
    readSettlementSnapshot,
    syncSettlementStateFromSnapshot,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    debugLog(worldName, "Resetting modal state for", worldName, "chain:", chain);
    resetBootstrapDependentState();
  }, [chain, isOpen, resetBootstrapDependentState, worldName]);

  // Retry handler
  const handleRetry = useCallback(() => {
    resetBootstrapDependentState();
    setPreflightError(null);
    setPreflightRetryNonce((current) => current + 1);
    if (isEternumMode) {
      void refetchOwnedStructures();
      void refetchRealmVillageSlots();
    }
  }, [isEternumMode, refetchOwnedStructures, refetchRealmVillageSlots, resetBootstrapDependentState]);

  const handleGetVillagePass = useCallback(() => {
    window.open("https://empire.realms.world/trade", "_blank", "noopener,noreferrer");
  }, []);

  // Enter game handler - navigates to the game.
  const handleEnterGame = useCallback(() => {
    if (!navigationEntryContext) {
      return;
    }

    markGameEntryMilestone("enter-game-started");

    const entryTarget = resolveGameEntryTarget({
      chain: navigationEntryContext.chain,
      worldName: navigationEntryContext.worldName,
      structureEntityId: useUIStore.getState().structureEntityId,
      worldMapReturnPosition: useUIStore.getState().worldMapReturnPosition,
      isSpectateMode: navigationEntryContext.intent === "spectate",
      mapCenterOffset: worldMeta?.mapCenterOffset ?? null,
    });

    navigate(entryTarget.url);
    window.dispatchEvent(new Event("urlChanged"));
  }, [navigate, navigationEntryContext, worldMeta?.mapCenterOffset]);

  const handleVillageSettle = useCallback(async () => {
    const activeVillageRealmEntityId = selectedVillageRealmEntityId;
    const activeVillageDirection = selectedVillageDirection;
    const activeVillageDirectionAvailable =
      activeVillageDirection != null && selectedVillageAvailableDirections.has(activeVillageDirection);

    if (!account?.address) {
      setVillageSettlementError("Connect your wallet first.");
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

    try {
      const signer = account as unknown as Account;
      const existingVillageIds = new Set(ownedVillageIdSet);
      const optionalPlayerName = await resolveOptionalPlayerNameForSettlement();
      const villageSettlementCalls = buildVillageSettlementCalls({
        signerAddress: account.address,
        villagePassTokenId: selectedVillagePassTokenId,
        connectedRealmEntityId: activeVillageRealmEntityId,
        direction: activeVillageDirection,
        optionalPlayerName,
      });

      await executeEntryObservedTransaction({
        signer,
        calls: villageSettlementCalls,
        operation: "village_systems.create",
      });

      const revealResult = await waitForVillageResourceReveal({
        ownerAddress: account.address,
        existingVillageIds,
      });

      setVillageRevealResult(revealResult);
      setVillageSettlementError(null);
      setEternumSettlementMode("village");

      refetchVillagePassInventory();
      void refetchOwnedStructures();
      void refetchRealmVillageSlots();
    } catch (error) {
      if (isSelectedWorldEntityWaitAborted(error)) return;
      debugLog(worldName, "Village settlement failed:", error);
      setVillageSettlementError(mapVillageSettleError(error));
    } finally {
      setIsSubmittingVillageSettlement(false);
    }
  }, [
    account,
    seasonTimingValid,
    villagePassAddress,
    selectedVillagePassTokenId,
    selectedVillageRealmEntityId,
    selectedVillageDirection,
    selectedVillageAvailableDirections,
    ownedVillageIdSet,
    resolveOptionalPlayerNameForSettlement,
    buildVillageSettlementCalls,
    executeEntryObservedTransaction,
    waitForVillageResourceReveal,
    refetchVillagePassInventory,
    refetchOwnedStructures,
    refetchRealmVillageSlots,
    worldName,
    chain,
  ]);

  const handleSettleAnotherVillage = useCallback(() => {
    setVillageRevealResult(null);
    setVillageSettlementError(null);
    setEternumSettlementMode("village");
    void refetchOwnedStructures();
    void refetchRealmVillageSlots();
    refetchVillagePassInventory();
  }, [refetchOwnedStructures, refetchRealmVillageSlots, refetchVillagePassInventory]);

  const finalizeSuccessfulSettlement = useCallback(() => {
    debugLog(worldName, "Settlement complete!");
    setSettleStage("done");
    setNeedsSettlement(false);
    if (autoSettleEnabled && autoSettleEntryKey) {
      markCompleted(autoSettleEntryKey);
    }

    setTimeout(() => {
      handleEnterGame();
    }, 1000);
  }, [autoSettleEnabled, autoSettleEntryKey, handleEnterGame, markCompleted, worldName]);

  const finalizeFailedBlitzSettlement = useCallback(
    (error: Error) => {
      console.error("[GameEntryModal] Settlement failed", { worldName, error });
      setSettleStage("error");
      setSettleErrorMessage(error.message);
      if (autoSettleEnabled && autoSettleEntryKey) {
        markFailed(autoSettleEntryKey, error.message);
      }
    },
    [autoSettleEnabled, autoSettleEntryKey, markFailed, worldName],
  );

  // Settlement handler - calls actual Dojo system calls
  const handleSettle = useCallback(async () => {
    if (!isBlitzMode && !isEternumMode) {
      debugLog(worldName, "Settlement requires a resolved game mode");
      return;
    }
    if (!account) return;

    setIsSettling(true);
    setSettleErrorMessage(null);
    if (autoSettleEnabled && autoSettleEntryKey) {
      markSettling(autoSettleEntryKey, Date.now());
    }

    try {
      if (!worldMeta) {
        throw new Error("World configuration is still loading. Please wait a moment and try again.");
      }
      const realmSystemName = isEternumMode ? "realm_systems" : "blitz_realm_systems";
      const realmSystemsAddress = resolveWorldSystemAddress(realmSystemName);
      const signer = account as unknown as Account;
      if (!usernameFelt) {
        throw new Error("Unable to resolve player name for settlement.");
      }

      const initialSnapshot = await readSettlementSnapshot();
      if (initialSnapshot) {
        const initialStatus = syncSettlementStateFromSnapshot(initialSnapshot);
        if (initialStatus.canPlay) {
          finalizeSuccessfulSettlement();
          return;
        }
      }

      // Settle targets the CHOSEN game explicitly — its id is the call's
      // first argument on the appchain worlds.
      if (!worldMeta.gameId) {
        throw new Error(`Game id for "${worldName}" is not resolved yet. Please retry in a moment.`);
      }

      setSettleStage("settling");
      await executeEntryObservedTransaction({
        signer,
        calls: isEternumMode
          ? buildEternumSettleCalls({
              realmSystemsAddress,
              signerAddress: signer.address,
              usernameFelt,
              gameId: worldMeta.gameId,
              vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
            })
          : buildBlitzSettleCalls({
              blitzSystemsAddress: realmSystemsAddress,
              signerAddress: signer.address,
              usernameFelt,
              gameId: worldMeta.gameId,
              vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
            }),
        operation: `${realmSystemName}.settle`,
      });

      setSettleStage("syncing");
      const finalSnapshot = await waitForSettlementTarget(expectedSettlementCount);

      const finalStatus = syncSettlementStateFromSnapshot(finalSnapshot);
      if (!finalStatus.canPlay) {
        throw new Error("Settlement is still syncing. Please try again if the world does not unlock shortly.");
      }

      finalizeSuccessfulSettlement();
    } catch (error) {
      if (isSelectedWorldEntityWaitAborted(error)) return;
      finalizeFailedBlitzSettlement(error instanceof Error ? error : new Error("Settlement failed"));
    } finally {
      setIsSettling(false);
    }
  }, [
    autoSettleEnabled,
    autoSettleEntryKey,
    account,
    expectedSettlementCount,
    executeEntryObservedTransaction,
    finalizeFailedBlitzSettlement,
    finalizeSuccessfulSettlement,
    isBlitzMode,
    isEternumMode,
    markSettling,
    syncSettlementStateFromSnapshot,
    usernameFelt,
    waitForSettlementTarget,
    worldMeta,
    worldName,
    readSettlementSnapshot,
    resolveWorldSystemAddress,
  ]);

  useEffect(() => {
    if (!isOpen || !autoSettleEnabled || !autoSettleEntryKey) return;

    autoSettleAttemptedRef.current = false;
    markOpening(autoSettleEntryKey, Date.now());
  }, [autoSettleEnabled, autoSettleEntryKey, isOpen, markOpening]);

  useEffect(() => {
    if (!autoSettleEnabled || phase !== "settlement" || isSettling || autoSettleAttemptedRef.current) {
      return;
    }

    autoSettleAttemptedRef.current = true;
    void handleSettle();
  }, [autoSettleEnabled, handleSettle, isSettling, phase]);
  // Auto-enter game when ready (spectate mode or already settled players)
  useEffect(() => {
    debugLog(worldName, "Auto-enter check - phase:", phase, "isSpectateMode:", isSpectateMode);
    const shouldAutoEnter = phase === "ready" && (!isEternumMode || entryIntent === "play");
    if (shouldAutoEnter) {
      debugLog(worldName, "Auto-entering game...");
      handleEnterGame();
    }
  }, [phase, handleEnterGame, worldName, isSpectateMode, isEternumMode, entryIntent]);

  debugLog(worldName, "Render - isOpen:", isOpen, "phase:", phase, "bootstrapStatus:", bootstrapStatus);

  if (!isOpen) return null;

  const handleClose = () => {
    debugLog(worldName, "Close button clicked");
    if (autoSettleEnabled && autoSettleEntryKey) {
      setAutoSettleEnabled(autoSettleEntryKey, false);
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      debugLog(worldName, "Backdrop clicked");
      handleClose();
    }
  };

  const showEternumSettlementModeToggle =
    isEternumMode && ["settlement", "village-pass-required", "village-placement", "ready"].includes(phase);
  const usesDesktopCenteredSettlementLayout =
    isEternumMode && ["village-pass-required", "village-placement", "village-reveal", "ready"].includes(phase);

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
          phase === "village-placement"
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
            {isSpectateMode ? <Eye className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isSpectateMode ? "Spectating" : "Entering"}</span>
          </div>
          <h3 className="text-lg font-bold text-gold truncate">{worldName}</h3>
        </div>

        {/* Content */}
        <div
          className={cn(
            "px-6 pb-6",
            phase === "village-placement" &&
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
                  Realm
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
            {phase === "settlement-waiting" && (
              <motion.div
                key="settlement-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SettlementWaitingPhase
                  secondsUntilUnlock={
                    isEternumMode ? secondsUntilSeasonStart : blitzSettlementAvailability.secondsUntilUnlock
                  }
                />
              </motion.div>
            )}
            {phase === "settlement" && (
              <motion.div key="settlement" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SettlementPhase
                  stage={settleStage}
                  settledCount={settledRealmCount}
                  expectedSettlementCount={expectedSettlementCount}
                  isSettling={isSettling}
                  onSettle={handleSettle}
                  onEnterGame={handleEnterGame}
                  errorMessage={settleErrorMessage}
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
