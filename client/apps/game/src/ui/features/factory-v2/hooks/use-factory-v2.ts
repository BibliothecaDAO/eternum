import { useEffect, useRef, useState } from "react";
import { mapAndSortFactoryWorkerRuns, mapFactoryWorkerRun } from "../api/factory-run-mapper";
import {
  continueFactoryRun,
  createFactoryRun,
  FactoryWorkerApiError,
  isFactoryWorkerEnvironmentSupported,
  listFactoryRuns,
  readFactoryRun,
  readFactoryRunIfPresent,
  type FactoryWorkerEnvironmentId,
  type FactoryWorkerLaunchStepId,
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
import { buildBlitzDurationOptions, supportsFactoryDuration } from "../duration";
import { buildFandomizedGameName } from "../funny-names";
import {
  readFactoryPendingLaunches,
  writeFactoryPendingLaunches,
  type FactoryPendingLaunch,
} from "../pending-launch-storage";
import { useFactoryV2MoreOptions } from "./use-factory-v2-map-options";
import { toggleSingleRealmLaunchMode, toggleTwoPlayerLaunchMode } from "../launch-modes";
import { getSimpleStepTitle, getStepStatusMessage, resolveRunPrimaryAction } from "../presenters";
import type {
  FactoryGameMode,
  FactoryLaunchPreset,
  FactoryPollingState,
  FactoryRun,
  FactoryWatcherState,
} from "../types";

const RUN_LOOKUP_ATTEMPTS = 8;
const RUN_LOOKUP_DELAY_MS = 1_500;
const RUN_POLL_INTERVAL_MS = 5_000;
const FIRST_UPDATE_WAIT_MESSAGE = "This game just started. We are waiting for it to appear.";
const AUTO_UPDATE_MESSAGE = "Updating automatically.";
const EXISTING_GAME_NOTICE = "That game already exists. We opened it for you.";

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

export const useFactoryV2 = () => {
  const initialMode: FactoryGameMode = "eternum";
  const initialEnvironmentId = getDefaultEnvironmentIdForMode(initialMode);
  const initialPresetId = getDefaultPresetIdForModeSelection(initialMode);
  const initialPreset = getFactoryPresetById(initialPresetId);
  const [selectedMode, setSelectedMode] = useState<FactoryGameMode>(initialMode);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(initialEnvironmentId);
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);
  const [runsByEnvironment, setRunsByEnvironment] = useState<Record<string, FactoryRun[]>>({});
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [draftGameName, setDraftGameName] = useState(buildSuggestedGameName(initialMode, []));
  const [draftStartAt, setDraftStartAt] = useState(initialPreset ? getPresetStartAtValue(initialPreset) : "");
  const [draftDurationMinutes, setDraftDurationMinutes] = useState<number | null>(
    initialPreset?.defaults.durationMinutes ?? null,
  );
  const [twoPlayerMode, setTwoPlayerMode] = useState(initialPreset?.defaults.twoPlayerMode ?? false);
  const [singleRealmMode, setSingleRealmMode] = useState(initialPreset?.defaults.singleRealmMode ?? false);
  const [watcher, setWatcher] = useState<FactoryWatcherState | null>(null);
  const [acceptedRunState, setAcceptedRunState] = useState<AcceptedRunState | null>(null);
  const [guidedRecoveryState, setGuidedRecoveryState] = useState<GuidedRecoveryState | null>(null);
  const [pendingLaunches, setPendingLaunches] = useState<FactoryPendingLaunch[]>(() => readFactoryPendingLaunches());
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
  const matchingRun = resolveMatchingRunByName(modeRuns, draftGameName);
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
        await refreshRunRecord(environmentId, selectedRun.name);

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
        const record = await readFactoryRunIfPresent(environmentId, selectedRun.name);

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
        gameName: selectedRun.name,
        title: `Continuing ${selectedRun.name}`,
        detail: "Picking up where this game stopped.",
        workflowName: primaryAction.launchScope,
        statusLabel: "Working",
      },
      async () => {
        try {
          await continueFactoryRun({
            environment: environmentId,
            gameName: selectedRun.name,
            launchStep: primaryAction.launchScope,
          });
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            selectedRun.name,
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

    setSelectedMode(mode);
    setSelectedEnvironmentId(nextEnvironmentId);
    setSelectedPresetId(nextPresetId);
    setSelectedRunId(null);
    setDraftGameName(buildSuggestedGameName(mode, runsByEnvironmentRef.current[nextEnvironmentId] ?? []));
    applyPresetDefaults(nextPreset);
    clearTransientState();
  };

  const selectEnvironment = (environmentId: string) => {
    setSelectedEnvironmentId(environmentId);
    setSelectedRunId(null);
    setDraftGameName(buildSuggestedGameName(selectedMode, runsByEnvironmentRef.current[environmentId] ?? []));
    clearTransientState();
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

    try {
      const existingRun = await openExistingRunIfPresent(environmentId, requestedGameName);
      if (existingRun) {
        setNotice(EXISTING_GAME_NOTICE);
        return true;
      }
    } catch (error) {
      setNotice(resolveWorkerErrorMessage(error));
      return false;
    }

    rememberPendingLaunch({
      environmentId,
      gameName: requestedGameName,
      mode: selectedMode,
      createdAt: new Date().toISOString(),
    });
    setSelectedRunId(buildPendingRunId(environmentId, requestedGameName));
    setPollingState({
      status: "checking",
      detail: FIRST_UPDATE_WAIT_MESSAGE,
      lastCheckedAt: Date.now(),
    });

    const launched = await runWatchedAction(
      {
        kind: "launch",
        gameName: requestedGameName,
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
            "This game is already starting. We opened it for you.",
          );

          if (openedConflictingRun) {
            return;
          }

          throw error;
        }

        const nextRun = await waitForRunRecord(environmentId, requestedGameName);
        if (nextRun) {
          selectFetchedRun(environmentId, nextRun);
        } else {
          await refreshEnvironmentRuns(environmentId);
          setNotice(FIRST_UPDATE_WAIT_MESSAGE);
        }
      },
    );

    if (!launched) {
      forgetPendingLaunch(environmentId, requestedGameName);
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
        gameName: selectedRun.name,
        title: `Continuing ${selectedRun.name}`,
        detail: "Picking up where this game stopped.",
        workflowName: stepId,
        statusLabel: "Working",
      },
      async () => {
        try {
          await continueFactoryRun({
            environment: environmentId,
            gameName: selectedRun.name,
            launchStep: primaryAction.launchScope,
          });
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            selectedRun.name,
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
        gameName: selectedRun.name,
        title: `Retrying ${selectedRun.name}`,
        detail:
          primaryAction.launchScope === "full" ? "Starting this game again from the top." : "Trying that part again.",
        workflowName: primaryAction.launchScope,
        statusLabel: "Retrying",
      },
      async () => {
        try {
          await continueFactoryRun({
            environment: environmentId,
            gameName: selectedRun.name,
            launchStep: primaryAction.launchScope,
          });
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            selectedRun.name,
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
        gameName: selectedRun.name,
        title: `Bringing ${selectedRun.name} online`,
        detail: "Starting the indexer again.",
        workflowName: indexerStepId,
        statusLabel: "Starting",
      },
      async () => {
        try {
          await continueFactoryRun({
            environment: environmentId,
            gameName: selectedRun.name,
            launchStep: indexerStepId,
          });
        } catch (error) {
          const openedConflictingRun = await openConflictingRunIfPresent(
            error,
            environmentId,
            selectedRun.name,
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
        gameName: selectedRun.name,
        title: `Checking ${selectedRun.name}`,
        detail: "Looking for the latest update.",
        workflowName: "factory-runs",
        statusLabel: "Checking",
      },
      async () => {
        await refreshRunRecord(environmentId, selectedRun.name);
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
      const record = await readFactoryRun(environmentId, trimmedName);
      selectFetchedRun(environmentId, record);
      return true;
    } catch (error) {
      if (error instanceof FactoryWorkerApiError && error.status === 404) {
        setNotice(`No game named ${trimmedName} was found here yet.`);
        return false;
      }

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
    presets,
    selectedPresetId,
    selectedPreset,
    draftGameName,
    draftStartAt,
    draftDurationMinutes,
    showsDuration,
    durationOptions,
    twoPlayerMode,
    singleRealmMode,
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
    selectPreset,
    selectRun,
    setDraftGameName,
    setDraftStartAt,
    setDraftDurationMinutes,
    toggleTwoPlayerMode,
    toggleSingleRealmMode,
    fandomizeGameName,
    launchSelectedPreset,
    continueSelectedRun,
    retrySelectedRun,
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

  function selectFetchedRun(
    environmentId: FactoryWorkerEnvironmentId,
    record: Awaited<ReturnType<typeof readFactoryRun>>,
  ) {
    const nextRun = mapFactoryWorkerRun(record);
    const nextRuns = replaceRunInEnvironment(runsByEnvironmentRef.current[environmentId] ?? [], nextRun);

    commitEnvironmentRuns(environmentId, nextRuns);
    setAcceptedRunState((currentState) =>
      currentState && currentState.runId === nextRun.id && hasObservedAcceptedStep(nextRun, currentState.stepId)
        ? null
        : currentState,
    );
    setSelectedRunId(nextRun.id);
    forgetPendingLaunch(environmentId, nextRun.name);
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

  async function refreshRunRecord(environmentId: FactoryWorkerEnvironmentId, gameName: string) {
    const record = await readFactoryRun(environmentId, gameName);
    selectFetchedRun(environmentId, record);
  }

  async function openExistingRunIfPresent(environmentId: FactoryWorkerEnvironmentId, gameName: string) {
    const record = await readFactoryRunIfPresent(environmentId, gameName);

    if (!record) {
      return false;
    }

    selectFetchedRun(environmentId, record);
    return true;
  }

  async function openConflictingRunIfPresent(
    error: unknown,
    environmentId: FactoryWorkerEnvironmentId,
    gameName: string,
    conflictNotice: string,
  ) {
    if (!(error instanceof FactoryWorkerApiError) || error.status !== 409) {
      return false;
    }

    const record = await readFactoryRunIfPresent(environmentId, gameName);

    if (!record) {
      const delayedRecord = await waitForRunRecord(environmentId, gameName);

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

  async function waitForRunRecord(environmentId: FactoryWorkerEnvironmentId, gameName: string) {
    for (let attempt = 0; attempt < RUN_LOOKUP_ATTEMPTS; attempt += 1) {
      const record = await readFactoryRunIfPresent(environmentId, gameName);

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

  function commitPendingLaunches(nextPendingLaunches: FactoryPendingLaunch[]) {
    pendingLaunchesRef.current = nextPendingLaunches;
    setPendingLaunches(nextPendingLaunches);
    writeFactoryPendingLaunches(nextPendingLaunches);
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

  function forgetPendingLaunch(environmentId: string, gameName: string) {
    updatePendingLaunches((currentPendingLaunches) =>
      currentPendingLaunches.filter((pendingLaunch) => !matchesPendingLaunch(pendingLaunch, environmentId, gameName)),
    );
  }

  function forgetPendingLaunchesThatExistAsRealRuns(environmentId: string, runs: FactoryRun[]) {
    updatePendingLaunches((currentPendingLaunches) =>
      currentPendingLaunches.filter(
        (pendingLaunch) =>
          pendingLaunch.environmentId !== environmentId ||
          !runs.some(
            (run) => normalizePendingLaunchKey(environmentId, run.name) === buildPendingLaunchKey(pendingLaunch),
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

function resolveIndexerRecoveryStepId(run: FactoryRun) {
  return run.steps.some((step) => step.id === "create-indexer" || step.id === "wait-indexer") ? "create-indexer" : null;
}

function buildSuggestedGameName(mode: FactoryGameMode, runs: FactoryRun[]) {
  return buildFandomizedGameName(mode, runs.length + 1);
}

function buildPendingRunId(environmentId: string, gameName: string) {
  return `pending:${environmentId}:${gameName}`;
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
    id: buildPendingRunId(pendingLaunch.environmentId, pendingLaunch.gameName),
    syncKey: `pending:${pendingLaunch.environmentId}:${pendingLaunch.gameName}`,
    mode: pendingLaunch.mode,
    name: pendingLaunch.gameName,
    environment: pendingLaunch.environmentId,
    owner: "Factory",
    presetId: "pending",
    status: "running",
    summary: resolvePendingRunSummary(pendingLaunch, watcher, pollingState),
    updatedAt: "Starting now",
    steps: buildPendingRunSteps(pendingLaunch.mode),
  };
}

function buildPendingRunSteps(mode: FactoryGameMode): FactoryRun["steps"] {
  return (
    mode === "eternum"
      ? [
          createPendingStep("launch-request", "running"),
          createPendingStep("create-world", "pending"),
          createPendingStep("wait-for-factory-index", "pending"),
          createPendingStep("configure-world", "pending"),
          createPendingStep("grant-lootchest-role", "pending"),
          createPendingStep("grant-village-pass-role", "pending"),
          createPendingStep("create-banks", "pending"),
          createPendingStep("create-indexer", "pending"),
        ]
      : [
          createPendingStep("launch-request", "running"),
          createPendingStep("create-world", "pending"),
          createPendingStep("wait-for-factory-index", "pending"),
          createPendingStep("configure-world", "pending"),
          createPendingStep("grant-lootchest-role", "pending"),
          createPendingStep("create-indexer", "pending"),
        ]
  ) satisfies FactoryRun["steps"];
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
    pendingRuns.map((pendingRun) => normalizePendingLaunchKey(pendingRun.environment, pendingRun.name)),
  );

  return [
    ...pendingRuns,
    ...runs.filter((run) => !pendingRunKeys.has(normalizePendingLaunchKey(run.environment, run.name))),
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
  const remainingRuns = runs.filter((run) => run.id !== nextRun.id && run.name !== nextRun.name);
  return [nextRun, ...remainingRuns];
}

function mergeListedRunsWithCurrentRuns(currentRuns: FactoryRun[], listedRuns: FactoryRun[]) {
  if (currentRuns.length === 0 || listedRuns.length === 0) {
    return listedRuns.length === 0 ? currentRuns : listedRuns;
  }

  const listedRunKeys = new Set(listedRuns.map((run) => normalizePendingLaunchKey(run.environment, run.name)));
  // Preserve targeted run fetches until the broader environment list catches up.
  const missingCurrentRuns = currentRuns.filter(
    (run) => !listedRunKeys.has(normalizePendingLaunchKey(run.environment, run.name)),
  );

  return [...missingCurrentRuns, ...listedRuns];
}

function resolvePendingRunSummary(
  pendingLaunch: FactoryPendingLaunch,
  watcher: FactoryWatcherState | null,
  pollingState: FactoryPollingState,
) {
  if (watcher?.gameName === pendingLaunch.gameName) {
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

function matchesPendingLaunch(pendingLaunch: FactoryPendingLaunch, environmentId: string, gameName: string) {
  return buildPendingLaunchKey(pendingLaunch) === normalizePendingLaunchKey(environmentId, gameName);
}

function buildPendingLaunchKey(pendingLaunch: FactoryPendingLaunch) {
  return normalizePendingLaunchKey(pendingLaunch.environmentId, pendingLaunch.gameName);
}

function normalizePendingLaunchKey(environmentId: string, gameName: string) {
  return `${environmentId}:${gameName.trim().toLowerCase()}`;
}

function arePendingLaunchesEqual(left: FactoryPendingLaunch[], right: FactoryPendingLaunch[]) {
  return (
    left.length === right.length &&
    left.every(
      (pendingLaunch, index) =>
        pendingLaunch.environmentId === right[index]?.environmentId &&
        pendingLaunch.gameName === right[index]?.gameName &&
        pendingLaunch.mode === right[index]?.mode &&
        pendingLaunch.createdAt === right[index]?.createdAt,
    )
  );
}

function resolveMatchingRunByName(runs: FactoryRun[], requestedName: string) {
  const normalizedName = requestedName.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return runs.find((run) => run.name.trim().toLowerCase() === normalizedName) ?? null;
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
