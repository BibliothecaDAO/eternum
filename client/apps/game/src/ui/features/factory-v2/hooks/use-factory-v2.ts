import { useEffect, useMemo, useRef, useState } from "react";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactorySeries } from "@/hooks/use-factory-series";
import type { Chain } from "@contracts";
import { mapAndSortFactoryWorkerRuns, mapFactoryWorkerRun } from "../api/factory-run-mapper";
import {
  cancelFactoryRotationAutoRetry,
  cancelFactorySeriesAutoRetry,
  continueFactoryRun,
  continueFactoryRotationRun,
  continueFactorySeriesRun,
  createFactoryRun,
  createFactoryRotationRun,
  createFactorySeriesRun,
  FactoryWorkerApiError,
  fundFactoryGamePrize,
  fundFactorySeriesPrizes,
  isFactoryWorkerEnvironmentSupported,
  listFactoryRuns,
  nudgeFactoryRotationRun,
  readFactoryRunByNameIfPresent,
  readFactoryRunIfPresent,
  readFactoryRotationRunIfPresent,
  readFactorySeriesRunIfPresent,
  type FactoryWorkerEnvironmentId,
  type FactoryWorkerGameLaunchScope,
  type FactoryWorkerLaunchStepId,
  type FactoryWorkerRotationLaunchScope,
  type FactoryWorkerRunRecord,
  type FactoryWorkerSeriesLaunchScope,
} from "../api/factory-worker";
import {
  factoryModeDefinitions,
  getDefaultEnvironmentIdForMode,
  getDefaultPresetIdForModeSelection,
  getFactoryEnvironmentOptions,
  getFactoryLaunchPresetsForMode,
  getFactoryPresetById,
  getPresetStartAtValue,
} from "../catalog";
import { buildFactoryCreateRunRequest } from "../create-run-request";
import { buildFactoryCreateRotationRunRequest } from "../create-rotation-run-request";
import { buildFactoryCreateSeriesRunRequest } from "../create-series-run-request";
import { buildBlitzDurationOptions, supportsFactoryDuration } from "../duration";
import { buildFandomizedGameName } from "../funny-names";
import {
  readFactoryPendingLaunches,
  writeFactoryPendingLaunches,
  type FactoryPendingLaunch,
} from "../pending-launch-storage";
import {
  buildFactorySeriesGameDrafts,
  DEFAULT_FACTORY_SERIES_GAME_COUNT,
  resolveNextFactorySeriesGameNumber,
} from "../series-drafts";
import {
  buildFactoryRotationPreviewGames,
  DEFAULT_FACTORY_ROTATION_ADVANCE_WINDOW_GAMES,
  DEFAULT_FACTORY_ROTATION_GAME_INTERVAL_MINUTES,
  DEFAULT_FACTORY_ROTATION_MAX_GAMES,
} from "../rotation-drafts";
import { useFactoryV2MoreOptions } from "./use-factory-v2-map-options";
import { toggleSingleRealmLaunchMode, toggleTwoPlayerLaunchMode } from "../launch-modes";
import { getSimpleStepTitle, getStepStatusMessage, resolveRunPrimaryAction } from "../presenters";
import type {
  FactoryGameMode,
  FactoryLaunchPreset,
  FactoryLaunchTargetKind,
  FactoryPollingState,
  FactoryRotationEvaluationIntervalMinutes,
  FactoryRotationPreviewGame,
  FactoryRun,
  FactorySeriesGameDraft,
  FactorySeriesRetryIntervalMinutes,
  FactoryWatcherState,
} from "../types";

const RUN_LOOKUP_ATTEMPTS = 8;
const RUN_LOOKUP_DELAY_MS = 1_500;
const RUN_POLL_INTERVAL_MS = 5_000;
const PRIZE_FUNDING_LOOKUP_ATTEMPTS = 40;
const PRIZE_FUNDING_LOOKUP_DELAY_MS = 3_000;
const FIRST_UPDATE_WAIT_MESSAGE = "This game just started. We are waiting for it to appear.";
const AUTO_UPDATE_MESSAGE = "Updating automatically.";
const EXISTING_GAME_NOTICE = "That game already exists. We opened it for you.";
const DEFAULT_SERIES_RETRY_INTERVAL_MINUTES: FactorySeriesRetryIntervalMinutes = 15;

interface AcceptedRunState {
  environmentId: FactoryWorkerEnvironmentId;
  runId: string;
  stepId: FactoryWorkerLaunchStepId;
  latestEvent: string;
}

interface GuidedRecoveryState {
  runId: string;
  lastContinueActionKey: string | null;
}

type FactoryPrizeFundingEligibleRun = FactoryRun & {
  kind: "game" | "series";
};

interface FactoryPrizeFundingRequest {
  amount: string;
  adminSecret: string;
  selectedGameNames: string[];
}

export const useFactoryV2 = () => {
  const initialSelection = useInitialFactorySelection();
  const initialMode = initialSelection.mode;
  const initialPresetId = getDefaultPresetIdForModeSelection(initialMode);
  const initialPreset = getFactoryPresetById(initialPresetId);
  const initialStartAt = initialPreset ? getPresetStartAtValue(initialPreset) : "";
  const initialSuggestedGameName = buildSuggestedGameName(initialMode, []);
  const initialSuggestedSeriesName = buildSuggestedSeriesName(initialMode, []);
  const initialSuggestedRotationName = buildSuggestedRotationName(initialMode, []);
  const { account } = useAccountStore();
  const [selectedMode, setSelectedMode] = useState<FactoryGameMode>(initialMode);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(initialSelection.environmentId);
  const [selectedLaunchKind, setSelectedLaunchKind] = useState<FactoryLaunchTargetKind>(
    initialSelection.launchKind ?? "game",
  );
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);
  const [runsByEnvironment, setRunsByEnvironment] = useState<Record<string, FactoryRun[]>>({});
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [draftGameName, setDraftGameName] = useState(initialSuggestedGameName);
  const [draftSeriesName, setDraftSeriesName] = useState(initialSuggestedSeriesName);
  const [draftRotationName, setDraftRotationName] = useState(initialSuggestedRotationName);
  const [draftStartAt, setDraftStartAt] = useState(initialStartAt);
  const [draftDurationMinutes, setDraftDurationMinutes] = useState<number | null>(
    initialPreset?.defaults.durationMinutes ?? null,
  );
  const [draftSeriesGameCount, setDraftSeriesGameCount] = useState(DEFAULT_FACTORY_SERIES_GAME_COUNT);
  const [draftAutoRetryIntervalMinutes, setDraftAutoRetryIntervalMinutes] = useState<FactorySeriesRetryIntervalMinutes>(
    DEFAULT_SERIES_RETRY_INTERVAL_MINUTES,
  );
  const [draftRotationGameIntervalMinutes, setDraftRotationGameIntervalMinutes] = useState(
    DEFAULT_FACTORY_ROTATION_GAME_INTERVAL_MINUTES,
  );
  const [draftRotationMaxGames, setDraftRotationMaxGames] = useState(DEFAULT_FACTORY_ROTATION_MAX_GAMES);
  const [draftRotationAdvanceWindowGames, setDraftRotationAdvanceWindowGames] = useState(
    DEFAULT_FACTORY_ROTATION_ADVANCE_WINDOW_GAMES,
  );
  const [draftRotationEvaluationIntervalMinutes, setDraftRotationEvaluationIntervalMinutes] =
    useState<FactoryRotationEvaluationIntervalMinutes>(DEFAULT_SERIES_RETRY_INTERVAL_MINUTES);
  const [draftSeriesGames, setDraftSeriesGames] = useState<FactorySeriesGameDraft[]>(() =>
    buildFactorySeriesGameDrafts({
      count: DEFAULT_FACTORY_SERIES_GAME_COUNT,
      currentGames: [],
      seriesName: initialSuggestedSeriesName,
      sharedStartAt: initialStartAt,
      startingGameNumber: 1,
    }),
  );
  const [twoPlayerMode, setTwoPlayerMode] = useState(initialPreset?.defaults.twoPlayerMode ?? false);
  const [singleRealmMode, setSingleRealmMode] = useState(initialPreset?.defaults.singleRealmMode ?? false);
  const [watcher, setWatcher] = useState<FactoryWatcherState | null>(null);
  const [acceptedRunState, setAcceptedRunState] = useState<AcceptedRunState | null>(null);
  const [guidedRecoveryState, setGuidedRecoveryState] = useState<GuidedRecoveryState | null>(null);
  const [pendingLaunches, setPendingLaunches] = useState<FactoryPendingLaunch[]>(initialSelection.pendingLaunches);
  const [pollingState, setPollingState] = useState<FactoryPollingState>({
    status: "idle",
    detail: "Updates will show up here.",
    lastCheckedAt: null,
  });
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isResolvingRunName, setIsResolvingRunName] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const runsByEnvironmentRef = useRef<Record<string, FactoryRun[]>>({});
  const pendingLaunchesRef = useRef<FactoryPendingLaunch[]>(pendingLaunches);

  const modeDefinition = resolveModeDefinition(selectedMode);
  const environmentOptions = getFactoryEnvironmentOptions(selectedMode);
  const selectedEnvironment =
    environmentOptions.find((environment) => environment.id === selectedEnvironmentId) ?? environmentOptions[0] ?? null;
  const presets = getFactoryLaunchPresetsForMode(selectedMode);
  const ownedSeriesQuery = useFactorySeries((selectedEnvironment?.chain ?? "slot") as Chain, account?.address ?? null);
  const ownedSeries = ownedSeriesQuery.data ?? [];
  const seriesSuggestions = useMemo(
    () =>
      ownedSeries.map((series) => ({
        name: series.name,
        lastGameNumber: series.lastGameNumber === null ? null : Number(series.lastGameNumber),
        nextGameNumber: resolveNextFactorySeriesGameNumber(series.lastGameNumber),
      })),
    [ownedSeries],
  );
  const environmentRuns = runsByEnvironment[selectedEnvironment?.id ?? ""] ?? [];
  const visiblePendingRuns = buildVisiblePendingRuns({
    pendingLaunches,
    selectedEnvironmentId,
    watcher,
    pollingState,
  });
  const modeRuns = mergeAcceptedRunIntoEnvironment(
    mergePendingRunsIntoEnvironment(environmentRuns, visiblePendingRuns),
    acceptedRunState,
  );
  const selectedRun = modeRuns.find((run) => run.id === selectedRunId) ?? modeRuns[0] ?? null;
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0] ?? null;
  const matchingOwnedSeries = resolveMatchingOwnedSeries(ownedSeries, draftSeriesName);
  const nextSeriesGameNumber = resolveNextFactorySeriesGameNumber(matchingOwnedSeries?.lastGameNumber);
  const draftRotationPreviewGames = useMemo<FactoryRotationPreviewGame[]>(
    () =>
      buildFactoryRotationPreviewGames({
        rotationName: draftRotationName,
        firstStartAt: draftStartAt,
        gameIntervalMinutes: draftRotationGameIntervalMinutes,
        advanceWindowGames: draftRotationAdvanceWindowGames,
      }),
    [draftRotationAdvanceWindowGames, draftRotationGameIntervalMinutes, draftRotationName, draftStartAt],
  );
  const matchingRun =
    selectedLaunchKind === "series"
      ? resolveMatchingRunByName(modeRuns, draftSeriesName, "series")
      : selectedLaunchKind === "rotation"
        ? resolveMatchingRunByName(modeRuns, draftRotationName, "rotation")
        : resolveMatchingRunByName(modeRuns, draftGameName, "game");
  const showsDuration = supportsFactoryDuration(selectedMode);
  const durationOptions = showsDuration ? buildBlitzDurationOptions(presets, draftDurationMinutes) : [];
  const isWatcherBusy = watcher !== null;
  const pendingRunName = visiblePendingRuns[0]?.name ?? null;
  const activeRunName = selectedRun?.name ?? pendingRunName;
  const acceptedRunMessage =
    selectedRun && acceptedRunState?.runId === selectedRun.id ? acceptedRunState.latestEvent : null;
  const environmentUnavailableReason = resolveEnvironmentUnavailableReason(selectedEnvironment?.id);
  const moreOptions = useFactoryV2MoreOptions({
    mode: selectedMode,
    chain: selectedEnvironment?.chain ?? "slot",
    presetId: selectedPreset?.id ?? null,
    twoPlayerMode,
    durationMinutes: draftDurationMinutes,
  });

  useEffect(() => {
    runsByEnvironmentRef.current = runsByEnvironment;
  }, [runsByEnvironment]);

  useEffect(() => {
    pendingLaunchesRef.current = pendingLaunches;
  }, [pendingLaunches]);

  useEffect(() => {
    setDraftSeriesGames((currentGames) =>
      buildFactorySeriesGameDrafts({
        count: draftSeriesGameCount,
        currentGames,
        seriesName: draftSeriesName,
        sharedStartAt: draftStartAt,
        startingGameNumber: nextSeriesGameNumber,
      }),
    );
  }, [draftSeriesGameCount, draftSeriesName, draftStartAt, nextSeriesGameNumber]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = () => {
      const nextPendingLaunches = readFactoryPendingLaunches();
      pendingLaunchesRef.current = nextPendingLaunches;
      setPendingLaunches(nextPendingLaunches);
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!selectedEnvironment?.id) {
      return;
    }

    let isActive = true;

    const loadSelectedEnvironmentRuns = async () => {
      if (!isFactoryWorkerEnvironmentSupported(selectedEnvironment.id)) {
        if (isActive) {
          commitEnvironmentRuns(selectedEnvironment.id, []);
        }
        return;
      }

      setIsLoadingRuns(true);

      try {
        const listedRuns = await loadEnvironmentRuns(
          selectedEnvironment.id,
          runsByEnvironmentRef.current[selectedEnvironment.id] ?? [],
        );

        if (!isActive) {
          return;
        }

        const nextRuns = mergeListedRunsWithCurrentRuns(
          runsByEnvironmentRef.current[selectedEnvironment.id] ?? [],
          listedRuns,
        );

        commitEnvironmentRuns(selectedEnvironment.id, nextRuns);
        forgetPendingLaunchesThatExistAsRealRuns(selectedEnvironment.id, nextRuns);
      } catch (error) {
        if (isActive) {
          setNotice(resolveWorkerErrorMessage(error));
        }
      } finally {
        if (isActive) {
          setIsLoadingRuns(false);
        }
      }
    };

    void loadSelectedEnvironmentRuns();

    return () => {
      isActive = false;
    };
  }, [selectedEnvironment?.id]);

  useEffect(() => {
    if (presets.some((preset) => preset.id === selectedPresetId)) {
      return;
    }

    const nextPresetId = getDefaultPresetIdForModeSelection(selectedMode);
    const nextPreset = getFactoryPresetById(nextPresetId);

    setSelectedPresetId(nextPresetId);
    applyPresetDefaults(nextPreset);
  }, [presets, selectedMode, selectedPresetId]);

  useEffect(() => {
    if (selectedRunId && modeRuns.some((run) => run.id === selectedRunId)) {
      return;
    }

    setSelectedRunId(modeRuns[0]?.id ?? null);
  }, [modeRuns, selectedRunId]);

  useEffect(() => {
    const environmentId = assertSupportedEnvironment(selectedRun?.environment);

    if (!environmentId || !selectedRun || !isFactoryRunActive(selectedRun)) {
      if (!watcher) {
        setPollingState((currentState) => ({
          ...currentState,
          status: currentState.lastCheckedAt ? "live" : "idle",
          detail: currentState.lastCheckedAt ? "Up to date." : "Updates will show up here.",
        }));
      }
      return;
    }

    if (isPendingRun(selectedRun)) {
      if (!watcher) {
        setPollingState((currentState) => resolvePendingPollingState(currentState));
      }
      return;
    }

    let isActive = true;

    const pollSelectedRun = async () => {
      setPollingState((currentState) => ({
        status: currentState.lastCheckedAt ? "live" : "checking",
        detail: AUTO_UPDATE_MESSAGE,
        lastCheckedAt: currentState.lastCheckedAt,
      }));

      try {
        await refreshRunRecord(environmentId, selectedRun.kind, selectedRun.name);

        if (!isActive) {
          return;
        }

        setPollingState({
          status: "live",
          detail: AUTO_UPDATE_MESSAGE,
          lastCheckedAt: Date.now(),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setPollingState((currentState) => ({
          status: "paused",
          detail: resolvePollingPauseMessage(error),
          lastCheckedAt: currentState.lastCheckedAt,
        }));
      }
    };

    void pollSelectedRun();

    const intervalId = window.setInterval(() => {
      void pollSelectedRun();
    }, RUN_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [selectedRun?.environment, selectedRun?.id, selectedRun?.name, selectedRun?.status, watcher]);

  useEffect(() => {
    const environmentId = assertSupportedEnvironment(selectedRun?.environment);

    if (!environmentId || !selectedRun || !isPendingRun(selectedRun) || watcher) {
      return;
    }

    let isActive = true;

    const pollPendingRunRecord = async () => {
      setPollingState((currentState) => resolvePendingPollingState(currentState));

      try {
        const record = await readRunRecordIfPresent(environmentId, selectedRun.kind, selectedRun.name);

        if (!isActive) {
          return;
        }

        if (record) {
          selectFetchedRun(environmentId, record);
          setPollingState({
            status: "live",
            detail: AUTO_UPDATE_MESSAGE,
            lastCheckedAt: Date.now(),
          });
          return;
        }

        setPollingState((currentState) => resolvePendingPollingState(currentState, Date.now()));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setPollingState((currentState) => ({
          status: "paused",
          detail: resolvePollingPauseMessage(error),
          lastCheckedAt: currentState.lastCheckedAt,
        }));
      }
    };

    void pollPendingRunRecord();

    const intervalId = window.setInterval(() => {
      void pollPendingRunRecord();
    }, RUN_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [selectedRun?.environment, selectedRun?.id, selectedRun?.name, watcher]);

  useEffect(() => {
    const environmentId = assertSupportedEnvironment(selectedRun?.environment);

    if (
      !environmentId ||
      !selectedRun ||
      isWatcherBusy ||
      isPendingRun(selectedRun) ||
      selectedRun.status === "complete" ||
      Boolean(environmentUnavailableReason)
    ) {
      return;
    }

    if (guidedRecoveryState?.runId !== selectedRun.id) {
      return;
    }

    const primaryAction = resolveRunPrimaryAction(selectedRun);

    if (!primaryAction) {
      clearGuidedRecoveryState(selectedRun.id);
      return;
    }

    if (primaryAction.kind !== "continue") {
      return;
    }

    const continueActionKey = buildGuidedRecoveryActionKey(selectedRun, primaryAction.launchScope);

    if (guidedRecoveryState.lastContinueActionKey === continueActionKey) {
      return;
    }

    void runWatchedAction(
      {
        kind: "continue",
        runName: selectedRun.name,
        title: `Continuing ${selectedRun.name}`,
        detail: "Picking up where this game stopped.",
        workflowName: primaryAction.launchScope,
        statusLabel: "Working",
      },
      async () => {
        try {
          await continueRun(environmentId, selectedRun, primaryAction.launchScope);
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            selectedRun.name,
            selectedRun.kind,
            "This game is already moving again. We opened it for you.",
          );

          if (openedConflictingRun) {
            return;
          }

          throw error;
        }

        rememberGuidedRecoveryContinue(selectedRun.id, continueActionKey);
        acceptRunStepLocally(environmentId, selectedRun, primaryAction.stepId, "That part worked. Moving on now.");
      },
    );
  }, [
    environmentUnavailableReason,
    guidedRecoveryState,
    isWatcherBusy,
    selectedRun?.environment,
    selectedRun?.id,
    selectedRun?.status,
    selectedRun?.syncKey,
  ]);

  const selectMode = (mode: FactoryGameMode) => {
    const nextEnvironmentId = getDefaultEnvironmentIdForMode(mode);
    const nextPresetId = getDefaultPresetIdForModeSelection(mode);
    const nextPreset = getFactoryPresetById(nextPresetId);
    const nextRuns = runsByEnvironmentRef.current[nextEnvironmentId] ?? [];

    setSelectedMode(mode);
    setSelectedEnvironmentId(nextEnvironmentId);
    setSelectedPresetId(nextPresetId);
    setSelectedRunId(null);
    setDraftGameName(buildSuggestedGameName(mode, nextRuns));
    setDraftSeriesName(buildSuggestedSeriesName(mode, nextRuns));
    setDraftRotationName(buildSuggestedRotationName(mode, nextRuns));
    setDraftSeriesGameCount(DEFAULT_FACTORY_SERIES_GAME_COUNT);
    setDraftAutoRetryIntervalMinutes(DEFAULT_SERIES_RETRY_INTERVAL_MINUTES);
    setDraftRotationGameIntervalMinutes(DEFAULT_FACTORY_ROTATION_GAME_INTERVAL_MINUTES);
    setDraftRotationMaxGames(DEFAULT_FACTORY_ROTATION_MAX_GAMES);
    setDraftRotationAdvanceWindowGames(DEFAULT_FACTORY_ROTATION_ADVANCE_WINDOW_GAMES);
    setDraftRotationEvaluationIntervalMinutes(DEFAULT_SERIES_RETRY_INTERVAL_MINUTES);
    applyPresetDefaults(nextPreset);
    clearTransientState();
  };

  const selectEnvironment = (environmentId: string) => {
    setSelectedEnvironmentId(environmentId);
    setSelectedRunId(null);
    const nextRuns = runsByEnvironmentRef.current[environmentId] ?? [];
    setDraftGameName(buildSuggestedGameName(selectedMode, nextRuns));
    setDraftSeriesName(buildSuggestedSeriesName(selectedMode, nextRuns));
    setDraftRotationName(buildSuggestedRotationName(selectedMode, nextRuns));
    clearTransientState();
  };

  const selectLaunchKind = (nextLaunchKind: FactoryLaunchTargetKind) => {
    setSelectedLaunchKind(nextLaunchKind);
    setNotice(null);
  };

  const selectSeriesName = (seriesName: string) => {
    setDraftSeriesName(seriesName);
    setNotice(null);
  };

  const selectRotationName = (rotationName: string) => {
    setDraftRotationName(rotationName);
    setNotice(null);
  };

  const selectSeriesSuggestion = (seriesName: string) => {
    setDraftSeriesName(seriesName);
    setNotice(null);
  };

  const setSeriesGameCount = (count: number) => {
    setDraftSeriesGameCount(Math.max(1, Math.min(12, count)));
  };

  const setRotationMaxGames = (count: number) => {
    const normalizedMaxGames = Math.max(1, Math.min(50, Math.floor(count || 0)));
    setDraftRotationMaxGames(normalizedMaxGames);
    setDraftRotationAdvanceWindowGames((currentWindow) => Math.min(currentWindow, normalizedMaxGames, 5));
  };

  const setRotationAdvanceWindowGames = (count: number) => {
    setDraftRotationAdvanceWindowGames(Math.max(1, Math.min(5, Math.floor(count || 0), draftRotationMaxGames)));
  };

  const setRotationGameIntervalMinutes = (value: number) => {
    setDraftRotationGameIntervalMinutes(Math.max(1, Math.floor(value || 0)));
  };

  const setSeriesGameName = (gameId: string, gameName: string) => {
    setDraftSeriesGames((currentGames) =>
      currentGames.map((game) => (game.id === gameId ? { ...game, gameName } : game)),
    );
  };

  const setSeriesGameStartAt = (gameId: string, startAt: string) => {
    setDraftSeriesGames((currentGames) =>
      currentGames.map((game) => (game.id === gameId ? { ...game, startAt } : game)),
    );
  };

  const selectRun = (runId: string) => {
    setSelectedRunId(runId);
    setNotice(null);
  };

  const selectPreset = (presetId: string) => {
    const nextPreset = presets.find((preset) => preset.id === presetId);

    if (!nextPreset) {
      return;
    }

    setSelectedPresetId(presetId);
    applyPresetDefaults(nextPreset);
    setNotice(null);
  };

  const toggleTwoPlayerMode = () => {
    const nextModes = toggleTwoPlayerLaunchMode({ twoPlayerMode, singleRealmMode });
    applyLaunchModes(nextModes);
  };

  const toggleSingleRealmMode = () => {
    const nextModes = toggleSingleRealmLaunchMode({ twoPlayerMode, singleRealmMode });
    applyLaunchModes(nextModes);
  };

  const fandomizeGameName = () => {
    setDraftGameName(buildSuggestedGameName(selectedMode, modeRuns));
  };

  const launchSelectedPreset = async () => {
    if (selectedLaunchKind === "series") {
      return launchSelectedSeries();
    }

    if (selectedLaunchKind === "rotation") {
      return launchSelectedRotation();
    }

    return launchSelectedGame();
  };

  const launchSelectedGame = async () => {
    if (!selectedPreset || !selectedEnvironment?.id || isWatcherBusy) {
      return false;
    }

    const requestedGameName = draftGameName.trim();

    if (!requestedGameName) {
      return false;
    }

    if (matchingRun) {
      setSelectedRunId(matchingRun.id);
      setNotice(null);
      return true;
    }

    const environmentId = assertSupportedEnvironment(selectedEnvironment.id);
    if (!environmentId) {
      setNotice(resolveEnvironmentUnavailableReason(selectedEnvironment.id));
      return false;
    }

    beginPendingLaunch(environmentId, requestedGameName, "game");

    try {
      const existingRun = await openExistingRunIfPresent(environmentId, requestedGameName, "game");
      if (existingRun) {
        cancelPendingLaunch(environmentId, requestedGameName, "game");
        setNotice(EXISTING_GAME_NOTICE);
        return true;
      }
    } catch (error) {
      cancelPendingLaunch(environmentId, requestedGameName, "game");
      setNotice(resolveWorkerErrorMessage(error));
      return false;
    }

    const launched = await runWatchedAction(
      {
        kind: "launch",
        runName: requestedGameName,
        title: `Launching ${requestedGameName}`,
        detail: "Starting your game.",
        workflowName: "game-launch.yml",
        statusLabel: "Starting",
      },
      async () => {
        try {
          await createFactoryRun(buildCreateRunRequest(environmentId, requestedGameName));
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            requestedGameName,
            "game",
            "This game is already starting. We opened it for you.",
          );

          if (openedConflictingRun) {
            return;
          }

          throw error;
        }

        const nextRun = await waitForRunRecord(environmentId, requestedGameName, "game");
        if (nextRun) {
          selectFetchedRun(environmentId, nextRun);
        } else {
          await refreshEnvironmentRuns(environmentId);
          setNotice(FIRST_UPDATE_WAIT_MESSAGE);
        }
      },
    );

    if (!launched) {
      cancelPendingLaunch(environmentId, requestedGameName, "game");
    }

    return launched;
  };

  const launchSelectedSeries = async () => {
    if (!selectedPreset || !selectedEnvironment?.id || isWatcherBusy) {
      return false;
    }

    const requestedSeriesName = draftSeriesName.trim();
    const seriesGames = draftSeriesGames.filter((game) => game.gameName.trim().length > 0);

    if (!requestedSeriesName || seriesGames.length === 0 || seriesGames.length !== draftSeriesGames.length) {
      return false;
    }

    const environmentId = assertSupportedEnvironment(selectedEnvironment.id);
    if (!environmentId) {
      setNotice(resolveEnvironmentUnavailableReason(selectedEnvironment.id));
      return false;
    }

    beginPendingLaunch(environmentId, requestedSeriesName, "series");

    const launched = await runWatchedAction(
      {
        kind: "launch",
        runName: requestedSeriesName,
        title: `Launching ${requestedSeriesName}`,
        detail: "Starting this series.",
        workflowName: "series-launch",
        statusLabel: "Starting",
      },
      async () => {
        try {
          await createFactorySeriesRun(buildCreateSeriesRequest(environmentId, requestedSeriesName));
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            requestedSeriesName,
            "series",
            "This series is already starting. We opened it for you.",
          );

          if (openedConflictingRun) {
            return;
          }

          throw error;
        }

        const nextRun = await waitForRunRecord(environmentId, requestedSeriesName, "series");
        if (nextRun) {
          selectFetchedRun(environmentId, nextRun);
        } else {
          await refreshEnvironmentRuns(environmentId);
          setNotice(FIRST_UPDATE_WAIT_MESSAGE);
        }
      },
    );

    if (!launched) {
      cancelPendingLaunch(environmentId, requestedSeriesName, "series");
    }

    return launched;
  };

  const launchSelectedRotation = async () => {
    if (!selectedPreset || !selectedEnvironment?.id || isWatcherBusy) {
      return false;
    }

    const requestedRotationName = draftRotationName.trim();

    if (!requestedRotationName) {
      return false;
    }

    if (matchingRun) {
      setSelectedRunId(matchingRun.id);
      setNotice(null);
      return true;
    }

    const environmentId = assertSupportedEnvironment(selectedEnvironment.id);
    if (!environmentId) {
      setNotice(resolveEnvironmentUnavailableReason(selectedEnvironment.id));
      return false;
    }

    beginPendingLaunch(environmentId, requestedRotationName, "rotation");

    const launched = await runWatchedAction(
      {
        kind: "launch",
        runName: requestedRotationName,
        title: `Starting ${requestedRotationName}`,
        detail: "Starting this rotation.",
        workflowName: "rotation-launch",
        statusLabel: "Starting",
      },
      async () => {
        try {
          await createFactoryRotationRun(buildCreateRotationRequest(environmentId, requestedRotationName));
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            requestedRotationName,
            "rotation",
            "This rotation already exists. We opened it for you.",
          );

          if (openedConflictingRun) {
            return;
          }

          throw error;
        }

        const nextRun = await waitForRunRecord(environmentId, requestedRotationName, "rotation");
        if (nextRun) {
          selectFetchedRun(environmentId, nextRun);
        } else {
          await refreshEnvironmentRuns(environmentId);
          setNotice(FIRST_UPDATE_WAIT_MESSAGE);
        }
      },
    );

    if (!launched) {
      cancelPendingLaunch(environmentId, requestedRotationName, "rotation");
    }

    return launched;
  };

  const continueSelectedRun = async () => {
    if (!selectedRun || isWatcherBusy) {
      return;
    }

    const primaryAction = resolveRunPrimaryAction(selectedRun);
    const environmentId = assertSupportedEnvironment(selectedRun.environment);
    const stepId = primaryAction?.kind === "continue" ? primaryAction.stepId : null;

    if (!environmentId || primaryAction?.kind !== "continue" || !stepId) {
      return;
    }

    await runWatchedAction(
      {
        kind: "continue",
        runName: selectedRun.name,
        title: `Continuing ${selectedRun.name}`,
        detail: "Picking up where this game stopped.",
        workflowName: stepId,
        statusLabel: "Working",
      },
      async () => {
        try {
          await continueRun(environmentId, selectedRun, primaryAction.launchScope);
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            selectedRun.name,
            selectedRun.kind,
            "This game is already moving again. We opened it for you.",
          );

          if (openedConflictingRun) {
            return;
          }

          throw error;
        }
        armGuidedRecovery(selectedRun.id);
        acceptRunStepLocally(environmentId, selectedRun, stepId, "Got it. We are trying again now.");
      },
    );
  };

  const retrySelectedRun = async () => {
    if (!selectedRun || isWatcherBusy) {
      return;
    }

    const primaryAction = resolveRunPrimaryAction(selectedRun);
    const environmentId = assertSupportedEnvironment(selectedRun.environment);
    const stepId = primaryAction?.kind === "retry" ? primaryAction.stepId : null;

    if (!environmentId || primaryAction?.kind !== "retry" || !stepId) {
      return;
    }

    await runWatchedAction(
      {
        kind: "retry",
        runName: selectedRun.name,
        title: `Retrying ${selectedRun.name}`,
        detail:
          primaryAction.launchScope === "full" ? "Starting this game again from the top." : "Trying that part again.",
        workflowName: primaryAction.launchScope,
        statusLabel: "Retrying",
      },
      async () => {
        try {
          await continueRun(environmentId, selectedRun, primaryAction.launchScope);
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            selectedRun.name,
            selectedRun.kind,
            "This game is already moving again. We opened it for you.",
          );

          if (openedConflictingRun) {
            return;
          }

          throw error;
        }
        acceptRunStepLocally(
          environmentId,
          selectedRun,
          stepId,
          primaryAction.launchScope === "full"
            ? "Got it. Starting this game again from the top."
            : "Got it. We are trying that part again.",
        );
        armGuidedRecovery(selectedRun.id);
      },
    );
  };

  const bringIndexerLiveForSelectedRun = async () => {
    if (!selectedRun || isWatcherBusy) {
      return;
    }

    const environmentId = assertSupportedEnvironment(selectedRun.environment);
    const indexerStepId = resolveIndexerRecoveryStepId(selectedRun);

    if (!environmentId || !indexerStepId) {
      return;
    }

    await runWatchedAction(
      {
        kind: "reindex",
        runName: selectedRun.name,
        title: `Bringing ${selectedRun.name} online`,
        detail: "Starting the indexer again.",
        workflowName: indexerStepId,
        statusLabel: "Starting",
      },
      async () => {
        try {
          await continueRun(environmentId, selectedRun, indexerStepId);
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            selectedRun.name,
            selectedRun.kind,
            "This game is already being brought online again. We opened it for you.",
          );

          if (openedConflictingRun) {
            return;
          }

          throw error;
        }

        acceptRunStepLocally(environmentId, selectedRun, indexerStepId, "Got it. Bringing the indexer online again.");
      },
    );
  };

  const refreshSelectedRun = async () => {
    if (!selectedRun || isWatcherBusy) {
      return;
    }

    const environmentId = assertSupportedEnvironment(selectedRun.environment);

    if (!environmentId) {
      setNotice(resolveEnvironmentUnavailableReason(selectedRun.environment));
      return;
    }

    await runWatchedAction(
      {
        kind: "refresh",
        runName: selectedRun.name,
        title: `Checking ${selectedRun.name}`,
        detail: "Looking for the latest update.",
        workflowName: "factory-runs",
        statusLabel: "Checking",
      },
      async () => {
        await refreshRunRecord(environmentId, selectedRun.kind, selectedRun.name);
      },
    );
  };

  const nudgeSelectedRun = async () => {
    if (!selectedRun || selectedRun.kind !== "rotation" || isWatcherBusy) {
      return;
    }

    const environmentId = assertSupportedEnvironment(selectedRun.environment);

    if (!environmentId) {
      setNotice(resolveEnvironmentUnavailableReason(selectedRun.environment));
      return;
    }

    await runWatchedAction(
      {
        kind: "nudge",
        runName: selectedRun.name,
        title: `Checking ${selectedRun.name}`,
        detail: "Checking whether this rotation needs more games.",
        workflowName: "rotation-check",
        statusLabel: "Checking",
      },
      async () => {
        await nudgeFactoryRotationRun(environmentId, selectedRun.name);
        await refreshRunRecord(environmentId, "rotation", selectedRun.name);
      },
    );
  };

  const cancelSelectedRunAutoRetry = async () => {
    if (!selectedRun || isWatcherBusy || !canCancelRunAutoRetry(selectedRun)) {
      return;
    }

    if (selectedRun.kind !== "series" && selectedRun.kind !== "rotation") {
      return;
    }

    const environmentId = assertSupportedEnvironment(selectedRun.environment);

    if (!environmentId) {
      setNotice(resolveEnvironmentUnavailableReason(selectedRun.environment));
      return;
    }

    const adminSecret = requestFactoryAdminSecret(selectedRun.kind);

    if (!adminSecret) {
      return;
    }

    await runWatchedAction(
      {
        kind: "cancel_auto_retry",
        runName: selectedRun.name,
        title: `Stopping retries for ${selectedRun.name}`,
        detail: "Cancelling scheduled recovery attempts for this run.",
        workflowName: "cancel-auto-retry",
        statusLabel: "Stopping",
      },
      async () => {
        await cancelRunAutoRetry(environmentId, selectedRun, adminSecret);
        await refreshRunRecord(environmentId, selectedRun.kind, selectedRun.name);
      },
    );
  };

  const fundSelectedRunPrize = async ({ amount, adminSecret, selectedGameNames }: FactoryPrizeFundingRequest) => {
    if (!selectedRun || isWatcherBusy || !canFundRunPrize(selectedRun)) {
      return;
    }

    const environmentId = assertSupportedEnvironment(selectedRun.environment);

    if (!environmentId) {
      setNotice(resolveEnvironmentUnavailableReason(selectedRun.environment));
      return;
    }

    const normalizedAmount = amount.trim();
    const normalizedSecret = adminSecret.trim();
    const normalizedSelectedGameNames = resolveRequestedPrizeFundingGameNames(selectedRun, selectedGameNames);

    if (!normalizedAmount || !normalizedSecret) {
      return;
    }

    await runWatchedAction(
      {
        kind: "fund_prize",
        runName: selectedRun.name,
        title: `Funding ${selectedRun.name}`,
        detail:
          selectedRun.kind === "series"
            ? "Sending the selected prizes in one transaction."
            : "Sending the prize to this game.",
        workflowName: "factory-prize-funding.yml",
        statusLabel: "Funding",
      },
      async () => {
        await fundRunPrize(environmentId, selectedRun, {
          amount: normalizedAmount,
          adminSecret: normalizedSecret,
          selectedGameNames: normalizedSelectedGameNames,
        });

        const observedPrizeFunding = await waitForPrizeFundingLedgerUpdate(
          environmentId,
          selectedRun,
          normalizedSelectedGameNames,
        );

        if (observedPrizeFunding) {
          setNotice("Prize funding was recorded.");
          return;
        }

        setNotice("Prize funding started. Refresh this run in a moment to see the transfer.");
      },
    );
  };

  const resolveRunByName = async (requestedName: string) => {
    const environmentId = assertSupportedEnvironment(selectedEnvironment?.id);
    const trimmedName = requestedName.trim();

    if (!environmentId || !trimmedName) {
      return false;
    }

    setIsResolvingRunName(true);
    setNotice(null);

    try {
      const record = await readFactoryRunByNameIfPresent(environmentId, trimmedName);

      if (!record) {
        setNotice(`No game, series, or rotation named ${trimmedName} was found here yet.`);
        return false;
      }

      selectFetchedRun(environmentId, record);
      return true;
    } catch (error) {
      setNotice(resolveWorkerErrorMessage(error));
      return false;
    } finally {
      setIsResolvingRunName(false);
    }
  };

  return {
    selectedMode,
    modeDefinition,
    environmentOptions,
    selectedEnvironmentId,
    selectedEnvironment,
    selectedLaunchKind,
    presets,
    selectedPresetId,
    selectedPreset,
    draftGameName,
    draftSeriesName,
    draftRotationName,
    draftStartAt,
    draftDurationMinutes,
    draftSeriesGameCount,
    draftSeriesGames,
    draftRotationPreviewGames,
    draftRotationGameIntervalMinutes,
    draftRotationMaxGames,
    draftRotationAdvanceWindowGames,
    draftRotationEvaluationIntervalMinutes,
    draftAutoRetryIntervalMinutes,
    showsDuration,
    durationOptions,
    twoPlayerMode,
    singleRealmMode,
    seriesSuggestions,
    isLoadingSeries: ownedSeriesQuery.isLoading || ownedSeriesQuery.isFetching,
    seriesLookupError: ownedSeriesQuery.error?.message ?? null,
    matchingOwnedSeries,
    matchingRun,
    modeRuns,
    selectedRunId,
    selectedRun,
    watcher,
    pendingRunName,
    activeRunName,
    acceptedRunMessage,
    pollingState,
    isWatcherBusy,
    isLoadingRuns,
    isResolvingRunName,
    notice,
    environmentUnavailableReason,
    moreOptions,
    selectMode,
    selectEnvironment,
    selectLaunchKind,
    selectPreset,
    selectRun,
    setDraftGameName,
    setDraftSeriesName: selectSeriesName,
    setDraftRotationName: selectRotationName,
    setDraftStartAt,
    setDraftDurationMinutes,
    setDraftSeriesGameCount: setSeriesGameCount,
    setDraftAutoRetryIntervalMinutes,
    setDraftRotationGameIntervalMinutes: setRotationGameIntervalMinutes,
    setDraftRotationMaxGames: setRotationMaxGames,
    setDraftRotationAdvanceWindowGames: setRotationAdvanceWindowGames,
    setDraftRotationEvaluationIntervalMinutes,
    setSeriesGameName,
    setSeriesGameStartAt,
    selectSeriesSuggestion,
    toggleTwoPlayerMode,
    toggleSingleRealmMode,
    fandomizeGameName,
    launchSelectedPreset,
    continueSelectedRun,
    retrySelectedRun,
    nudgeSelectedRun,
    cancelSelectedRunAutoRetry,
    fundSelectedRunPrize,
    bringIndexerLiveForSelectedRun,
    refreshSelectedRun,
    resolveRunByName,
  };

  function applyPresetDefaults(preset: FactoryLaunchPreset | null) {
    setDraftStartAt(preset ? getPresetStartAtValue(preset) : "");
    setDraftDurationMinutes(preset?.defaults.durationMinutes ?? null);
    applyLaunchModes({
      twoPlayerMode: preset?.defaults.twoPlayerMode ?? false,
      singleRealmMode: preset?.defaults.singleRealmMode ?? false,
    });
  }

  function applyLaunchModes(nextModes: { twoPlayerMode: boolean; singleRealmMode: boolean }) {
    setTwoPlayerMode(nextModes.twoPlayerMode);
    setSingleRealmMode(nextModes.singleRealmMode);
  }

  function clearTransientState() {
    setNotice(null);
    setAcceptedRunState(null);
    setGuidedRecoveryState(null);
    setWatcher(null);
    setPollingState({
      status: "idle",
      detail: "Updates will show up here.",
      lastCheckedAt: null,
    });
  }

  function commitEnvironmentRuns(environmentId: string, nextRuns: FactoryRun[]) {
    const nextRunsByEnvironment = {
      ...runsByEnvironmentRef.current,
      [environmentId]: nextRuns,
    };

    runsByEnvironmentRef.current = nextRunsByEnvironment;
    setRunsByEnvironment(nextRunsByEnvironment);
  }

  function selectFetchedRun(environmentId: FactoryWorkerEnvironmentId, record: FactoryWorkerRunRecord) {
    const nextRun = mapFactoryWorkerRun(record);
    const nextRuns = replaceRunInEnvironment(runsByEnvironmentRef.current[environmentId] ?? [], nextRun);

    commitEnvironmentRuns(environmentId, nextRuns);
    setAcceptedRunState((currentState) =>
      currentState && currentState.runId === nextRun.id && hasObservedAcceptedStep(nextRun, currentState.stepId)
        ? null
        : currentState,
    );
    setSelectedRunId(nextRun.id);
    forgetPendingLaunch(environmentId, nextRun.kind, nextRun.name);
    setNotice(null);

    if (nextRun.status === "complete") {
      clearGuidedRecoveryState(nextRun.id);
    }
  }

  function acceptRunStepLocally(
    environmentId: FactoryWorkerEnvironmentId,
    run: FactoryRun,
    stepId: FactoryWorkerLaunchStepId,
    latestEvent: string,
  ) {
    const acceptedRun = buildAcceptedRun(run, stepId, latestEvent);
    const nextRuns = replaceRunInEnvironment(runsByEnvironmentRef.current[environmentId] ?? [], acceptedRun);

    commitEnvironmentRuns(environmentId, nextRuns);
    setAcceptedRunState({
      environmentId,
      runId: acceptedRun.id,
      stepId,
      latestEvent,
    });
    setSelectedRunId(acceptedRun.id);
    setPollingState({
      status: "checking",
      detail: latestEvent,
      lastCheckedAt: Date.now(),
    });
    setNotice(latestEvent);
  }

  function armGuidedRecovery(runId: string) {
    setGuidedRecoveryState({
      runId,
      lastContinueActionKey: null,
    });
  }

  function rememberGuidedRecoveryContinue(runId: string, actionKey: string) {
    setGuidedRecoveryState((currentState) =>
      currentState?.runId === runId
        ? {
            ...currentState,
            lastContinueActionKey: actionKey,
          }
        : currentState,
    );
  }

  function clearGuidedRecoveryState(runId?: string) {
    setGuidedRecoveryState((currentState) => {
      if (!currentState) {
        return null;
      }

      if (runId && currentState.runId !== runId) {
        return currentState;
      }

      return null;
    });
  }

  async function refreshEnvironmentRuns(environmentId: FactoryWorkerEnvironmentId) {
    const listedRuns = await loadEnvironmentRuns(environmentId, runsByEnvironmentRef.current[environmentId] ?? []);
    const nextRuns = mergeListedRunsWithCurrentRuns(runsByEnvironmentRef.current[environmentId] ?? [], listedRuns);
    commitEnvironmentRuns(environmentId, nextRuns);
    forgetPendingLaunchesThatExistAsRealRuns(environmentId, nextRuns);
    return nextRuns;
  }

  async function refreshRunRecord(
    environmentId: FactoryWorkerEnvironmentId,
    kind: FactoryLaunchTargetKind,
    runName: string,
  ) {
    const record = await readRunRecord(environmentId, kind, runName);
    selectFetchedRun(environmentId, record);
  }

  async function openExistingRunIfPresent(
    environmentId: FactoryWorkerEnvironmentId,
    runName: string,
    kind: FactoryLaunchTargetKind,
  ) {
    const record = await readRunRecordIfPresent(environmentId, kind, runName);

    if (!record) {
      return false;
    }

    selectFetchedRun(environmentId, record);
    return true;
  }

  async function openConflictingRunIfPresent(
    error: unknown,
    environmentId: FactoryWorkerEnvironmentId,
    runName: string,
    kind: FactoryLaunchTargetKind,
    conflictNotice: string,
  ) {
    if (!(error instanceof FactoryWorkerApiError) || error.status !== 409) {
      return false;
    }

    const record = await readRunRecordIfPresent(environmentId, kind, runName);

    if (!record) {
      const delayedRecord = await waitForRunRecord(environmentId, runName, kind);

      if (delayedRecord) {
        selectFetchedRun(environmentId, delayedRecord);
        setNotice(conflictNotice);
        return true;
      }

      setNotice(FIRST_UPDATE_WAIT_MESSAGE);
      return true;
    }

    selectFetchedRun(environmentId, record);
    setNotice(conflictNotice);
    return true;
  }

  async function waitForRunRecord(
    environmentId: FactoryWorkerEnvironmentId,
    runName: string,
    kind: FactoryLaunchTargetKind,
  ) {
    for (let attempt = 0; attempt < RUN_LOOKUP_ATTEMPTS; attempt += 1) {
      const record = await readRunRecordIfPresent(environmentId, kind, runName);

      if (record) {
        return record;
      }

      setPollingState({
        status: "checking",
        detail: FIRST_UPDATE_WAIT_MESSAGE,
        lastCheckedAt: Date.now(),
      });

      await delay(RUN_LOOKUP_DELAY_MS);
    }

    return null;
  }

  async function runWatchedAction(nextWatcher: FactoryWatcherState, action: () => Promise<void>) {
    setWatcher(nextWatcher);
    setNotice(null);

    try {
      await action();
      return true;
    } catch (error) {
      setNotice(resolveWorkerErrorMessage(error));
      setPollingState((currentState) => ({
        status: "paused",
        detail: resolvePollingPauseMessage(error),
        lastCheckedAt: currentState.lastCheckedAt,
      }));
      return false;
    } finally {
      setWatcher(null);
    }
  }

  async function continueRun(
    environmentId: FactoryWorkerEnvironmentId,
    run: FactoryRun,
    launchScope: "full" | FactoryWorkerLaunchStepId,
  ) {
    if (run.kind === "series") {
      await continueFactorySeriesRun({
        environment: environmentId,
        seriesName: run.name,
        launchStep: launchScope as FactoryWorkerSeriesLaunchScope,
      });
      return;
    }

    if (run.kind === "rotation") {
      await continueFactoryRotationRun({
        environment: environmentId,
        rotationName: run.name,
        launchStep: launchScope as FactoryWorkerRotationLaunchScope,
      });
      return;
    }

    await continueFactoryRun({
      environment: environmentId,
      gameName: run.name,
      launchStep: launchScope as FactoryWorkerGameLaunchScope,
    });
  }

  async function cancelRunAutoRetry(environmentId: FactoryWorkerEnvironmentId, run: FactoryRun, adminSecret: string) {
    if (run.kind === "series") {
      await cancelFactorySeriesAutoRetry({
        environment: environmentId,
        seriesName: run.name,
        adminSecret,
      });
      return;
    }

    if (run.kind !== "rotation") {
      return;
    }

    await cancelFactoryRotationAutoRetry({
      environment: environmentId,
      rotationName: run.name,
      adminSecret,
    });
  }

  async function fundRunPrize(
    environmentId: FactoryWorkerEnvironmentId,
    run: FactoryRun,
    request: FactoryPrizeFundingRequest,
  ) {
    if (run.kind === "series") {
      await fundFactorySeriesPrizes({
        environment: environmentId,
        seriesName: run.name,
        amount: request.amount,
        gameNames: request.selectedGameNames,
        adminSecret: request.adminSecret,
      });
      return;
    }

    await fundFactoryGamePrize({
      environment: environmentId,
      gameName: run.name,
      amount: request.amount,
      adminSecret: request.adminSecret,
    });
  }

  async function readRunRecord(
    environmentId: FactoryWorkerEnvironmentId,
    kind: FactoryLaunchTargetKind,
    runName: string,
  ): Promise<FactoryWorkerRunRecord> {
    const record = await readRunRecordIfPresent(environmentId, kind, runName);

    if (!record) {
      throw new FactoryWorkerApiError("Run not found.", 404);
    }

    return record;
  }

  async function readRunRecordIfPresent(
    environmentId: FactoryWorkerEnvironmentId,
    kind: FactoryLaunchTargetKind,
    runName: string,
  ): Promise<FactoryWorkerRunRecord | null> {
    if (kind === "series") {
      return readFactorySeriesRunIfPresent(environmentId, runName);
    }

    if (kind === "rotation") {
      return readFactoryRotationRunIfPresent(environmentId, runName);
    }

    return readFactoryRunIfPresent(environmentId, runName);
  }

  async function waitForPrizeFundingLedgerUpdate(
    environmentId: FactoryWorkerEnvironmentId,
    run: FactoryPrizeFundingEligibleRun,
    selectedGameNames: string[],
  ) {
    const initialSnapshot = capturePrizeFundingSnapshot(run, selectedGameNames);

    for (let attempt = 0; attempt < PRIZE_FUNDING_LOOKUP_ATTEMPTS; attempt += 1) {
      const record = await readRunRecordIfPresent(environmentId, run.kind, run.name);

      if (record) {
        const nextRun = mapFactoryWorkerRun(record);
        selectFetchedRun(environmentId, record);

        if (hasObservedPrizeFundingUpdate(nextRun, initialSnapshot)) {
          return true;
        }
      }

      await delay(PRIZE_FUNDING_LOOKUP_DELAY_MS);
    }

    return false;
  }

  function buildCreateRunRequest(environmentId: FactoryWorkerEnvironmentId, gameName: string) {
    return buildFactoryCreateRunRequest({
      environmentId,
      gameName,
      gameStartTime: resolveStartTimeValue(draftStartAt),
      selectedMode,
      selectedPreset,
      twoPlayerMode,
      singleRealmMode,
      durationMinutes: draftDurationMinutes,
      showsDuration,
      mapConfigOverrides: moreOptions.mapConfigOverrides,
      blitzRegistrationOverrides: moreOptions.blitzRegistrationOverrides,
    });
  }

  function buildCreateSeriesRequest(environmentId: FactoryWorkerEnvironmentId, seriesName: string) {
    return buildFactoryCreateSeriesRunRequest({
      environmentId,
      seriesName,
      games: draftSeriesGames,
      selectedMode,
      selectedPreset,
      twoPlayerMode,
      singleRealmMode,
      durationMinutes: draftDurationMinutes,
      showsDuration,
      mapConfigOverrides: moreOptions.mapConfigOverrides,
      blitzRegistrationOverrides: moreOptions.blitzRegistrationOverrides,
      autoRetryIntervalMinutes: draftAutoRetryIntervalMinutes,
      resolveStartTime: resolveStartTimeValue,
    });
  }

  function buildCreateRotationRequest(environmentId: FactoryWorkerEnvironmentId, rotationName: string) {
    return buildFactoryCreateRotationRunRequest({
      environmentId,
      rotationName,
      firstGameStartTime: draftStartAt,
      gameIntervalMinutes: draftRotationGameIntervalMinutes,
      maxGames: draftRotationMaxGames,
      advanceWindowGames: draftRotationAdvanceWindowGames,
      evaluationIntervalMinutes: draftRotationEvaluationIntervalMinutes,
      selectedMode,
      selectedPreset,
      twoPlayerMode,
      singleRealmMode,
      durationMinutes: draftDurationMinutes,
      showsDuration,
      mapConfigOverrides: moreOptions.mapConfigOverrides,
      blitzRegistrationOverrides: moreOptions.blitzRegistrationOverrides,
      autoRetryIntervalMinutes: draftAutoRetryIntervalMinutes,
      resolveStartTime: resolveStartTimeValue,
    });
  }

  function commitPendingLaunches(nextPendingLaunches: FactoryPendingLaunch[]) {
    pendingLaunchesRef.current = nextPendingLaunches;
    setPendingLaunches(nextPendingLaunches);
    writeFactoryPendingLaunches(nextPendingLaunches);
  }

  function beginPendingLaunch(environmentId: FactoryWorkerEnvironmentId, name: string, kind: FactoryLaunchTargetKind) {
    rememberPendingLaunch({
      environmentId,
      name,
      mode: selectedMode,
      kind,
      createdAt: new Date().toISOString(),
    });
    setSelectedRunId(buildPendingRunId(environmentId, kind, name));
    setPollingState({
      status: "checking",
      detail: FIRST_UPDATE_WAIT_MESSAGE,
      lastCheckedAt: Date.now(),
    });
  }

  function cancelPendingLaunch(environmentId: FactoryWorkerEnvironmentId, name: string, kind: FactoryLaunchTargetKind) {
    forgetPendingLaunch(environmentId, kind, name);
    setSelectedRunId((currentRunId) =>
      currentRunId === buildPendingRunId(environmentId, kind, name) ? null : currentRunId,
    );
  }

  function updatePendingLaunches(
    updateLaunches: (currentPendingLaunches: FactoryPendingLaunch[]) => FactoryPendingLaunch[],
  ) {
    const nextPendingLaunches = updateLaunches(pendingLaunchesRef.current);

    if (arePendingLaunchesEqual(nextPendingLaunches, pendingLaunchesRef.current)) {
      return;
    }

    commitPendingLaunches(nextPendingLaunches);
  }

  function rememberPendingLaunch(nextPendingLaunch: FactoryPendingLaunch) {
    updatePendingLaunches((currentPendingLaunches) => upsertPendingLaunch(currentPendingLaunches, nextPendingLaunch));
  }

  function forgetPendingLaunch(environmentId: string, kind: FactoryLaunchTargetKind, name: string) {
    updatePendingLaunches((currentPendingLaunches) =>
      currentPendingLaunches.filter((pendingLaunch) => !matchesPendingLaunch(pendingLaunch, environmentId, kind, name)),
    );
  }

  function forgetPendingLaunchesThatExistAsRealRuns(environmentId: string, runs: FactoryRun[]) {
    updatePendingLaunches((currentPendingLaunches) =>
      currentPendingLaunches.filter(
        (pendingLaunch) =>
          pendingLaunch.environmentId !== environmentId ||
          !runs.some(
            (run) =>
              normalizePendingLaunchKey(environmentId, run.kind, run.name) === buildPendingLaunchKey(pendingLaunch),
          ),
      ),
    );
  }
};

async function loadEnvironmentRuns(environmentId: FactoryWorkerEnvironmentId, fallbackRuns: FactoryRun[]) {
  const records = await listFactoryRuns(environmentId);

  if (records === null) {
    return fallbackRuns;
  }

  return mapAndSortFactoryWorkerRuns(records);
}

function resolveModeDefinition(mode: FactoryGameMode) {
  return factoryModeDefinitions.find((definition) => definition.id === mode) ?? factoryModeDefinitions[0];
}

interface InitialFactorySelection {
  mode: FactoryGameMode;
  environmentId: string;
  launchKind: FactoryLaunchTargetKind | null;
  pendingLaunches: FactoryPendingLaunch[];
}

function useInitialFactorySelection(): InitialFactorySelection {
  const initialSelectionRef = useRef<InitialFactorySelection | null>(null);

  if (initialSelectionRef.current === null) {
    initialSelectionRef.current = resolveInitialFactorySelection();
  }

  return initialSelectionRef.current;
}

function resolveInitialFactorySelection(): InitialFactorySelection {
  const pendingLaunches = readFactoryPendingLaunches();
  const latestPendingLaunch = resolveLatestPendingLaunch(pendingLaunches);
  const mode = latestPendingLaunch?.mode ?? "blitz";

  return {
    mode,
    environmentId: latestPendingLaunch?.environmentId ?? getDefaultEnvironmentIdForMode(mode),
    launchKind: latestPendingLaunch?.kind ?? null,
    pendingLaunches,
  };
}

function resolveLatestPendingLaunch(pendingLaunches: FactoryPendingLaunch[]) {
  return pendingLaunches.reduce<FactoryPendingLaunch | null>((latestPendingLaunch, pendingLaunch) => {
    if (latestPendingLaunch === null) {
      return pendingLaunch;
    }

    return pendingLaunch.createdAt > latestPendingLaunch.createdAt ? pendingLaunch : latestPendingLaunch;
  }, null);
}

function resolveIndexerRecoveryStepId(run: FactoryRun) {
  if (run.steps.some((step) => step.id === "create-indexers")) {
    return "create-indexers";
  }

  return run.steps.some((step) => step.id === "create-indexer" || step.id === "wait-indexer") ? "create-indexer" : null;
}

function buildSuggestedGameName(mode: FactoryGameMode, runs: FactoryRun[]) {
  return buildFandomizedGameName(mode, runs.filter((run) => run.kind === "game").length + 1);
}

function buildSuggestedSeriesName(mode: FactoryGameMode, runs: FactoryRun[]) {
  return buildFandomizedGameName(mode, runs.filter((run) => run.kind === "series").length + 1);
}

function buildSuggestedRotationName(mode: FactoryGameMode, runs: FactoryRun[]) {
  return buildFandomizedGameName(mode, runs.filter((run) => run.kind === "rotation").length + 1);
}

function buildPendingRunId(environmentId: string, kind: FactoryLaunchTargetKind, name: string) {
  return `pending:${kind}:${environmentId}:${name}`;
}

function buildGuidedRecoveryActionKey(run: FactoryRun, launchScope: string) {
  return `${run.id}|${run.syncKey}|${launchScope}`;
}

function isPendingRun(run: FactoryRun) {
  return run.id.startsWith("pending:");
}

function buildVisiblePendingRuns({
  pendingLaunches,
  selectedEnvironmentId,
  watcher,
  pollingState,
}: {
  pendingLaunches: FactoryPendingLaunch[];
  selectedEnvironmentId: string | null;
  watcher: FactoryWatcherState | null;
  pollingState: FactoryPollingState;
}) {
  return pendingLaunches
    .filter((pendingLaunch) => pendingLaunch.environmentId === selectedEnvironmentId)
    .map((pendingLaunch) => buildPendingRun(pendingLaunch, watcher, pollingState));
}

function buildPendingRun(
  pendingLaunch: FactoryPendingLaunch,
  watcher: FactoryWatcherState | null,
  pollingState: FactoryPollingState,
): FactoryRun {
  return {
    id: buildPendingRunId(pendingLaunch.environmentId, pendingLaunch.kind, pendingLaunch.name),
    syncKey: `pending:${pendingLaunch.kind}:${pendingLaunch.environmentId}:${pendingLaunch.name}`,
    kind: pendingLaunch.kind,
    mode: pendingLaunch.mode,
    name: pendingLaunch.name,
    environment: pendingLaunch.environmentId,
    owner: "Factory",
    presetId: "pending",
    status: "running",
    summary: resolvePendingRunSummary(pendingLaunch, watcher, pollingState),
    updatedAt: "Starting now",
    steps: buildPendingRunSteps(pendingLaunch.mode, pendingLaunch.environmentId, pendingLaunch.kind),
  };
}

function shouldIncludePendingVillagePassRoleStep(mode: FactoryGameMode): boolean {
  return mode === "eternum";
}

function shouldIncludePendingBanksStep(mode: FactoryGameMode): boolean {
  return mode === "eternum";
}

function shouldIncludePendingPaymasterStep(environmentId: string): boolean {
  return environmentId.startsWith("mainnet.");
}

function buildPendingRoleGrantSteps(mode: FactoryGameMode): FactoryRun["steps"] {
  const steps = [createPendingStep("grant-lootchest-role", "pending")];

  if (shouldIncludePendingVillagePassRoleStep(mode)) {
    steps.push(createPendingStep("grant-village-pass-role", "pending"));
  }

  return steps;
}

function buildPendingBankSteps(mode: FactoryGameMode): FactoryRun["steps"] {
  if (!shouldIncludePendingBanksStep(mode)) {
    return [];
  }

  return [createPendingStep("create-banks", "pending")];
}

function buildPendingPaymasterSteps(environmentId: string): FactoryRun["steps"] {
  if (!shouldIncludePendingPaymasterStep(environmentId)) {
    return [];
  }

  return [createPendingStep("sync-paymaster", "pending")];
}

function buildPendingGameRunSteps(mode: FactoryGameMode, environmentId: string): FactoryRun["steps"] {
  return [
    createPendingStep("launch-request", "running"),
    createPendingStep("create-world", "pending"),
    createPendingStep("wait-for-factory-index", "pending"),
    createPendingStep("configure-world", "pending"),
    ...buildPendingRoleGrantSteps(mode),
    ...buildPendingBankSteps(mode),
    createPendingStep("create-indexer", "pending"),
    ...buildPendingPaymasterSteps(environmentId),
  ];
}

function buildPendingSeriesRunSteps(mode: FactoryGameMode, environmentId: string): FactoryRun["steps"] {
  return [
    createPendingStep("launch-request", "running"),
    createPendingStep("create-series", "pending"),
    createPendingStep("create-worlds", "pending"),
    createPendingStep("wait-for-factory-indexes", "pending"),
    createPendingStep("configure-worlds", "pending"),
    createPendingStep("grant-lootchest-roles", "pending"),
    ...(mode === "eternum" ? [createPendingStep("grant-village-pass-roles", "pending")] : []),
    ...(mode === "eternum" ? [createPendingStep("create-banks", "pending")] : []),
    createPendingStep("create-indexers", "pending"),
    ...buildPendingPaymasterSteps(environmentId),
  ];
}

function buildPendingRunSteps(
  mode: FactoryGameMode,
  environmentId: string,
  kind: FactoryLaunchTargetKind,
): FactoryRun["steps"] {
  return kind === "series" || kind === "rotation"
    ? buildPendingSeriesRunSteps(mode, environmentId)
    : buildPendingGameRunSteps(mode, environmentId);
}

function createPendingStep(
  id: FactoryRun["steps"][number]["id"],
  status: FactoryRun["steps"][number]["status"],
): FactoryRun["steps"][number] {
  const title = getSimpleStepTitle({ id, title: id });
  const latestEvent = getStepStatusMessage(id, status) ?? "Waiting to start.";

  return {
    id,
    title,
    summary: latestEvent,
    workflowName: id,
    status,
    verification: latestEvent,
    latestEvent,
  };
}

function mergePendingRunsIntoEnvironment(runs: FactoryRun[], pendingRuns: FactoryRun[]) {
  if (pendingRuns.length === 0) {
    return runs;
  }

  const pendingRunKeys = new Set(
    pendingRuns.map((pendingRun) =>
      normalizePendingLaunchKey(pendingRun.environment, pendingRun.kind, pendingRun.name),
    ),
  );

  return [
    ...pendingRuns,
    ...runs.filter((run) => !pendingRunKeys.has(normalizePendingLaunchKey(run.environment, run.kind, run.name))),
  ];
}

function mergeAcceptedRunIntoEnvironment(runs: FactoryRun[], acceptedRunState: AcceptedRunState | null) {
  if (!acceptedRunState) {
    return runs;
  }

  return runs.map((run) =>
    run.id === acceptedRunState.runId
      ? buildAcceptedRun(run, acceptedRunState.stepId, acceptedRunState.latestEvent)
      : run,
  );
}

function replaceRunInEnvironment(runs: FactoryRun[], nextRun: FactoryRun) {
  const remainingRuns = runs.filter(
    (run) => run.id !== nextRun.id && (run.kind !== nextRun.kind || run.name !== nextRun.name),
  );
  return [nextRun, ...remainingRuns];
}

function mergeListedRunsWithCurrentRuns(currentRuns: FactoryRun[], listedRuns: FactoryRun[]) {
  if (currentRuns.length === 0 || listedRuns.length === 0) {
    return listedRuns.length === 0 ? currentRuns : listedRuns;
  }

  const listedRunKeys = new Set(
    listedRuns.map((run) => normalizePendingLaunchKey(run.environment, run.kind, run.name)),
  );
  // Preserve targeted run fetches until the broader environment list catches up.
  const missingCurrentRuns = currentRuns.filter(
    (run) => !listedRunKeys.has(normalizePendingLaunchKey(run.environment, run.kind, run.name)),
  );

  return [...missingCurrentRuns, ...listedRuns];
}

function resolvePendingRunSummary(
  pendingLaunch: FactoryPendingLaunch,
  watcher: FactoryWatcherState | null,
  pollingState: FactoryPollingState,
) {
  if (watcher?.runName === pendingLaunch.name) {
    return watcher.detail;
  }

  return pollingState.status === "paused" ? pollingState.detail : FIRST_UPDATE_WAIT_MESSAGE;
}

function upsertPendingLaunch(currentPendingLaunches: FactoryPendingLaunch[], nextPendingLaunch: FactoryPendingLaunch) {
  return [
    nextPendingLaunch,
    ...currentPendingLaunches.filter(
      (pendingLaunch) => buildPendingLaunchKey(pendingLaunch) !== buildPendingLaunchKey(nextPendingLaunch),
    ),
  ];
}

function matchesPendingLaunch(
  pendingLaunch: FactoryPendingLaunch,
  environmentId: string,
  kind: FactoryLaunchTargetKind,
  name: string,
) {
  return buildPendingLaunchKey(pendingLaunch) === normalizePendingLaunchKey(environmentId, kind, name);
}

function buildPendingLaunchKey(pendingLaunch: FactoryPendingLaunch) {
  return normalizePendingLaunchKey(pendingLaunch.environmentId, pendingLaunch.kind, pendingLaunch.name);
}

function normalizePendingLaunchKey(environmentId: string, kind: FactoryLaunchTargetKind, name: string) {
  return `${kind}:${environmentId}:${name.trim().toLowerCase()}`;
}

function arePendingLaunchesEqual(left: FactoryPendingLaunch[], right: FactoryPendingLaunch[]) {
  return (
    left.length === right.length &&
    left.every(
      (pendingLaunch, index) =>
        pendingLaunch.environmentId === right[index]?.environmentId &&
        pendingLaunch.name === right[index]?.name &&
        pendingLaunch.mode === right[index]?.mode &&
        pendingLaunch.kind === right[index]?.kind &&
        pendingLaunch.createdAt === right[index]?.createdAt,
    )
  );
}

function resolveMatchingRunByName(runs: FactoryRun[], requestedName: string, kind?: FactoryLaunchTargetKind) {
  const normalizedName = requestedName.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return runs.find((run) => (!kind || run.kind === kind) && run.name.trim().toLowerCase() === normalizedName) ?? null;
}

function resolveMatchingOwnedSeries<
  SeriesRecord extends {
    name: string;
    lastGameNumber: bigint | null;
  },
>(ownedSeries: SeriesRecord[], seriesName: string) {
  const normalizedName = seriesName.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return ownedSeries.find((series) => series.name.trim().toLowerCase() === normalizedName) ?? null;
}

function buildAcceptedRun(run: FactoryRun, stepId: FactoryWorkerLaunchStepId, latestEvent: string): FactoryRun {
  return {
    ...run,
    status: "running",
    updatedAt: "Just now",
    summary: latestEvent,
    steps: run.steps.map((step) => {
      if (step.id !== stepId) {
        return step;
      }

      return {
        ...step,
        status: "running",
        latestEvent,
        summary: latestEvent,
        verification: latestEvent,
      };
    }),
  };
}

function hasObservedAcceptedStep(run: FactoryRun, stepId: FactoryWorkerLaunchStepId) {
  const step = run.steps.find((candidate) => candidate.id === stepId);

  return step?.status === "running" || step?.status === "succeeded" || step?.status === "already_done";
}

function isFactoryRunActive(run: FactoryRun) {
  return run.status !== "complete";
}

function resolvePendingPollingState(
  currentState: FactoryPollingState,
  nextCheckedAt = currentState.lastCheckedAt ?? Date.now(),
): FactoryPollingState {
  if (currentState.status === "paused") {
    return currentState;
  }

  return {
    status: "checking",
    detail: FIRST_UPDATE_WAIT_MESSAGE,
    lastCheckedAt: nextCheckedAt,
  };
}

function resolveStartTimeValue(startAt: string) {
  const date = new Date(startAt);
  return Number.isNaN(date.getTime()) ? startAt : date.toISOString();
}

function resolveEnvironmentUnavailableReason(environmentId?: string | null) {
  if (!environmentId || isFactoryWorkerEnvironmentSupported(environmentId)) {
    return null;
  }

  return "This network is not ready here yet.";
}

function requestFactoryAdminSecret(runKind: Extract<FactoryRun["kind"], "series" | "rotation">) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.prompt(`Enter the factory admin secret to stop auto-retry for this ${runKind}.`)?.trim() || null;
}

function canCancelRunAutoRetry(run: FactoryRun) {
  return (run.kind === "series" || run.kind === "rotation") && run.autoRetry?.enabled && !run.autoRetry.cancelledAt;
}

function canFundRunPrize(run: FactoryRun): run is FactoryPrizeFundingEligibleRun {
  return run.mode === "blitz" && run.status === "complete" && (run.kind === "game" || run.kind === "series");
}

function resolveRequestedPrizeFundingGameNames(run: FactoryPrizeFundingEligibleRun, selectedGameNames: string[]) {
  if (run.kind !== "series") {
    return [];
  }

  const normalizedSelectedGameNames = selectedGameNames.map((gameName) => gameName.trim()).filter(Boolean);

  if (normalizedSelectedGameNames.length > 0) {
    return normalizedSelectedGameNames;
  }

  return (run.children ?? [])
    .filter((child) => child.status === "succeeded" && (child.prizeFunding?.transfers.length ?? 0) === 0)
    .map((child) => child.gameName);
}

type FactoryPrizeFundingSnapshot =
  | {
      kind: "game";
      transferCount: number;
    }
  | {
      kind: "series";
      selectedGameNames: string[];
      transferCountsByGameName: Record<string, number>;
    };

function capturePrizeFundingSnapshot(
  run: FactoryPrizeFundingEligibleRun,
  selectedGameNames: string[],
): FactoryPrizeFundingSnapshot {
  if (run.kind === "game") {
    return {
      kind: "game",
      transferCount: run.prizeFunding?.transfers.length ?? 0,
    };
  }

  return {
    kind: "series",
    selectedGameNames,
    transferCountsByGameName: Object.fromEntries(
      selectedGameNames.map((gameName) => [
        gameName,
        run.children?.find((child) => child.gameName === gameName)?.prizeFunding?.transfers.length ?? 0,
      ]),
    ),
  };
}

function hasObservedPrizeFundingUpdate(run: FactoryRun, snapshot: FactoryPrizeFundingSnapshot) {
  if (snapshot.kind === "game") {
    return (run.prizeFunding?.transfers.length ?? 0) > snapshot.transferCount;
  }

  return snapshot.selectedGameNames.every((gameName) => {
    const nextTransferCount =
      run.children?.find((child) => child.gameName === gameName)?.prizeFunding?.transfers.length ?? 0;
    return nextTransferCount > (snapshot.transferCountsByGameName[gameName] ?? 0);
  });
}

function assertSupportedEnvironment(environmentId?: string | null) {
  if (!environmentId || !isFactoryWorkerEnvironmentSupported(environmentId)) {
    return null;
  }

  return environmentId;
}

function resolveWorkerErrorMessage(error: unknown) {
  if (error instanceof FactoryWorkerApiError) {
    if (error.status === 404) {
      return "We could not find that game yet.";
    }

    if (error.status === 409) {
      return "This game is already being worked on.";
    }

    if (error.status >= 500) {
      return "Something went wrong while checking this game. We kept your place here.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message || "We could not reach the game launcher.";
  }

  return "We could not reach the game launcher.";
}

function resolvePollingPauseMessage(error: unknown) {
  if (error instanceof FactoryWorkerApiError && error.status === 404) {
    return FIRST_UPDATE_WAIT_MESSAGE;
  }

  if (error instanceof FactoryWorkerApiError && error.status === 409) {
    return "This game is already moving in another window. We kept it open here.";
  }

  return "Updates paused for a moment. We will keep trying.";
}

function delay(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
