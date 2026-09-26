/**
 * The entry into a game, drawn as the doorway (design o5): the account, then the realm founded or prepared, then the
 * hand-off to the game's route, where the doorway carries on while the map boots.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { resolveEntryContextFromLandingSelection } from "@/game-entry/context";
import { RealmNumberPicker } from "./realm-number-picker";
import { createAutoSettleEntryKey, useAutoSettleStore } from "@/hooks/store/use-auto-settle-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { identityUsername, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useRequestSignIn } from "@/shell/sign-in/sign-in-route";
import { useUIStore } from "@/hooks/store/use-ui-store";

import { resolvePlayerNameFelt } from "@/services/identity/player-name";
import { useGameEntry } from "@/hooks/use-game-entry";

import { submitSettlement } from "@/services/settlement";
import { fetchSettlementSnapshot, type SettlementSnapshot } from "@/runtime/world/herald-pre-session-reader";
import { isGameOver, isMember } from "@/runtime/world/directory";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { BlitzPreparing } from "@/shell/blitz-preparing";
import { TimeLeftChip } from "@/shell/live-chips";
import { getRealmNameById } from "@bibliothecadao/eternum";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { type DoorwayRealm, DoorwayScreen } from "./doorway/doorway-screen";
import { doorwayView } from "./doorway/doorway-view";

import type { GameRef } from "@bibliothecadao/eternum/game-client";
import { Account } from "starknet";
import {
  isGameEntryPreflightComplete,
  resolveBlitzEntry,
  resolveGameEntryBlockingError,
  resolveGameEntryModalPhase,
  type GameEntryModalPhase as ModalPhase,
} from "./game-entry-phase";

import { gameModeConfigOf } from "@/config/game-modes";
import { resolveGameEntryTarget } from "./game-entry-navigation";
import { isSelectedWorldEntityWaitAborted, waitForSelectedWorldEntityState } from "./selected-world-entity-wait";

const SETTLEMENT_SYNC_TIMEOUT_MS = 90000;
// An Eternum settlement creates one realm; Blitz realms are settled by the launch service.
const SEASON_SETTLEMENT_COUNT = 1;
const ENTRY_DIRECTORY_REFETCH_MS = 10_000;

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

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

interface GameEntryModalProps {
  isOpen: boolean;
  game: GameRef;
  isSpectateMode?: boolean;
  autoSettleEnabled?: boolean;
  /** Entry intent for route-owned landing entry */
  entryIntent?: "play" | "settle";
}

export const GameEntryModal = ({
  isOpen,
  game: routedGame,
  isSpectateMode = false,
  autoSettleEnabled = false,
  entryIntent = "play",
}: GameEntryModalProps) => {
  // The route rebuilds its game ref on every render; effects key on the ref's values, not its identity.
  const { chainId, gameId } = routedGame;
  const game = useMemo<GameRef>(() => ({ chainId, gameId }), [chainId, gameId]);
  const navigate = useNavigate();
  const requestSignIn = useRequestSignIn();
  const sessionStatus = useIdentitySessionStore((state) => state.status);
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
  const bootstrapStatus: "idle" | "pending-world" | "loading" | "ready" | "error" = preflightError
    ? "error"
    : isCheckingWorldAvailability || !entryPreflightComplete
      ? "loading"
      : "ready";
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

  // The doorway shows a calm retry; what went wrong is for the console.
  useEffect(() => {
    if (phaseError) console.error("game_entry_failed", { worldName, error: phaseError });
  }, [phaseError, worldName]);

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

    resetBootstrapDependentState();
    // The display name arrives with the directory; only another game resets the modal.
  }, [game, isOpen, resetBootstrapDependentState]);

  // Retry handler
  const handleRetry = useCallback(() => {
    resetBootstrapDependentState();
    setPreflightError(null);
    setPreflightRetryNonce((current) => current + 1);
  }, [resetBootstrapDependentState]);

  // The mode decides the first view; a game whose row names no mode opens on the map, the scene every mode has.
  const entryScene = worldMeta?.mode ? gameModeConfigOf(worldMeta.mode).ui.entryScene : "map";
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
        entryScene,
      });

      navigate(entryTarget.url);
      window.dispatchEvent(new Event("urlChanged"));
    },
    [entryScene, navigate, navigationEntryContext],
  );
  const handleEnterGame = useCallback(
    () => enterGame(navigationEntryContext?.intent === "spectate"),
    [enterGame, navigationEntryContext?.intent],
  );
  const handleSpectate = useCallback(() => enterGame(true), [enterGame]);

  const finalizeSuccessfulSettlement = useCallback(() => {
    setSettleStage("done");
    setNeedsSettlement(false);
    if (autoSettleEnabled && autoSettleEntryKey) {
      markCompleted(autoSettleEntryKey);
    }

    setTimeout(() => {
      handleEnterGame();
    }, 1000);
  }, [autoSettleEnabled, autoSettleEntryKey, handleEnterGame, markCompleted]);

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
    readSettlementSnapshot,
    navigationEntryContext,
  ]);

  useEffect(() => {
    if (!isOpen || !autoSettleEnabled || !autoSettleEntryKey) return;

    autoSettleAttemptedRef.current = false;
    markOpening(autoSettleEntryKey, Date.now());
  }, [autoSettleEnabled, autoSettleEntryKey, isOpen, markOpening]);

  // The doorway founds a Frontier realm on its own (design o5); an Eternum realm when the entry asked for it.
  const foundsOnItsOwn = isFrontierMode || (isEternumMode && autoSettleEnabled);
  useEffect(() => {
    if (!foundsOnItsOwn || phase !== "settlement" || isSettling || autoSettleAttemptedRef.current) {
      return;
    }

    autoSettleAttemptedRef.current = true;
    void handleSettle();
  }, [foundsOnItsOwn, handleSettle, isSettling, phase]);
  // Auto-enter game when ready (spectate mode or already settled players)
  useEffect(() => {
    const shouldAutoEnter = phase === "ready" && entryIntent === "play";
    if (shouldAutoEnter) {
      handleEnterGame();
    }
  }, [phase, handleEnterGame, entryIntent]);

  if (!isOpen) return null;

  const realm = entryRealm(worldMeta);
  const view = doorwayView({
    source: "entry",
    phase,
    audience: isSpectateMode ? "spectator" : "player",
    signedIn: sessionStatus === "signed-in",
    foundingFailed: settleStage === "error",
  });

  return (
    <DoorwayScreen
      view={view}
      realm={realm}
      onRetry={settleStage === "error" ? () => void handleSettle() : handleRetry}
      onSignIn={() => requestSignIn()}
      onSpectate={handleSpectate}
    >
      {phase === "settlement-waiting" && <TimeLeftChip seconds={secondsUntilSeasonStart ?? undefined} />}
      {phase === "settlement" && isBlitzMode && worldMeta && <BlitzPreparing game={worldMeta} member />}
      {phase === "settlement" && isSeasonMode && !foundsOnItsOwn && settleStage === "idle" && (
        <>
          {isEternumDevMode && (
            <RealmNumberPicker value={devRealmNumber} onChange={setDevRealmNumber} disabled={isSettling} />
          )}
          <button
            type="button"
            disabled={isSettling || (isEternumDevMode && !validDevRealmNumber)}
            onClick={() => void handleSettle()}
            className="frontier-primary w-full"
          >
            Found your realm
          </button>
        </>
      )}
      {phase === "ready" && !isSpectateMode && isEternumDevMode && (
        <button
          type="button"
          onClick={() => {
            setDevSettlementTarget(settledRealmCount + 1);
            setSettleStage("idle");
          }}
          className="frontier-chip justify-center px-4 py-2"
        >
          Settle another realm
        </button>
      )}
    </DoorwayScreen>
  );
};

/** The player's realm on the entry side, from the game's directory row: its name, before the game's store has it. */
const entryRealm = (game: HeraldGameDirectoryEntry | null): DoorwayRealm | null => {
  const realm = game?.player_state?.structures.find((structure) => isRealmCategory(structure.category));
  return realm ? { name: getRealmNameById(realm.realm_id), emblem: null, still: null } : null;
};
