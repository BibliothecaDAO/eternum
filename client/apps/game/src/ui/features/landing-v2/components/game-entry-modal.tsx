/**
 * GameEntryModal - Combined loading + settlement modal for seamless game entry
 *
 * This modal shows:
 * 1. Loading phase - Bootstrap progress (world config, Dojo setup, sync)
 * 2. Settlement phase - If user is registered but hasn't settled
 * 3. Auto-transitions to game when ready
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Eye, Loader2, Check, AlertCircle, RefreshCw, Castle, MapPin, Pickaxe } from "lucide-react";

import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import type { SetupResult } from "@/init/bootstrap";
import { bootstrapGame } from "@/init/bootstrap";
import { applyWorldSelection } from "@/runtime/world";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import Button from "@/ui/design-system/atoms/button";
import type { Chain } from "@contracts";

const DEBUG_MODAL = true;
const debugLog = (...args: unknown[]) => {
  if (DEBUG_MODAL) console.log("[GameEntryModal]", ...args);
};

// Types
type BootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";
type BootstrapTask = { id: string; label: string; status: "pending" | "running" | "complete" | "error" };
type SettleStage = "idle" | "assigning" | "settling" | "done" | "error";
type ModalPhase = "loading" | "settlement" | "ready" | "error";

interface GameEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldName: string;
  chain: Chain;
  isSpectateMode?: boolean;
}

const LOADING_STATEMENTS = [
  "Gathering your armies...",
  "Forging alliances...",
  "Building strongholds...",
  "Mustering forces...",
  "Preparing the realm...",
  "Awakening ancient powers...",
  "Charting territories...",
  "Summoning heroes...",
] as const;

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
 * Loading panel showing bootstrap progress
 */
const LoadingPhase = ({
  tasks,
  progress,
  error,
  onRetry,
}: {
  tasks: BootstrapTask[];
  progress: number;
  error: Error | null;
  onRetry: () => void;
}) => {
  const [statementIndex, setStatementIndex] = useState(() => Math.floor(Math.random() * LOADING_STATEMENTS.length));

  useEffect(() => {
    if (error) return;
    const interval = setInterval(() => {
      setStatementIndex((prev) => (prev + 1) % LOADING_STATEMENTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [error]);

  const displayProgress = progress === 100 ? 99 : progress;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8">
        <AlertCircle className="w-12 h-12 text-danger/60 mb-4" />
        <h2 className="text-xl font-bold text-gold mb-2">Unable to Start</h2>
        <p className="text-sm text-white/70 max-w-md mb-2">Something went wrong while preparing the world.</p>
        {error.message && (
          <p className="text-xs text-white/50 max-w-md mb-4 font-mono bg-black/20 px-3 py-2 rounded">{error.message}</p>
        )}
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="text-center mb-6">
        <img src="/images/logos/eternum-loader.png" className="mx-auto w-24 mb-4" alt="Loading" />
        <h2 className="text-lg font-semibold text-gold">{LOADING_STATEMENTS[statementIndex]}</h2>
      </div>

      {/* Task list */}
      <div className="space-y-2 mb-6">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300",
              task.status === "running"
                ? "bg-gold/10 border border-gold/30"
                : task.status === "complete"
                  ? "bg-brilliance/5 border border-brilliance/20"
                  : task.status === "error"
                    ? "bg-danger/10 border border-danger/30"
                    : "bg-white/5 border border-white/10",
            )}
          >
            {task.status === "running" ? (
              <Loader2 className="w-4 h-4 text-gold animate-spin flex-shrink-0" />
            ) : task.status === "complete" ? (
              <Check className="w-4 h-4 text-brilliance flex-shrink-0" />
            ) : task.status === "error" ? (
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/30 flex-shrink-0" />
            )}
            <span
              className={cn(
                "text-sm",
                task.status === "running"
                  ? "text-gold"
                  : task.status === "complete"
                    ? "text-brilliance/80"
                    : task.status === "error"
                      ? "text-danger"
                      : "text-white/40",
              )}
            >
              {task.label}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-gold/60 mb-2">
          <span>Loading...</span>
          <span>{displayProgress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gold/10">
          <div
            className="h-2 rounded-full bg-gold transition-all duration-300"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

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
 * Main GameEntryModal component
 */
export const GameEntryModal = ({ isOpen, onClose, worldName, chain, isSpectateMode = false }: GameEntryModalProps) => {
  const navigate = useNavigate();
  const syncProgress = useSyncStore((state) => state.initialSyncProgress);
  const account = useAccountStore((state) => state.account);
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

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

  // Determine current phase
  const phase: ModalPhase = useMemo(() => {
    let result: ModalPhase;
    if (bootstrapError || bootstrapStatus === "error") {
      result = "error";
    } else if (bootstrapStatus !== "ready") {
      result = "loading";
    } else if (isSpectateMode) {
      result = "ready";
    } else if (needsSettlement) {
      result = "settlement";
    } else {
      result = "ready";
    }

    debugLog("Phase determined:", result, {
      bootstrapStatus,
      hasError: !!bootstrapError,
      isSpectateMode,
      needsSettlement,
    });

    return result;
  }, [bootstrapStatus, bootstrapError, isSpectateMode, needsSettlement]);

  // Check settlement status after bootstrap completes
  useEffect(() => {
    debugLog(
      "Settlement check effect - bootstrapStatus:",
      bootstrapStatus,
      "hasSetupResult:",
      !!setupResult,
      "isSpectateMode:",
      isSpectateMode,
    );

    if (bootstrapStatus !== "ready" || !setupResult || isSpectateMode) {
      debugLog("Skipping settlement check");
      return;
    }

    // Query player's settlement status from Dojo components
    const checkSettlementStatus = async () => {
      debugLog("Running settlement status check...");
      try {
        const { components } = setupResult;
        const playerAddress = account?.address;
        debugLog("Player address:", playerAddress);

        if (!playerAddress) {
          debugLog("No player address, skipping settlement check");
          setNeedsSettlement(false);
          return;
        }

        // Import Dojo utilities
        debugLog("Importing Dojo utilities...");
        const { getEntityIdFromKeys } = await import("@bibliothecadao/eternum");
        const { getComponentValue, HasValue, runQuery } = await import("@dojoengine/recs");

        const entityId = getEntityIdFromKeys([BigInt(playerAddress)]);
        debugLog("Entity ID:", entityId);

        // Check if player is registered
        const playerRegister = getComponentValue(components.BlitzRealmPlayerRegister, entityId);
        debugLog("playerRegister:", playerRegister);
        const isRegistered = playerRegister?.registered === true;

        // Check if player has any structures (meaning they've settled)
        const playerStructures = runQuery([HasValue(components.Structure, { owner: BigInt(playerAddress) })]);
        debugLog("playerStructures count:", playerStructures.size);
        const hasSettled = playerStructures.size > 0;

        // Check settlement finish status
        const settleFinish = getComponentValue(components.BlitzRealmSettleFinish, entityId);
        debugLog("settleFinish:", settleFinish);
        const coordsCount = (settleFinish as any)?.coords?.length ?? 0;
        const settledCount = (settleFinish as any)?.structure_ids?.length ?? 0;

        setAssignedRealmCount(coordsCount + settledCount);
        setSettledRealmCount(settledCount);

        // Player needs settlement if registered but not fully settled
        const canPlay = hasSettled && coordsCount + settledCount > 0 && settledCount === coordsCount + settledCount;
        const needsSettlementResult = isRegistered && !canPlay;

        debugLog("Settlement check result:", {
          isRegistered,
          hasSettled,
          coordsCount,
          settledCount,
          canPlay,
          needsSettlement: needsSettlementResult,
        });

        setNeedsSettlement(needsSettlementResult);
      } catch (error) {
        debugLog("Failed to check settlement status:", error);
        // On error, assume no settlement needed and let user enter game
        setNeedsSettlement(false);
      }
    };

    checkSettlementStatus();
  }, [bootstrapStatus, setupResult, account, isSpectateMode]);

  // Start bootstrap when modal opens
  useEffect(() => {
    if (!isOpen) {
      debugLog("Modal not open, skipping bootstrap");
      return;
    }

    debugLog("Starting bootstrap for", worldName, "chain:", chain);

    const startBootstrap = async () => {
      try {
        setBootstrapStatus("loading");
        setBootstrapError(null);
        setTasks(BOOTSTRAP_TASKS.map((t) => ({ ...t, status: "pending" })));
        setNeedsSettlement(false);
        setSettleStage("idle");

        // Apply world selection first
        debugLog("Applying world selection...");
        updateTask("world", "running");
        await applyWorldSelection({ name: worldName, chain }, chain);
        updateTask("world", "complete");
        debugLog("World selection complete");

        // Start bootstrap
        debugLog("Starting game bootstrap...");
        updateTask("manifest", "running");
        const result = await bootstrapGame();
        debugLog("Bootstrap complete, got setupResult:", !!result);

        // Mark all tasks complete
        setTasks((prev) => prev.map((t) => ({ ...t, status: "complete" })));
        setSetupResult(result);
        setBootstrapStatus("ready");
        debugLog("Bootstrap status set to ready");
      } catch (error) {
        debugLog("Bootstrap failed:", error);
        setBootstrapError(error instanceof Error ? error : new Error("Bootstrap failed"));
        setBootstrapStatus("error");
        setTasks((prev) => prev.map((t) => (t.status === "running" ? { ...t, status: "error" } : t)));
      }
    };

    startBootstrap();
  }, [isOpen, worldName, chain, updateTask]);

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
    setSettleStage("idle");
    // Trigger re-bootstrap
    setTimeout(() => {
      setBootstrapStatus("loading");
    }, 100);
  }, []);

  // Enter game handler
  const handleEnterGame = useCallback(() => {
    // Hide the onboarding overlay since we're entering through the new flow
    setShowBlankOverlay(false);
    const url = isSpectateMode ? "/play/map?col=0&row=0&spectate=true" : "/play/map?col=0&row=0";
    navigate(url);
  }, [navigate, isSpectateMode, setShowBlankOverlay]);

  // Settlement handler - calls actual Dojo system calls
  const handleSettle = useCallback(async () => {
    debugLog("handleSettle called - hasSetupResult:", !!setupResult, "hasAccount:", !!account);
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

      debugLog("Settlement config:", { isMainnet, singleRealmMode, blitzConfig });

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

        debugLog("Starting settlement (mainnet):", config);
        await systemCalls.blitz_realm_assign_and_settle_realms({
          signer: account,
          settlement_count: config.INITIAL_SETTLE_COUNT,
        });

        if (config.EXTRA_CALLS > 0) {
          setSettleStage("settling");
          for (let i = 0; i < config.EXTRA_CALLS; i++) {
            debugLog(`Extra settle call ${i + 1}/${config.EXTRA_CALLS}`);
            await systemCalls.blitz_realm_settle_realms({ signer: account, settlement_count: 1 });
          }
        }
      } else {
        const config = singleRealmMode
          ? SETTLEMENT_CONFIG.NON_MAINNET.SINGLE_REALM
          : SETTLEMENT_CONFIG.NON_MAINNET.MULTI_REALM;

        debugLog("Starting settlement (non-mainnet):", config);
        await systemCalls.blitz_realm_assign_and_settle_realms({
          signer: account,
          settlement_count: config.INITIAL_SETTLE_COUNT,
        });
      }

      debugLog("Settlement complete!");
      setSettleStage("done");
      setNeedsSettlement(false);

      // Auto-enter game after successful settlement
      setTimeout(() => {
        handleEnterGame();
      }, 1000);
    } catch (error) {
      debugLog("Settlement failed:", error);
      setSettleStage("error");
    } finally {
      setIsSettling(false);
    }
  }, [setupResult, account, handleEnterGame]);

  // Auto-enter game when ready (spectate mode or already settled)
  useEffect(() => {
    debugLog("Auto-enter check - phase:", phase, "isSpectateMode:", isSpectateMode);
    if (phase === "ready" && isSpectateMode) {
      debugLog("Auto-entering game in spectate mode...");
      const timer = setTimeout(() => {
        handleEnterGame();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, isSpectateMode, handleEnterGame]);

  debugLog("Render - isOpen:", isOpen, "phase:", phase, "bootstrapStatus:", bootstrapStatus);

  if (!isOpen) return null;

  const handleClose = () => {
    debugLog("Close button clicked");
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      debugLog("Backdrop clicked");
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
            {isSpectateMode ? <Eye className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isSpectateMode ? "Spectating" : "Entering"}</span>
          </div>
          <h3 className="text-lg font-bold text-gold truncate">{worldName}</h3>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            {(phase === "loading" || phase === "error") && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LoadingPhase tasks={tasks} progress={progress} error={bootstrapError} onRetry={handleRetry} />
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
