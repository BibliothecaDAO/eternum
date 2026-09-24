/**
 * GameEntryModal - Combined loading + settlement modal for seamless game entry
 *
 * This modal shows:
 * 1. Loading phase - Bootstrap progress (world config, native setup, sync)
 * 2. Settlement phase - If user is registered but hasn't settled
 * 3. Auto-transitions to game when ready
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Castle,
  Check,
  Eye,
  Loader2,
  Play,
  Sparkles,
  X,
  TreasureChest,
} from "@/ui/design-system/atoms/game-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { resolveEntryContextFromLandingSelection } from "@/game-entry/context";
import { RealmNumberPicker } from "./realm-number-picker";
import { createAutoSettleEntryKey, useAutoSettleStore } from "@/hooks/store/use-auto-settle-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import { identityUsername, useIdentitySessionStore, useSignInAndReturn } from "@/hooks/context/identity-session";
import { useUIStore } from "@/hooks/store/use-ui-store";

import { resolvePlayerNameFelt } from "@/services/identity/player-name";
import { useGameEntry } from "@/hooks/use-game-entry";

import { submitSettlement } from "@/services/settlement";
import { fetchSettlementSnapshot, type SettlementSnapshot } from "@/runtime/world/herald-pre-session-reader";
import { isGameOver, isMember } from "@/runtime/world/directory";
import { gameKey } from "@/runtime/world/store";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { BootstrapLoadingPanel } from "@/ui/layouts/bootstrap-loading/bootstrap-loading-panel";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { AccountStatePrompt } from "@/shell/account-state";
import { BlitzPreparing } from "@/shell/blitz-preparing";

import type { GameRef } from "@bibliothecadao/eternum/game-client";
import { Account } from "starknet";
import {
  isGameEntryPreflightComplete,
  resolveBlitzEntry,
  resolveGameEntryBlockingError,
  resolveGameEntryModalPhase,
  type GameEntryModalPhase as ModalPhase,
} from "./game-entry-phase";

import { resolveGameEntryTarget } from "./game-entry-navigation";
import { isSelectedWorldEntityWaitAborted, waitForSelectedWorldEntityState } from "./selected-world-entity-wait";

const DEBUG_MODAL = false;
const SETTLEMENT_SYNC_TIMEOUT_MS = 90000;
// An Eternum settlement creates one realm; Blitz realms are settled by the launch service.
const SEASON_SETTLEMENT_COUNT = 1;
const ENTRY_DIRECTORY_REFETCH_MS = 10_000;

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

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

interface GameEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: GameRef;
  isSpectateMode?: boolean;
  autoSettleEnabled?: boolean;
  /** Entry intent for route-owned landing entry */
  entryIntent?: "play" | "settle";
}

interface SettlementCopy {
  title: string;
  description: string;
  action: string;
}

const ETERNUM_SETTLEMENT_COPY: SettlementCopy = {
  title: "Settle Into The Game",
  description: "Settle to create your starting realm at a random location.",
  action: "Settle",
};

const FRONTIER_SETTLEMENT_COPY: SettlementCopy = {
  title: "Found your realm",
  description: "It is raised again on every new map with everything you build.",
  action: "Found a realm",
};

/**
 * Settlement phase - shows settlement wizard
 */
const SettlementPhase = ({
  copy,
  stage,
  settledCount,
  expectedSettlementCount,
  isSettling,
  onSettle,
  onEnterGame,
  errorMessage,
  canSettle = true,
}: {
  copy: SettlementCopy;
  canSettle?: boolean;
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
          {isSettlementComplete ? "Settlement Complete!" : isSettlementSyncing ? "Finalizing Settlement" : copy.title}
        </h2>
        <p className="text-xs text-gold/60 mt-1">
          {isSettlementComplete
            ? `Your ${realmLabel} ${expectedSettlementCount === 1 ? "is" : "are"} ready.`
            : isSettlementSyncing
              ? "Your settlement was submitted. Waiting for confirmation."
              : copy.description}
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
          disabled={!canSettle || isSettling || isSettlementSyncing}
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
              <TreasureChest className="w-4 h-4 " />
              <span>{copy.action}</span>
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
        <p className="text-xs text-gold/60 mt-1">Settlement opens when the season begins.</p>
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

/** The entry holds here until the player's account has joined this game's shard; watching needs no account. */
const AccountPhase = ({ onSpectate }: { onSpectate: () => void }) => (
  <div className="flex flex-col gap-3 py-4 text-center">
    <AccountPhaseState />
    <Button onClick={onSpectate} variant="outline" className="w-full h-9" forceUppercase={false}>
      <div className="flex items-center justify-center gap-2">
        <Eye className="w-4 h-4" />
        <span>Spectate</span>
      </div>
    </Button>
  </div>
);

const AccountPhaseState = () => {
  const sessionStatus = useIdentitySessionStore((state) => state.status);
  const provisioningError = useAccountStore((state) => state.provisioningError);
  const signInAndReturn = useSignInAndReturn();
  const location = useLocation();

  if (sessionStatus === "anonymous") {
    return (
      <>
        <p className="text-sm text-white/60">
          Sign in to play. Your account is set up the first time you enter a game.
        </p>
        <Button
          onClick={() => signInAndReturn(`${location.pathname}${location.search}`)}
          className="w-full h-11 !text-brown !bg-gold rounded-md"
          forceUppercase={false}
        >
          Sign in
        </Button>
      </>
    );
  }
  if (isAccountStatePrompt(provisioningError)) return <AccountStatePrompt />;
  if (provisioningError) return <p className="text-xs text-red-300 break-words">{provisioningError}</p>;
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-gold">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Preparing your account...</span>
    </div>
  );
};

const BlitzSpectatePhase = ({ ended, onSpectate }: { ended: boolean; onSpectate: () => void }) => (
  <div className="text-center py-4">
    <Eye className="w-12 h-12 text-gold mx-auto mb-3" />
    <h2 className="text-lg font-semibold text-gold mb-2">
      {ended ? "This game has ended" : "You are not in this game"}
    </h2>
    <p className="text-sm text-white/60 mb-4">
      {ended ? "Its results are final. You can still look around the map." : "Only the roster plays. You can watch."}
    </p>
    <Button onClick={onSpectate} className="w-full h-11 !text-brown !bg-gold rounded-md" forceUppercase={false}>
      <div className="flex items-center justify-center gap-2">
        <Eye className="w-4 h-4" />
        <span>{ended ? "Review" : "Spectate"}</span>
      </div>
    </Button>
  </div>
);

/**
 * Main GameEntryModal component
 */
export const GameEntryModal = ({
  isOpen,
  onClose,
  game: routedGame,
  isSpectateMode = false,
  autoSettleEnabled = false,
  entryIntent = "play",
}: GameEntryModalProps) => {
  // The route rebuilds its game ref on every render; effects key on the ref's values, not its identity.
  const { chainId, gameId } = routedGame;
  const game = useMemo<GameRef>(() => ({ chainId, gameId }), [chainId, gameId]);
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
    return createAutoSettleEntryKey({ ...game, walletAddress: account.address });
  }, [account?.address, game]);
  const playerFeltAddress = useMemo(() => {
    if (!account?.address) return null;
    try {
      return toPaddedFeltAddress(account.address);
    } catch {
      return null;
    }
  }, [account?.address]);

  // The game's directory row is the one source for entry: it is polled while the modal waits on readiness.
  const gameEntry = useGameEntry(game, {
    enabled: isOpen,
    player: playerFeltAddress,
    refetchIntervalMs: ENTRY_DIRECTORY_REFETCH_MS,
  });
  const isCheckingWorldAvailability = gameEntry.data === undefined && gameEntry.error == null;
  const worldMeta = gameEntry.data ?? null;
  const worldName = worldMeta?.name ?? `Game ${game.gameId}`;
  const worldMode = worldMeta?.mode ?? "unknown";
  const isBlitzMode = worldMode === "blitz";
  const isEternumMode = worldMode === "eternum";
  const isFrontierMode = worldMode === "frontier";
  // Eternum and Frontier both settle one realm from here; Blitz realms are settled by the launch service.
  const isSeasonMode = isEternumMode || isFrontierMode;
  const isDevMode = worldMeta?.dev_mode_on === true;
  const isEternumDevMode = isEternumMode && isDevMode;
  const [devRealmNumber, setDevRealmNumber] = useState("1");
  const [devSettlementTarget, setDevSettlementTarget] = useState<number | null>(null);
  const validDevRealmNumber =
    Number.isInteger(Number(devRealmNumber)) && Number(devRealmNumber) >= 1 && Number(devRealmNumber) <= 8000;
  const resolvedEntryIntent = isSpectateMode ? "spectate" : entryIntent;
  const entryContext = useMemo(
    () =>
      resolveEntryContextFromLandingSelection({
        selection: game,
        intent: resolvedEntryIntent,
        autoSettle: autoSettleEnabled,
      }),
    [autoSettleEnabled, game, resolvedEntryIntent],
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

  const expectedSettlementCount = SEASON_SETTLEMENT_COUNT;
  const hasEnteredGameRef = useRef(false);
  const entityWaitAbortControllerRef = useRef<AbortController | null>(null);

  const navigationEntryContext = entryContext;
  useEffect(() => {
    if (!isOpen) hasEnteredGameRef.current = false;
  }, [isOpen]);

  const resetBootstrapDependentState = useCallback(() => {
    setPreflightError(null);
    setNeedsSettlement(false);
    setCanPlay(false);
    setSettlementCheckComplete(false);
    setSettleStage("idle");
    setIsSettling(false);
    setSettledRealmCount(0);
    setDevSettlementTarget(null);
    setDevRealmNumber("1");
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
  }, [game, isOpen]);

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

  const nowSeconds = nowSec;
  const seasonStartAt = worldMeta?.clock.start_settling_at ?? null;
  const seasonHasStarted = seasonStartAt != null && seasonStartAt <= nowSeconds;
  const endAt = worldMeta?.clock.end_at;
  const seasonNotEnded = endAt == null || endAt === 0 || nowSeconds <= endAt;
  const seasonTimingValid = isDevMode || (seasonHasStarted && seasonNotEnded);
  const secondsUntilSeasonStart = seasonStartAt == null ? null : Math.max(0, seasonStartAt - nowSeconds);
  const blitzEntry = useMemo(() => {
    if (!isBlitzMode || !worldMeta?.player_state) return null;
    return resolveBlitzEntry({ isMember: isMember(worldMeta), ready: worldMeta.ready, ended: isGameOver(worldMeta) });
  }, [isBlitzMode, worldMeta]);
  // Blitz entry is decided by the roster fact; Eternum entry by the player's own settlement.
  const checksComplete = isBlitzMode ? blitzEntry != null : settlementCheckComplete;
  const entryPreflightComplete = isGameEntryPreflightComplete({
    isSpectateMode,
    hasAccount: account != null,
    settlementCheckComplete: checksComplete,
  });
  const settlementCopy = isFrontierMode ? FRONTIER_SETTLEMENT_COPY : ETERNUM_SETTLEMENT_COPY;
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
        label: isBlitzMode ? "Checking the roster" : "Checking world entry state",
        status: entryPreflightComplete ? ("complete" as const) : ("running" as const),
      },
    ],
    [entryPreflightComplete, isBlitzMode, worldMeta],
  );
  const progress = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "complete").length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const worldAvailabilityErrorMessage = gameEntry.error instanceof Error ? gameEntry.error.message : null;
  const phaseError = useMemo(
    () =>
      preflightError ??
      resolveGameEntryBlockingError({
        worldAvailabilityErrorMessage,
        isCheckingWorldAvailability,
        isWorldAvailable: gameEntry.data === undefined ? null : gameEntry.data !== null,
        hasWorldMeta: worldMeta != null,
        worldMode,
      }),
    [preflightError, worldAvailabilityErrorMessage, isCheckingWorldAvailability, gameEntry.data, worldMeta, worldMode],
  );

  // Determine current phase
  const phase: ModalPhase = useMemo(() => {
    const result = resolveGameEntryModalPhase({
      bootstrapStatus,
      hasPhaseError: phaseError != null,
      isBlitzMode,
      blitzEntry,
      isSpectateMode,
      worldMode,
      isCheckingWorldAvailability,
      hasWorldMeta: worldMeta != null,
      hasAccount: account != null,
      isSeasonMode,
      checksComplete,
      needsSettlement,
      canPlay,
      isEternumDevMode,
      isSettlingAdditionalRealm: devSettlementTarget !== null,
      isSettlementUnlocked: seasonTimingValid,
    });

    return result;
  }, [
    account,
    bootstrapStatus,
    isEternumDevMode,
    devSettlementTarget,
    phaseError,
    isBlitzMode,
    blitzEntry,
    isSpectateMode,
    checksComplete,
    needsSettlement,
    canPlay,
    seasonTimingValid,
    isSeasonMode,
    isCheckingWorldAvailability,
    worldMode,
    worldMeta,
  ]);

  const readSettlementSnapshot = useCallback(async (): Promise<SettlementSnapshot | null> => {
    if (!account?.address || !worldMeta) return null;
    return fetchSettlementSnapshot(game, account.address);
  }, [account?.address, game, worldMeta]);

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
        ...game,
        description: "settlement indexing",
        isTarget: ({ status }) => status != null && status.settledCount >= Math.max(1, targetSettleCount),
        read: async () => {
          const snapshot = await readSettlementSnapshot();
          return {
            snapshot,
            status: snapshot ? syncSettlementStateFromSnapshot(snapshot) : null,
          };
        },
        signal: beginEntityWait(),
        slowAfterMs: SETTLEMENT_SYNC_TIMEOUT_MS,
      });

      if (!observation.snapshot) {
        throw new Error("Settlement subscription matched without an indexed settlement snapshot.");
      }
      return observation.snapshot;
    },
    [beginEntityWait, game, readSettlementSnapshot, syncSettlementStateFromSnapshot],
  );

  // Check settlement status after bootstrap completes
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!isSeasonMode) {
      debugLog(worldName, "Skipping settlement check - Blitz realms are settled by the launch service");
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
        if (!account?.address) return;

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
    isSeasonMode,
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

    debugLog(worldName, "Resetting modal state for", gameKey(game));
    resetBootstrapDependentState();
    // The display name arrives with the directory; only another game resets the modal.
  }, [game, isOpen, resetBootstrapDependentState]);

  // Retry handler
  const handleRetry = useCallback(() => {
    resetBootstrapDependentState();
    setPreflightError(null);
    setPreflightRetryNonce((current) => current + 1);
  }, [resetBootstrapDependentState]);

  const enterGame = useCallback(
    (spectate: boolean) => {
      if (!navigationEntryContext) {
        return;
      }

      markGameEntryMilestone("enter-game-started");

      const entryTarget = resolveGameEntryTarget({
        chainId: navigationEntryContext.chainId,
        gameId: navigationEntryContext.gameId,
        structureEntityId: useUIStore.getState().structureEntityId,
        worldMapReturnPosition: useUIStore.getState().worldMapReturnPosition,
        isSpectateMode: spectate,
      });

      navigate(entryTarget.url);
      window.dispatchEvent(new Event("urlChanged"));
    },
    [navigate, navigationEntryContext],
  );
  const handleEnterGame = useCallback(
    () => enterGame(navigationEntryContext?.intent === "spectate"),
    [enterGame, navigationEntryContext?.intent],
  );
  const handleSpectate = useCallback(() => enterGame(true), [enterGame]);

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

  const finalizeFailedSettlement = useCallback(
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

  // Settlement is an authenticated, recorded action.
  const handleSettle = useCallback(async () => {
    if (!isSeasonMode) {
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
      const signer = account as unknown as Account;
      if (!usernameFelt) {
        throw new Error("Unable to resolve player name for settlement.");
      }

      const initialSnapshot = await readSettlementSnapshot();
      if (isEternumDevMode && !initialSnapshot) throw new Error("Settlement state is still loading.");
      if (initialSnapshot) {
        const initialStatus = syncSettlementStateFromSnapshot(initialSnapshot);
        if (initialStatus.canPlay && !isEternumDevMode) {
          finalizeSuccessfulSettlement();
          return;
        }
      }

      const settlementTarget = isEternumDevMode ? (initialSnapshot?.settledCount ?? 0) + 1 : expectedSettlementCount;
      if (isEternumDevMode) setDevSettlementTarget(settlementTarget);
      setSettleStage("settling");
      await submitSettlement(navigationEntryContext, (client) =>
        client.setup.systemCalls.settle_season({
          signer,
          name: usernameFelt,
          selectedRealm: isEternumDevMode ? Number(devRealmNumber) : undefined,
        }),
      );

      setSettleStage("syncing");
      const finalSnapshot = await waitForSettlementTarget(settlementTarget);

      const finalStatus = syncSettlementStateFromSnapshot(finalSnapshot);
      if (!finalStatus.canPlay) {
        throw new Error("Settlement is still syncing. Please try again if the world does not unlock shortly.");
      }

      setDevSettlementTarget(null);
      finalizeSuccessfulSettlement();
    } catch (error) {
      if (isSelectedWorldEntityWaitAborted(error)) return;
      finalizeFailedSettlement(error instanceof Error ? error : new Error("Settlement failed"));
    } finally {
      setIsSettling(false);
    }
  }, [
    autoSettleEnabled,
    autoSettleEntryKey,
    account,
    expectedSettlementCount,
    finalizeFailedSettlement,
    finalizeSuccessfulSettlement,
    isSeasonMode,
    isEternumDevMode,
    devRealmNumber,
    markSettling,
    syncSettlementStateFromSnapshot,
    usernameFelt,
    waitForSettlementTarget,
    worldMeta,
    worldName,
    readSettlementSnapshot,
    navigationEntryContext,
  ]);

  useEffect(() => {
    if (!isOpen || !autoSettleEnabled || !autoSettleEntryKey) return;

    autoSettleAttemptedRef.current = false;
    markOpening(autoSettleEntryKey, Date.now());
  }, [autoSettleEnabled, autoSettleEntryKey, isOpen, markOpening]);

  useEffect(() => {
    if (
      !isEternumMode ||
      !autoSettleEnabled ||
      phase !== "settlement" ||
      isSettling ||
      autoSettleAttemptedRef.current
    ) {
      return;
    }

    autoSettleAttemptedRef.current = true;
    void handleSettle();
  }, [isEternumMode, autoSettleEnabled, handleSettle, isSettling, phase]);
  // Auto-enter game when ready (spectate mode or already settled players)
  useEffect(() => {
    debugLog(worldName, "Auto-enter check - phase:", phase, "isSpectateMode:", isSpectateMode);
    const shouldAutoEnter = phase === "ready" && entryIntent === "play";
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

  const usesDesktopCenteredSettlementLayout = phase === "ready";

  return (
    <div
      className={cn(
        // The backdrop scrolls, so a modal taller than a sideways phone stays reachable to its last button.
        "fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/70 pb-8 backdrop-blur-sm max-lg:landscape:pt-4",
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
          "max-w-md",
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
            usesDesktopCenteredSettlementLayout &&
              "lg:min-h-0 lg:flex-1 lg:max-h-none lg:overflow-y-auto lg:pr-4 lg:scrollbar-thin lg:scrollbar-thumb-gold/20 lg:scrollbar-track-transparent",
          )}
        >
          <AnimatePresence mode="wait">
            {(phase === "loading" || phase === "error") && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <BootstrapLoadingPanel tasks={tasks} progress={progress} error={phaseError} onRetry={handleRetry} />
              </motion.div>
            )}
            {phase === "account" && (
              <motion.div key="account" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AccountPhase onSpectate={handleSpectate} />
              </motion.div>
            )}
            {phase === "settlement-waiting" && (
              <motion.div
                key="settlement-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SettlementWaitingPhase secondsUntilUnlock={secondsUntilSeasonStart} />
              </motion.div>
            )}
            {phase === "settlement" && isBlitzMode && (
              <motion.div key="preparing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {worldMeta ? <BlitzPreparing game={worldMeta} member /> : null}
              </motion.div>
            )}
            {phase === "spectate" && (
              <motion.div key="spectate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <BlitzSpectatePhase ended={blitzEntry === "review"} onSpectate={handleSpectate} />
              </motion.div>
            )}
            {phase === "settlement" && isSeasonMode && (
              <motion.div key="settlement" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {isEternumDevMode && (
                  <RealmNumberPicker value={devRealmNumber} onChange={setDevRealmNumber} disabled={isSettling} />
                )}
                <SettlementPhase
                  copy={settlementCopy}
                  canSettle={!isEternumDevMode || validDevRealmNumber}
                  stage={settleStage}
                  settledCount={settledRealmCount}
                  expectedSettlementCount={
                    isEternumDevMode ? (devSettlementTarget ?? settledRealmCount + 1) : expectedSettlementCount
                  }
                  isSettling={isSettling}
                  onSettle={handleSettle}
                  onEnterGame={handleEnterGame}
                  errorMessage={settleErrorMessage}
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
                {!isSpectateMode && isEternumDevMode && (
                  <Button
                    onClick={() => {
                      setDevSettlementTarget(settledRealmCount + 1);
                      setSettleStage("idle");
                    }}
                    variant="outline"
                    className="w-full h-10 mt-2"
                    forceUppercase={false}
                  >
                    Settle Another Realm
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
