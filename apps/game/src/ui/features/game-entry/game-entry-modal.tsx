import { AspectPicker, aspectOfOrder, aspectOffer } from "./aspect-picker";
import { isRealmElsewhere, RealmSideWarning, seasonSide, sideAspect } from "./realm-side-warning";
import { canonicalRealm } from "@bibliothecadao/eternum";
import type { AspectId } from "@bibliothecadao/types";
import { pageNavigation } from "@/utils/page-navigation";
import { isRealmNumber, registerHomeSource } from "@/services/realm-entry";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { useHeldRealms } from "@/hooks/use-holdings";
/**
 * The entry into a game, drawn as the doorway (design o5): the account, then the realm founded or prepared, then the
 * hand-off to the game's route, where the doorway carries on while the map boots.
 */

import { ASPECT_STEP_WORDS, HOME_STEP_WORDS } from "@/ui/design-system/kit/words";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { resolveEntryContextFromLandingSelection } from "@/game-entry/context";
import { EntryModeSwitch, HomeSourcePicker, useNothingToChoose } from "./home-source-picker";
import { RealmNumberPicker } from "./realm-number-picker";
import { createAutoSettleEntryKey, useAutoSettleStore } from "@/hooks/store/use-auto-settle-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useRequestSignIn } from "@/shell/sign-in/connect";
import { useJoinedShare } from "@/shell/share/own-shares";
import { useOrderIntent } from "@/shell/play/order-intent";
import { useUIStore } from "@/hooks/store/use-ui-store";

import { useGameEntry } from "@/hooks/use-game-entry";

import { submitSettlement } from "@/services/settlement";
import { fetchSettlementSnapshot, type SettlementSnapshot } from "@/runtime/world/herald-pre-session-reader";
import { isGameOver } from "@/runtime/world/directory";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { resultsHref } from "@/shell/season-tab/results-link";
import { questBonusPercentOf } from "@/shell/season";
import { seasonRealm } from "@/shell/season-pick";
import { doorwayRealmFromId, toPaddedFeltAddress } from "./doorway/doorway-realm";
import { DoorwayScreen, RealmRising } from "./doorway/doorway-screen";
import { doorwayView } from "./doorway/doorway-view";

import type { GameRef } from "@bibliothecadao/eternum/game-client";
import { Account } from "starknet";
import {
  isGameEntryPreflightComplete,
  resolveGameEntryBlockingError,
  resolveGameEntryModalPhase,
  type GameEntryModalPhase as ModalPhase,
} from "./game-entry-phase";

import { parseRendererOptions } from "@/play/navigation/play-route";
import { resolveGameEntryTarget } from "./game-entry-navigation";
import { isSelectedWorldEntityWaitAborted, waitForSelectedWorldEntityState } from "./selected-world-entity-wait";

const SETTLEMENT_SYNC_TIMEOUT_MS = 90000;
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
  const [heldRealmNumber, setHeldRealmNumber] = useState("");
  const [aspect, setAspect] = useState<AspectId | null>(null);
  const [order, setOrder] = useState<number | null>(null);
  const [sideAnswer, setSideAnswer] = useState<"realm" | "free" | null>(null);
  const [registeredRealmId, setRegisteredRealmId] = useState<number | null>(null);
  /** The Realm step's pick stands on what the account holds (its reads answered); founding waits for it. */
  const [homeSettled, setHomeSettled] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const validHeldRealm = heldRealmNumber === "" || isRealmNumber(heldRealmNumber);
  const accountError = useAccountStore((state) => state.provisioningError);
  const markOpening = useAutoSettleStore((state) => state.markOpening);
  const markSettling = useAutoSettleStore((state) => state.markSettling);
  const markCompleted = useAutoSettleStore((state) => state.markCompleted);
  const markFailed = useAutoSettleStore((state) => state.markFailed);
  const autoSettleAttemptedRef = useRef(false);
  const autoSettleEntryKey = useMemo(() => {
    if (!account?.address) return null;
    return createAutoSettleEntryKey({ ...game, walletAddress: account.address });
  }, [account?.address, game]);
  const playerFeltAddress = useMemo(() => toPaddedFeltAddress(account?.address), [account?.address]);

  const joinedShare = useJoinedShare();
  const keptIntent = useOrderIntent();
  const { held } = useHeldRealms();
  const heldRealmsCount = held.data?.length ?? 0;
  // The game's directory row is the one source for entry: it is polled while the modal waits on readiness.
  const gameEntry = useGameEntry(game, {
    enabled: isOpen,
    player: playerFeltAddress,
    refetchIntervalMs: ENTRY_DIRECTORY_REFETCH_MS,
  });
  const isCheckingWorldAvailability = gameEntry.data === undefined && gameEntry.error == null;
  const worldMeta = gameEntry.data ?? null;
  const hasWorldMeta = worldMeta !== null;
  const worldName = worldMeta?.name ?? `Game ${game.gameId}`;
  const worldMode = worldMeta?.mode ?? "unknown";
  const isEternumMode = worldMode === "eternum";
  const isFrontierMode = worldMode === "frontier";
  const gameOver = worldMeta ? isGameOver(worldMeta) : false;
  const isSeasonMode = isEternumMode || isFrontierMode;
  const isDevMode = worldMeta?.dev_mode_on === true;
  const isEternumDevMode = isEternumMode && isDevMode;
  const [devRealmNumber, setDevRealmNumber] = useState("1");
  const [devSettlementTarget, setDevSettlementTarget] = useState<number | null>(null);
  const validDevRealmNumber = isRealmNumber(devRealmNumber);
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
  const [isSettling, setIsSettling] = useState(false);
  const [settledRealmCount, setSettledRealmCount] = useState(0);
  const [needsSettlement, setNeedsSettlement] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [sourceLessHome, setSourceLessHome] = useState(false);
  const [sourceAvailable, setSourceAvailable] = useState<boolean | null>(null);
  const [takenRealmIds, setTakenRealmIds] = useState<number[]>([]);
  const choosingSource = sourceLessHome && sourceAvailable !== false;

  const expectedSettlementCount = SEASON_SETTLEMENT_COUNT;
  const hasEnteredGameRef = useRef(false);
  // A Frontier realm this entry created: its player arrives in it, to build (the owner's pick F3).
  const createdRealmRef = useRef(false);
  const entityWaitAbortControllerRef = useRef<AbortController | null>(null);

  const navigationEntryContext = entryContext;
  useEffect(() => {
    hasEnteredGameRef.current = false;
    createdRealmRef.current = false;
  }, [isOpen, chainId, gameId]);

  const resetBootstrapDependentState = useCallback(() => {
    setPreflightError(null);
    setNeedsSettlement(false);
    setCanPlay(false);
    setSourceLessHome(false);
    setSourceAvailable(null);
    setTakenRealmIds([]);
    setSettlementCheckComplete(false);
    setSettleStage("idle");
    setIsSettling(false);
    setSettledRealmCount(0);
    setDevSettlementTarget(null);
    setDevRealmNumber("1");
    setHeldRealmNumber("");
    setSideAnswer(null);
    setRegisteredRealmId(null);
    setSettlementError(null);
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
  const seasonEnded = !isDevMode && (gameOver || (worldMeta != null && !seasonNotEnded));
  const seasonTimingValid = isDevMode || (seasonHasStarted && seasonNotEnded);
  const entryPreflightComplete = isGameEntryPreflightComplete({
    isSpectateMode,
    hasAccount: account != null,
    settlementCheckComplete,
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
      isSpectateMode,
      worldMode,
      isCheckingWorldAvailability,
      hasWorldMeta: worldMeta != null,
      hasAccount: account != null,
      isSeasonMode,
      checksComplete: settlementCheckComplete,
      needsSettlement: needsSettlement || choosingSource,
      canPlay: canPlay && !choosingSource,
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
    isSpectateMode,
    settlementCheckComplete,
    needsSettlement,
    canPlay,
    choosingSource,
    seasonTimingValid,
    isSeasonMode,
    isCheckingWorldAvailability,
    worldMode,
    worldMeta,
  ]);

  const readSettlementSnapshot = useCallback(async (): Promise<SettlementSnapshot | null> => {
    if (!account?.address || !hasWorldMeta) return null;
    return fetchSettlementSnapshot(game, account.address);
  }, [account?.address, game, hasWorldMeta]);

  const syncSettlementStateFromSnapshot = useCallback(
    (snapshot: SettlementSnapshot) => {
      const status = deriveSettlementStatus({
        snapshot,
        expectedSettlementCount: expectedSettlementCount,
      });
      setRegisteredRealmId(snapshot.heldRealmId);
      setTakenRealmIds(snapshot.takenRealmIds);
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
        setSourceLessHome(isFrontierMode && snapshot.hasSettledStructure && !snapshot.hasHomeSource && !gameOver);
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
    game,
    isFrontierMode,
    gameOver,
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

  const enterGame = useCallback(
    (spectate: boolean) => {
      if (!navigationEntryContext || hasEnteredGameRef.current) {
        return;
      }

      hasEnteredGameRef.current = true;
      markGameEntryMilestone("enter-game-started");

      const entryTarget = resolveGameEntryTarget({
        chainId: navigationEntryContext.chainId,
        gameId: navigationEntryContext.gameId,
        structureEntityId: useUIStore.getState().structureEntityId,
        worldMapReturnPosition: useUIStore.getState().worldMapReturnPosition,
        isSpectateMode: spectate,
        realmFirst: createdRealmRef.current,
        renderer: parseRendererOptions(new URLSearchParams(window.location.search)),
      });

      // The doorway gives its place in history to the game: Back from the map leaves for where the player came from,
      // never onto a doorway that enters the booted game again.
      navigate(entryTarget.url, { replace: true });
      window.dispatchEvent(new Event("urlChanged"));
    },
    [navigate, navigationEntryContext],
  );
  const handleEnterGame = useCallback(
    () => enterGame(navigationEntryContext?.intent === "spectate"),
    [enterGame, navigationEntryContext?.intent],
  );

  const finalizeSuccessfulSettlement = useCallback(() => {
    setSettleStage("done");
    setNeedsSettlement(false);
    if (autoSettleEnabled && autoSettleEntryKey) {
      markCompleted(autoSettleEntryKey);
    }
  }, [autoSettleEnabled, autoSettleEntryKey, markCompleted]);

  const finalizeFailedSettlement = useCallback(
    (error: Error) => {
      console.error("[GameEntryModal] Settlement failed", { worldName, error });
      setSettleStage("error");
      setSettlementError(error.message);
      if (autoSettleEnabled && autoSettleEntryKey) {
        markFailed(autoSettleEntryKey, error.message);
      }
    },
    [autoSettleEnabled, autoSettleEntryKey, markFailed, worldName],
  );

  const attachChosenSource = useCallback(async () => {
    setSettleStage("settling");
    await registerHomeSource(game, heldRealmNumber === "" ? null : Number(heldRealmNumber));
    setSettleStage("syncing");
    await waitForSelectedWorldEntityState({
      ...game,
      description: "daily claim indexing",
      isTarget: (snapshot) => snapshot?.hasHomeSource === true,
      read: readSettlementSnapshot,
      signal: beginEntityWait(),
      slowAfterMs: SETTLEMENT_SYNC_TIMEOUT_MS,
    });
  }, [beginEntityWait, game, heldRealmNumber, readSettlementSnapshot]);

  // Settlement is an authenticated, recorded action.
  const handleSettle = useCallback(
    async (chosenOrder: number | null = null) => {
      if (!isSeasonMode) {
        return;
      }
      if (!account) return;

      setSettlementError(null);
      setIsSettling(true);
      if (autoSettleEnabled && autoSettleEntryKey) {
        markSettling(autoSettleEntryKey, Date.now());
      }

      try {
        if (!worldMeta) {
          throw new Error("World configuration is still loading. Please wait a moment and try again.");
        }
        const signer = account as unknown as Account;

        const initialSnapshot = await readSettlementSnapshot();
        if (isEternumDevMode && !initialSnapshot) throw new Error("Settlement state is still loading.");
        if (initialSnapshot) {
          const initialStatus = syncSettlementStateFromSnapshot(initialSnapshot);
          if (initialStatus.canPlay && !isEternumDevMode) {
            if (choosingSource && !initialSnapshot.hasHomeSource) {
              await attachChosenSource();
            }
            setSourceLessHome(false);
            finalizeSuccessfulSettlement();
            return;
          }
        }

        const settlementTarget = isEternumDevMode ? (initialSnapshot?.settledCount ?? 0) + 1 : expectedSettlementCount;
        if (isEternumDevMode) setDevSettlementTarget(settlementTarget);
        if (isFrontierMode && initialSnapshot?.heldRealmId == null)
          await registerHomeSource(game, heldRealmNumber === "" ? null : Number(heldRealmNumber));
        setSettleStage("settling");
        await submitSettlement(navigationEntryContext, (client) =>
          client.setup.systemCalls.settle_season({
            signer,
            selectedRealm: isEternumDevMode ? Number(devRealmNumber) : undefined,
            order: chosenOrder ?? undefined,
          }),
        );
        // Known before the indexer answers: its first read can already open the game, which then enters this realm.
        createdRealmRef.current = isFrontierMode;

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
    },
    [
      autoSettleEnabled,
      autoSettleEntryKey,
      account,
      expectedSettlementCount,
      game,
      heldRealmNumber,
      choosingSource,
      attachChosenSource,
      isFrontierMode,
      finalizeFailedSettlement,
      finalizeSuccessfulSettlement,
      isSeasonMode,
      isEternumDevMode,
      devRealmNumber,
      markSettling,
      syncSettlementStateFromSnapshot,
      waitForSettlementTarget,
      worldMeta,
      readSettlementSnapshot,
      navigationEntryContext,
    ],
  );

  useEffect(() => {
    if (!isOpen || !autoSettleEnabled || !autoSettleEntryKey) return;

    autoSettleAttemptedRef.current = false;
    markOpening(autoSettleEntryKey, Date.now());
  }, [autoSettleEnabled, autoSettleEntryKey, isOpen, markOpening]);

  // A Frontier player with nothing to choose (a ticket or a free home, no Realm) has their realm created without a press;
  // an Eternum entry founds by itself when its link asks (autoSettle).
  const nothingToChoose = useNothingToChoose();
  const choosesAspect = isFrontierMode && worldMeta?.aspect_members != null;
  const foundsOnItsOwn =
    (isEternumMode && autoSettleEnabled) ||
    (isFrontierMode &&
      worldMeta !== null &&
      nothingToChoose &&
      !choosingSource &&
      registeredRealmId === null &&
      !choosesAspect);
  useEffect(() => {
    if (!foundsOnItsOwn || phase !== "settlement" || isSettling || autoSettleAttemptedRef.current) {
      return;
    }

    autoSettleAttemptedRef.current = true;
    void handleSettle();
  }, [foundsOnItsOwn, handleSettle, isSettling, phase]);
  // Auto-enter game when ready (spectate mode or already settled players)
  useEffect(() => {
    const shouldAutoEnter = isOpen && phase === "ready" && (entryIntent === "play" || settleStage === "done");
    if (shouldAutoEnter) {
      handleEnterGame();
    }
  }, [isOpen, phase, handleEnterGame, entryIntent, settleStage]);

  if (!isOpen) return null;

  // The Realm step asks: the homes to choose from, and Create your realm. It asks again after a failed creation, the
  // failure said over it, whether the player pressed or the realm was being created without a press.
  const choosingHome =
    phase === "settlement" &&
    isSeasonMode &&
    ((!foundsOnItsOwn && settleStage === "idle") || (isFrontierMode && settleStage === "error"));
  const foundedRealm = worldMeta ? seasonRealm(worldMeta)?.realm_id : undefined;
  const homeAspect =
    choosesAspect && foundedRealm !== undefined ? aspectOfOrder(canonicalRealm(foundedRealm).order) : null;
  const homeRealm = registeredRealmId ?? (heldRealmNumber !== "" && validHeldRealm ? Number(heldRealmNumber) : null);
  const realmOrder = homeRealm === null ? null : canonicalRealm(homeRealm).order;
  const tapsAspect = choosesAspect && !choosingSource && realmOrder === null;
  // A friend's Aspect invite for this game is offered first; identity's answer is read for the signed-in account only.
  const offered = joinedShare.status === "ready" ? aspectOffer(joinedShare.joined, game) : null;
  const keptOrder = keptIntent.intent.data?.order ?? null;
  const side = seasonSide(keptOrder, offered);
  const keptKnown = !choosesAspect || choosingSource || keptIntent.intent.isSuccess;
  const inviteKnown = !choosesAspect || choosingSource || joinedShare.status === "ready";
  const warnsOfSide =
    choosesAspect &&
    !choosingSource &&
    registeredRealmId === null &&
    sideAnswer === null &&
    isRealmElsewhere(side, realmOrder);
  const joinSideFree = (chosenAspect: AspectId | null) => {
    setSideAnswer("free");
    setHeldRealmNumber("");
    setHomeSettled(true);
    setAspect(chosenAspect);
    setOrder(null);
  };
  const pickOwnedRealm = () => {
    setSideAnswer("realm");
    setAspect(null);
    setOrder(null);
    setHomeSettled(false);
  };
  const foundInOrder = (chosen: number) => {
    setOrder(chosen);
    void handleSettle(chosen);
  };
  const view = doorwayView({
    source: "entry",
    phase,
    audience: isSpectateMode ? "spectator" : "player",
    signedIn: sessionStatus === "signed-in",
    accountError,
    foundingFailed: settleStage === "error" && !isFrontierMode,
    ended: seasonEnded,
  });

  const doorwayRealm =
    foundedRealm !== undefined
      ? doorwayRealmFromId(foundedRealm)
      : homeRealm !== null
        ? doorwayRealmFromId(homeRealm)
        : null;

  const foundButton =
    choosingHome && !tapsAspect && !warnsOfSide ? (
      <FoundButton
        upgrading={choosingSource}
        founding={isSettling}
        ready={
          (!isEternumDevMode || validDevRealmNumber) &&
          (!isFrontierMode || (validHeldRealm && homeSettled && keptKnown && inviteKnown))
        }
        onFound={() => void handleSettle()}
      />
    ) : undefined;
  const showsHomePicker = choosingHome && !warnsOfSide && isFrontierMode && worldMeta !== null && sideAnswer !== "free";
  const showsEntryModeSwitch =
    choosingHome &&
    !warnsOfSide &&
    choosesAspect &&
    !choosingSource &&
    registeredRealmId === null &&
    heldRealmsCount > 0;

  return (
    <DoorwayScreen
      view={view}
      realm={showsEntryModeSwitch ? null : doorwayRealm}
      game={worldMeta ?? undefined}
      onRetry={
        accountError
          ? () => pageNavigation.reload()
          : settleStage === "error"
            ? () => void handleSettle(order)
            : handleRetry
      }
      onSignIn={() => requestSignIn()}
      results={resultsHref(game)}
      asking={choosingHome}
      wide={choosingHome && !warnsOfSide && (choosesAspect || isFrontierMode) && !choosingSource}
      verb={showsHomePicker ? undefined : foundButton}
    >
      {choosingHome && warnsOfSide && side && homeRealm !== null && (
        <RealmSideWarning
          side={side}
          realmId={homeRealm}
          questBonusPercent={questBonusPercentOf(worldMeta)}
          onPlayRealm={() => setSideAnswer("realm")}
          onJoinFree={() => joinSideFree(sideAspect(side))}
        />
      )}
      {choosingHome && !warnsOfSide && (
        <>
          {showsEntryModeSwitch && (
            <EntryModeSwitch
              heldCount={heldRealmsCount}
              playingFree={sideAnswer === "free"}
              questBonusPercent={questBonusPercentOf(worldMeta)}
              disabled={isSettling}
              onChange={(mode) => {
                if (mode === "free") joinSideFree(null);
                else pickOwnedRealm();
              }}
            />
          )}
          {showsEntryModeSwitch && sideAnswer !== "free" && doorwayRealm && <RealmRising realm={doorwayRealm} />}
          {showsHomePicker && (
            <HomeSourcePicker
              title={choosingSource ? HOME_STEP_WORDS.attachTitle : undefined}
              takenRealmIds={takenRealmIds}
              requireSource={choosingSource}
              aspect={choosingSource ? homeAspect : null}
              questBonusPercent={questBonusPercentOf(worldMeta)}
              onSourceAvailable={setSourceAvailable}
              registered={registeredRealmId}
              value={heldRealmNumber}
              onChange={setHeldRealmNumber}
              onSettled={setHomeSettled}
              disabled={isSettling}
              action={foundButton}
            />
          )}
          {choosesAspect && !choosingSource && joinedShare.status === "failed" && (
            <HudNotice tone="warn" line={ASPECT_STEP_WORDS.inviteUnread} retry={joinedShare.retry} />
          )}
          {choosesAspect && !choosingSource && keptIntent.intent.isError && (
            <HudNotice tone="warn" line={ASPECT_STEP_WORDS.keptUnread} retry={() => void keptIntent.intent.refetch()} />
          )}
          {tapsAspect && (
            <AspectPicker
              members={worldMeta?.aspect_members ?? null}
              realmOrder={realmOrder}
              keptOrder={keptOrder}
              chosen={aspect}
              joining={isSettling ? order : null}
              waiting={!homeSettled || joinedShare.status === "loading" || !keptKnown}
              offered={offered}
              onChoose={setAspect}
              onFound={foundInOrder}
            />
          )}
          {choosingSource && <p>{HOME_STEP_WORDS.attachLine}</p>}
          {settlementError && <HudNotice tone="bad" line={settlementError} />}
          {isEternumDevMode && (
            <RealmNumberPicker value={devRealmNumber} onChange={setDevRealmNumber} disabled={isSettling} />
          )}
          {choosingSource && (
            <button
              type="button"
              className="home-picker__link"
              disabled={isSettling}
              onClick={() => setSourceLessHome(false)}
            >
              {HOME_STEP_WORDS.keepFree}
            </button>
          )}
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

/**
 * The Realm step's verb. Its two waits look different: while the home is founded it spins and says so, at full
 * strength; while the step has not settled on a home it is faint, and the step itself says what it waits for.
 */
export const FoundButton = ({
  founding,
  ready,
  onFound,
  upgrading = false,
}: {
  founding: boolean;
  ready: boolean;
  onFound: () => void;
  upgrading?: boolean;
}) => (
  <AppButton
    kind="primary"
    size="lg"
    icon="realm"
    step
    className="w-full"
    disabled={!ready}
    busy={founding ? (upgrading ? HOME_STEP_WORDS.attaching : HOME_STEP_WORDS.founding) : undefined}
    onClick={onFound}
  >
    {upgrading ? HOME_STEP_WORDS.attach : HOME_STEP_WORDS.found}
  </AppButton>
);
