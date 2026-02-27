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
import { X, Play, Eye, Loader2, Check, Castle, MapPin, Pickaxe, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import type { BootstrapTask } from "@/hooks/context/use-eager-bootstrap";
import type { SetupResult } from "@/init/bootstrap";
import { bootstrapGame } from "@/init/bootstrap";
import { applyWorldSelection } from "@/runtime/world";
import { getFactorySqlBaseUrl } from "@/runtime/world/factory-endpoints";
import { resolveWorldContracts } from "@/runtime/world/factory-resolver";
import { normalizeSelector } from "@/runtime/world/normalize";
import { buildForgePolicies } from "@/hooks/context/policies";
import { refreshSessionPolicies, refreshSessionPoliciesWithPolicies } from "@/hooks/context/session-policy-refresh";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getWorldKey } from "@/hooks/use-world-availability";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import Button from "@/ui/design-system/atoms/button";
import { BootstrapLoadingPanel } from "@/ui/layouts/bootstrap-loading/bootstrap-loading-panel";
import type { Chain } from "@contracts";
import type { Account } from "starknet";

const DEBUG_MODAL = false;
const BLITZ_REALM_SYSTEMS_SELECTOR = "0x3414be5ba2c90784f15eb572e9222b5c83a6865ec0e475a57d7dc18af9b3742";

const debugLog = (_worldName: string | null, ..._args: unknown[]) => {
  if (DEBUG_MODAL) {
    console.log("[GameEntryModal]", ..._args);
  }
};

const FORGE_ALL_MAX_RETRIES = 3;
const FORGE_ALL_RETRY_BASE_DELAY_MS = 800;
const FORGE_ALL_STEP_DELAY_MS = 250;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error ?? "");
};

const isRetryableForgeQueueError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("pending") ||
    message.includes("already processing") ||
    message.includes("already pending") ||
    message.includes("not ready") ||
    message.includes("nonce") ||
    message.includes("busy") ||
    message.includes("rate limit") ||
    message.includes("429")
  );
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

// Types
type BootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";
type SettleStage = "idle" | "assigning" | "settling" | "done" | "error";
type ModalPhase = "loading" | "forge" | "hyperstructure" | "settlement" | "ready" | "error";

// Hyperstructure info type
type HyperstructureInfo = {
  entityId: number;
  initialized: boolean;
  name: string;
};

type ForgeCallTargets = {
  blitzRealmSystemsAddress: string;
  vrfProviderAddress?: string;
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
  isPreparingSession,
  isForgeAllRunning,
  forgeAllCompletedCount,
  forgeAllTargetCount,
  forgeAllEstimatedRemainingMs,
  forgeAllElapsedMs,
  onForge,
  onForgeAll,
  onClose,
}: {
  numHyperstructuresLeft: number;
  isForging: boolean;
  isPreparingSession: boolean;
  isForgeAllRunning: boolean;
  forgeAllCompletedCount: number;
  forgeAllTargetCount: number;
  forgeAllEstimatedRemainingMs: number | null;
  forgeAllElapsedMs: number | null;
  onForge: () => void;
  onForgeAll: () => void;
  onClose: () => void;
}) => {
  const allForged = numHyperstructuresLeft <= 0;
  const isBusy = isForging || isPreparingSession;
  const hasForgeAllProgress = forgeAllTargetCount > 0;
  const forgeAllProgressPercent =
    forgeAllTargetCount > 0 ? Math.min(100, (forgeAllCompletedCount / forgeAllTargetCount) * 100) : 0;

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

      {hasForgeAllProgress && (
        <div className="w-full rounded-lg border border-gold/20 bg-black/25 p-3 mb-4">
          <div className="flex items-center justify-between text-xs text-gold/70 mb-2">
            <span>Forge Queue</span>
            <span>
              {forgeAllCompletedCount} / {forgeAllTargetCount}
            </span>
          </div>
          <div className="h-2 bg-brown/50 rounded-full overflow-hidden mb-2">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500/80 to-gold rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${forgeAllProgressPercent}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-gold/55">
            <span>
              {isForgeAllRunning
                ? "Queue active - sign each wallet prompt to continue"
                : forgeAllCompletedCount >= forgeAllTargetCount
                  ? "Forge All complete"
                  : "Queue paused"}
            </span>
            <span>{Math.round(forgeAllProgressPercent)}%</span>
          </div>
          {(isForgeAllRunning || forgeAllCompletedCount > 0) && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-gold/50">
              <span>
                {forgeAllElapsedMs !== null ? `Elapsed: ${formatDuration(forgeAllElapsedMs)}` : "Elapsed: --"}
              </span>
              <span>
                {forgeAllEstimatedRemainingMs !== null
                  ? `ETA: ${formatDuration(forgeAllEstimatedRemainingMs)}`
                  : "ETA: estimating..."}
              </span>
            </div>
          )}
        </div>
      )}

      {!allForged && (
        <>
          {/* Forge button - golden orb style similar to HyperstructureForge */}
          <motion.button
            onClick={onForge}
            disabled={isBusy}
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
              {isBusy ? (
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
            {!isBusy && (
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

          <Button
            onClick={onForgeAll}
            disabled={isBusy || isForgeAllRunning || numHyperstructuresLeft <= 0}
            className="w-full h-10 !text-brown !bg-gold rounded-md mb-2"
            forceUppercase={false}
          >
            {isForgeAllRunning ? "Forge All in Progress..." : `Forge All (${numHyperstructuresLeft})`}
          </Button>

          <p className="text-xs text-gold/50 text-center mb-4">
            {isPreparingSession
              ? "Preparing forge session..."
              : isForgeAllRunning
                ? "Auto-submitting the next forge after each signed transaction."
                : `Click to forge ${numHyperstructuresLeft} hyperstructure${numHyperstructuresLeft !== 1 ? "s" : ""}`}
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
  const [isPreparingForgeSession, setIsPreparingForgeSession] = useState(false);
  const [isForgeAllRunning, setIsForgeAllRunning] = useState(false);
  const [forgeAllTargetCount, setForgeAllTargetCount] = useState(0);
  const [forgeAllCompletedCount, setForgeAllCompletedCount] = useState(0);
  const [forgeAllStartedAt, setForgeAllStartedAt] = useState<number | null>(null);
  const [forgeAllNow, setForgeAllNow] = useState<number>(Date.now());
  const forgeCallTargetsRef = useRef<ForgeCallTargets | null>(null);
  const forgeAllCancelledRef = useRef(false);
  const hasEnteredGameRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasEnteredGameRef.current = false;
      forgeAllCancelledRef.current = true;
      forgeCallTargetsRef.current = null;
      setIsForgeAllRunning(false);
      setForgeAllTargetCount(0);
      setForgeAllCompletedCount(0);
      setForgeAllStartedAt(null);
      setIsPreparingForgeSession(false);
      setIsForging(false);
    } else {
      forgeAllCancelledRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    forgeAllCancelledRef.current = true;
    forgeCallTargetsRef.current = null;
    setIsForgeAllRunning(false);
    setForgeAllTargetCount(0);
    setForgeAllCompletedCount(0);
    setForgeAllStartedAt(null);
  }, [worldName, chain]);

  useEffect(() => {
    if (!isForgeAllRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setForgeAllNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isForgeAllRunning]);

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

  // Both checks must complete before we can determine the final phase
  const checksComplete = settlementCheckComplete && hyperstructureCheckComplete;

  // Determine current phase
  const phase: ModalPhase = useMemo(() => {
    let result: ModalPhase;
    if (isForgeMode) {
      // Forge mode does not require game bootstrap or settlement checks
      result = "forge";
    } else if (bootstrapError || bootstrapStatus === "error") {
      result = "error";
    } else if (bootstrapStatus !== "ready") {
      result = "loading";
    } else if (isSpectateMode) {
      result = "ready";
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
      isSpectateMode,
      checksComplete,
      settlementCheckComplete,
      hyperstructureCheckComplete,
      needsHyperstructureInit,
      needsSettlement,
    });

    return result;
  }, [
    bootstrapStatus,
    bootstrapError,
    isForgeMode,
    isSpectateMode,
    checksComplete,
    settlementCheckComplete,
    hyperstructureCheckComplete,
    needsHyperstructureInit,
    needsSettlement,
    worldName,
  ]);

  const forgeAllElapsedMs = useMemo(() => {
    if (!forgeAllStartedAt) {
      return null;
    }

    const now = isForgeAllRunning ? forgeAllNow : Date.now();
    return Math.max(0, now - forgeAllStartedAt);
  }, [forgeAllStartedAt, isForgeAllRunning, forgeAllNow]);

  const forgeAllEstimatedRemainingMs = useMemo(() => {
    if (!forgeAllElapsedMs || forgeAllCompletedCount <= 0 || forgeAllTargetCount <= forgeAllCompletedCount) {
      return null;
    }

    const averagePerHyperstructure = forgeAllElapsedMs / forgeAllCompletedCount;
    return Math.max(0, averagePerHyperstructure * (forgeAllTargetCount - forgeAllCompletedCount));
  }, [forgeAllElapsedMs, forgeAllCompletedCount, forgeAllTargetCount]);

  const blitzActionPolicyScope = useMemo(() => `blitz-actions:${chain}:${worldName}`, [chain, worldName]);

  const resolveForgeCallTargets = useCallback(async (): Promise<ForgeCallTargets> => {
    if (forgeCallTargetsRef.current) {
      return forgeCallTargetsRef.current;
    }

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

    const { env } = await import("../../../../../env");
    const vrfProviderAddress = env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS;
    const hasVrfProvider = Boolean(vrfProviderAddress) && !/^0x0*$/i.test(vrfProviderAddress);

    forgeCallTargetsRef.current = {
      blitzRealmSystemsAddress,
      vrfProviderAddress: hasVrfProvider ? vrfProviderAddress : undefined,
    };

    return forgeCallTargetsRef.current;
  }, [chain, worldName]);

  const ensureForgeSessionPolicies = useCallback(async (): Promise<boolean> => {
    const connector = useAccountStore.getState().connector;
    if (!connector) {
      return false;
    }

    const forgeTargets = await resolveForgeCallTargets();
    const forgePolicies = buildForgePolicies(forgeTargets);

    return refreshSessionPoliciesWithPolicies(connector, forgePolicies, blitzActionPolicyScope);
  }, [resolveForgeCallTargets, blitzActionPolicyScope]);

  // In forge mode, update session once on modal open for the selected world.
  useEffect(() => {
    if (!isOpen || !isForgeMode || !account) {
      return;
    }

    let cancelled = false;

    const prepareForgeSession = async () => {
      setIsPreparingForgeSession(true);
      try {
        const updated = await ensureForgeSessionPolicies();
        if (updated) {
          debugLog(worldName, "Forge session policies updated");
        }
      } catch (error) {
        debugLog(worldName, "Failed to prepare forge session policies:", error);
      } finally {
        if (!cancelled) {
          setIsPreparingForgeSession(false);
        }
      }
    };

    void prepareForgeSession();

    return () => {
      cancelled = true;
    };
  }, [isOpen, isForgeMode, account, ensureForgeSessionPolicies, worldName]);

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

    if (isSpectateMode || isForgeMode) {
      debugLog(worldName, "Skipping settlement check - spectate or forge mode");
      setSettlementCheckComplete(true);
      return;
    }

    // Query player's settlement status from Dojo components
    const checkSettlementStatus = async () => {
      debugLog(worldName, "Running settlement status check...");
      try {
        const { components } = setupResult;
        const playerAddress = account?.address;
        debugLog(worldName, "Player address:", playerAddress);

        if (!playerAddress) {
          debugLog(worldName, "No player address, skipping settlement check");
          setNeedsSettlement(false);
          setSettlementCheckComplete(true);
          return;
        }

        // Import Dojo utilities
        const { getEntityIdFromKeys } = await import("@bibliothecadao/eternum");
        const { getComponentValue, HasValue, runQuery } = await import("@dojoengine/recs");

        const entityId = getEntityIdFromKeys([BigInt(playerAddress)]);
        debugLog(worldName, "Entity ID:", entityId);

        // Check if player is registered
        const playerRegister = getComponentValue(components.BlitzRealmPlayerRegister, entityId);
        debugLog(worldName, "playerRegister:", playerRegister);
        const isRegistered = playerRegister?.registered === true;

        // Check if player has any structures (meaning they've settled)
        const playerStructures = runQuery([HasValue(components.Structure, { owner: BigInt(playerAddress) })]);
        debugLog(worldName, "playerStructures count:", playerStructures.size);
        const hasSettled = playerStructures.size > 0;

        // Check settlement finish status
        const settleFinish = getComponentValue(components.BlitzRealmSettleFinish, entityId) as SettleFinishValue | null;
        debugLog(worldName, "settleFinish:", settleFinish);
        const coordsCount = settleFinish?.coords?.length ?? 0;
        const settledCount = settleFinish?.structure_ids?.length ?? 0;

        setAssignedRealmCount(coordsCount + settledCount);
        setSettledRealmCount(settledCount);

        // Player needs settlement if registered but not fully settled
        const canPlay = hasSettled && coordsCount + settledCount > 0 && settledCount === coordsCount + settledCount;
        const needsSettlementResult = isRegistered && !canPlay;

        debugLog(worldName, "Settlement check result:", {
          isRegistered,
          hasSettled,
          coordsCount,
          settledCount,
          canPlay,
          needsSettlement: needsSettlementResult,
        });

        setNeedsSettlement(needsSettlementResult);
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
  }, [bootstrapStatus, setupResult, account, isSpectateMode, isForgeMode, worldName]);

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

    if (isSpectateMode || isForgeMode) {
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
  }, [bootstrapStatus, setupResult, isSpectateMode, isForgeMode, worldName]);

  // Start bootstrap when modal opens
  useEffect(() => {
    if (!isOpen) {
      debugLog(worldName, "Modal not open, skipping bootstrap");
      return;
    }
    if (isForgeMode) {
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
        // contract addresses, refresh session policies only for interactive
        // flows. Spectate should never trigger signing prompts.
        const connector = useAccountStore.getState().connector;
        if (connector && !isSpectateMode) {
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
  }, [isOpen, isForgeMode, isSpectateMode, worldName, chain, updateTask]);

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
    // Trigger re-bootstrap
    setTimeout(() => {
      setBootstrapStatus("loading");
    }, 100);
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

  // Settlement handler - calls actual Dojo system calls
  const handleSettle = useCallback(async () => {
    debugLog(worldName, "handleSettle called - hasSetupResult:", !!setupResult, "hasAccount:", !!account);
    if (!setupResult || !account) return;

    setIsSettling(true);
    setSettleStage("assigning");

    try {
      const { systemCalls } = setupResult;
      const { configManager } = await import("@bibliothecadao/eternum");
      const { env } = await import("../../../../../env");

      const isMainnet = env.VITE_PUBLIC_CHAIN === "mainnet";
      const blitzConfig = configManager.getBlitzConfig?.();
      const singleRealmMode = blitzConfig?.blitz_settlement_config?.single_realm_mode ?? false;

      debugLog(worldName, "Settlement config:", { isMainnet, singleRealmMode, blitzConfig });

      // Settlement configuration
      const SETTLEMENT_CONFIG = {
        MAINNET: {
          MULTI_REALM: { INITIAL_SETTLE_COUNT: 1, EXTRA_CALLS: 2 },
          SINGLE_REALM: { INITIAL_SETTLE_COUNT: 1, EXTRA_CALLS: 0 },
        },
        NON_MAINNET: {
          MULTI_REALM: { INITIAL_SETTLE_COUNT: 3 },
          SINGLE_REALM: { INITIAL_SETTLE_COUNT: 1 },
        },
      };

      if (isMainnet) {
        const config = singleRealmMode ? SETTLEMENT_CONFIG.MAINNET.SINGLE_REALM : SETTLEMENT_CONFIG.MAINNET.MULTI_REALM;

        debugLog(worldName, "Starting settlement (mainnet):", config);
        await systemCalls.blitz_realm_assign_and_settle_realms({
          signer: account,
          settlement_count: config.INITIAL_SETTLE_COUNT,
        });

        if (config.EXTRA_CALLS > 0) {
          setSettleStage("settling");
          for (let i = 0; i < config.EXTRA_CALLS; i++) {
            debugLog(worldName, `Extra settle call ${i + 1}/${config.EXTRA_CALLS}`);
            await systemCalls.blitz_realm_settle_realms({ signer: account, settlement_count: 1 });
          }
        }
      } else {
        const config = singleRealmMode
          ? SETTLEMENT_CONFIG.NON_MAINNET.SINGLE_REALM
          : SETTLEMENT_CONFIG.NON_MAINNET.MULTI_REALM;

        debugLog(worldName, "Starting settlement (non-mainnet):", config);
        await systemCalls.blitz_realm_assign_and_settle_realms({
          signer: account,
          settlement_count: config.INITIAL_SETTLE_COUNT,
        });
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
  }, [setupResult, account, handleEnterGame, worldName]);

  const executeForgeBatch = useCallback(
    async (remainingHyperstructures: number): Promise<number> => {
      if (!account) {
        throw new Error("No account connected");
      }

      // Ensure the selected world's forge policy is present before execute.
      await ensureForgeSessionPolicies();
      const { blitzRealmSystemsAddress, vrfProviderAddress } = await resolveForgeCallTargets();

      const batchSize = chain === "mainnet" ? 1 : 4;
      const hyperstructureCount =
        remainingHyperstructures > 0 ? Math.min(remainingHyperstructures, batchSize) : batchSize;
      const signer = account as unknown as Account;

      const calls = [];
      if (vrfProviderAddress) {
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

      // Invalidate the world availability cache so the count updates on the landing page
      const worldKey = getWorldKey({ name: worldName, chain });
      queryClient.invalidateQueries({ queryKey: ["worldAvailability", worldKey] });

      return hyperstructureCount;
    },
    [account, ensureForgeSessionPolicies, resolveForgeCallTargets, worldName, chain, queryClient],
  );

  // Single forge batch (manual click)
  const handleForgeHyperstructures = useCallback(async () => {
    debugLog(worldName, "handleForgeHyperstructures called - hasAccount:", !!account);
    if (!account || numHyperstructuresLeft <= 0 || isForgeAllRunning) return;

    setIsForging(true);

    try {
      const forged = await executeForgeBatch(numHyperstructuresLeft);
      setNumHyperstructuresLeft((prev) => Math.max(0, prev - forged));
      debugLog(worldName, "Hyperstructures forged!");
    } catch (error) {
      debugLog(worldName, "Forge hyperstructures failed:", error);
    } finally {
      setIsForging(false);
    }
  }, [account, numHyperstructuresLeft, isForgeAllRunning, executeForgeBatch, worldName]);

  // Forge all remaining hyperstructures sequentially (one tx prompt after another)
  const handleForgeAllHyperstructures = useCallback(async () => {
    debugLog(worldName, "handleForgeAllHyperstructures called - hasAccount:", !!account);
    if (!account || numHyperstructuresLeft <= 0 || isForgeAllRunning) return;

    forgeAllCancelledRef.current = false;

    const totalToForge = numHyperstructuresLeft;
    let remaining = totalToForge;

    setIsForging(true);
    setIsForgeAllRunning(true);
    setForgeAllTargetCount(totalToForge);
    setForgeAllCompletedCount(0);
    setForgeAllStartedAt(Date.now());
    setForgeAllNow(Date.now());

    try {
      while (remaining > 0 && !forgeAllCancelledRef.current) {
        let forgedInBatch = 0;
        let attempt = 0;

        while (attempt < FORGE_ALL_MAX_RETRIES && !forgeAllCancelledRef.current) {
          try {
            forgedInBatch = await executeForgeBatch(remaining);
            break;
          } catch (error) {
            attempt += 1;
            const shouldRetry = attempt < FORGE_ALL_MAX_RETRIES && isRetryableForgeQueueError(error);

            debugLog(worldName, "Forge-all batch failed", {
              attempt,
              maxAttempts: FORGE_ALL_MAX_RETRIES,
              retryable: shouldRetry,
              error: getErrorMessage(error),
            });

            if (!shouldRetry) {
              throw error;
            }

            await wait(FORGE_ALL_RETRY_BASE_DELAY_MS * attempt);
          }
        }

        if (forgeAllCancelledRef.current) {
          break;
        }

        if (forgedInBatch <= 0) {
          throw new Error("Forge queue could not submit the next batch");
        }

        remaining = Math.max(0, remaining - forgedInBatch);

        const completed = totalToForge - remaining;
        setForgeAllCompletedCount(completed);
        setNumHyperstructuresLeft(remaining);

        debugLog(worldName, "Forge-all progress:", completed, "/", totalToForge);

        if (remaining > 0) {
          // Give wallet/provider a short cooldown between sequential submissions.
          await wait(FORGE_ALL_STEP_DELAY_MS);
        }
      }
    } catch (error) {
      debugLog(worldName, "Forge all hyperstructures failed:", error);
    } finally {
      setIsForgeAllRunning(false);
      setIsForging(false);
    }
  }, [account, numHyperstructuresLeft, isForgeAllRunning, executeForgeBatch, worldName]);

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
                  isPreparingSession={isPreparingForgeSession}
                  isForgeAllRunning={isForgeAllRunning}
                  forgeAllCompletedCount={forgeAllCompletedCount}
                  forgeAllTargetCount={forgeAllTargetCount}
                  forgeAllEstimatedRemainingMs={forgeAllEstimatedRemainingMs}
                  forgeAllElapsedMs={forgeAllElapsedMs}
                  onForge={handleForgeHyperstructures}
                  onForgeAll={handleForgeAllHyperstructures}
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
