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
import { useFactoryV2MoreOptions } from "./use-factory-v2-map-options";
import { toggleSingleRealmLaunchMode, toggleTwoPlayerLaunchMode } from "../launch-modes";
import { resolveRunPrimaryAction } from "../presenters";
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
const FIRST_UPDATE_WAIT_MESSAGE = "This game just started. Confirm game deployment.";
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
  const [pendingRunName, setPendingRunName] = useState<string | null>(null);
  const [pendingRunEnvironmentId, setPendingRunEnvironmentId] = useState<string | null>(null);
  const [pendingRunMode, setPendingRunMode] = useState<FactoryGameMode | null>(null);
  const [pollingState, setPollingState] = useState<FactoryPollingState>({
    status: "idle",
    detail: "Updates will show up here.",
    lastCheckedAt: null,
  });
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isResolvingRunName, setIsResolvingRunName] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const runsByEnvironmentRef = useRef<Record<string, FactoryRun[]>>({});

  const modeDefinition = resolveModeDefinition(selectedMode);
  const environmentOptions = getFactoryEnvironmentOptions(selectedMode);
  const selectedEnvironment =
    environmentOptions.find((environment) => environment.id === selectedEnvironmentId) ?? environmentOptions[0] ?? null;
  const presets = getFactoryLaunchPresetsForMode(selectedMode);
  const environmentRuns = runsByEnvironment[selectedEnvironment?.id ?? ""] ?? [];
  const pendingRun = buildPendingRun({
    pendingRunName,
    pendingRunEnvironmentId,
    pendingRunMode,
    selectedEnvironmentId,
    watcher,
    pollingState,
  });
  const modeRuns = mergeAcceptedRunIntoEnvironment(
    mergePendingRunIntoEnvironment(environmentRuns, pendingRun),
    acceptedRunState,
  );
  const selectedRun = modeRuns.find((run) => run.id === selectedRunId) ?? modeRuns[0] ?? null;
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0] ?? null;
  const matchingRun = resolveMatchingRunByName(modeRuns, draftGameName);
  const showsDuration = supportsFactoryDuration(selectedMode);
  const durationOptions = showsDuration ? buildBlitzDurationOptions(presets, draftDurationMinutes) : [];
  const isWatcherBusy = watcher !== null;
  const activeRunName = selectedRun?.name ?? pendingRunName;
  const acceptedRunMessage =
    selectedRun && acceptedRunState?.runId === selectedRun.id ? acceptedRunState.latestEvent : null;
  const shouldPreferWatchView = Boolean(watcher) || Boolean(selectedRun && isFactoryRunActive(selectedRun));
  const environmentUnavailableReason = resolveEnvironmentUnavailableReason(selectedEnvironment?.id);
  const moreOptions = useFactoryV2MoreOptions({
    mode: selectedMode,
    chain: selectedEnvironment?.chain ?? "slot",
    presetId: selectedPreset?.id ?? null,
    twoPlayerMode,
  });

  useEffect(() => {
    runsByEnvironmentRef.current = runsByEnvironment;
  }, [runsByEnvironment]);

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
        const nextRuns = await loadEnvironmentRuns(
          selectedEnvironment.id,
          runsByEnvironmentRef.current[selectedEnvironment.id] ?? [],
        );

        if (!isActive) {
          return;
        }

        commitEnvironmentRuns(selectedEnvironment.id, nextRuns);
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
      setPendingRunName(null);
      setPendingRunEnvironmentId(null);
      setPendingRunMode(null);
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

    setPendingRunName(requestedGameName);
    setPendingRunEnvironmentId(environmentId);
    setPendingRunMode(selectedMode);
    setSelectedRunId(buildPendingRunId(environmentId, requestedGameName));
    setPollingState({
      status: "checking",
      detail: FIRST_UPDATE_WAIT_MESSAGE,
      lastCheckedAt: Date.now(),
    });

    return runWatchedAction(
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
    shouldPreferWatchView,
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
    setPendingRunName(null);
    setPendingRunEnvironmentId(null);
    setPendingRunMode(null);
    setWatcher(null);
    setPollingState({
      status: "idle",
      detail: "Updates will show up here.",
      lastCheckedAt: null,
    });
  }

  function commitEnvironmentRuns(environmentId: string, nextRuns: FactoryRun[]) {
    setRunsByEnvironment((currentRuns) => ({
      ...currentRuns,
      [environmentId]: nextRuns,
    }));
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
    setPendingRunName(null);
    setPendingRunEnvironmentId(null);
    setPendingRunMode(null);
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
    const nextRuns = await loadEnvironmentRuns(environmentId, runsByEnvironmentRef.current[environmentId] ?? []);
    commitEnvironmentRuns(environmentId, nextRuns);
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

function buildPendingRun({
  pendingRunName,
  pendingRunEnvironmentId,
  pendingRunMode,
  selectedEnvironmentId,
  watcher,
  pollingState,
}: {
  pendingRunName: string | null;
  pendingRunEnvironmentId: string | null;
  pendingRunMode: FactoryGameMode | null;
  selectedEnvironmentId: string | null;
  watcher: FactoryWatcherState | null;
  pollingState: FactoryPollingState;
}) {
  if (
    !pendingRunName ||
    !pendingRunEnvironmentId ||
    !pendingRunMode ||
    pendingRunEnvironmentId !== selectedEnvironmentId
  ) {
    return null;
  }

  return {
    id: buildPendingRunId(pendingRunEnvironmentId, pendingRunName),
    syncKey: `pending:${pendingRunEnvironmentId}:${pendingRunName}`,
    mode: pendingRunMode,
    name: pendingRunName,
    environment: pendingRunEnvironmentId,
    owner: "Factory",
    presetId: "pending",
    status: "running" as const,
    summary: watcher?.detail ?? pollingState.detail,
    updatedAt: "Starting now",
    steps: buildPendingRunSteps(pendingRunMode),
  };
}

function buildPendingRunSteps(mode: FactoryGameMode): FactoryRun["steps"] {
  return (
    mode === "eternum"
      ? [
          createPendingStep("create-world", "Create world", "Creating the world right now.", "running"),
          createPendingStep("wait-for-factory-index", "Wait for factory index", "Giving the game a moment.", "pending"),
          createPendingStep("configure-world", "Configure world", "Applying the setup.", "pending"),
          createPendingStep("grant-village-pass-role", "Grant village pass role", "Opening village pass.", "pending"),
          createPendingStep("create-banks", "Create banks", "Placing banks.", "pending"),
          createPendingStep("create-indexer", "Create indexer", "Bringing the game online.", "pending"),
        ]
      : [
          createPendingStep("create-world", "Create world", "Creating the world right now.", "running"),
          createPendingStep("wait-for-factory-index", "Wait for factory index", "Giving the game a moment.", "pending"),
          createPendingStep("configure-world", "Configure world", "Applying the setup.", "pending"),
          createPendingStep("create-indexer", "Create indexer", "Bringing the game online.", "pending"),
        ]
  ) satisfies FactoryRun["steps"];
}

function createPendingStep(
  id: FactoryWorkerLaunchStepId,
  title: string,
  latestEvent: string,
  status: FactoryRun["steps"][number]["status"],
): FactoryRun["steps"][number] {
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

function mergePendingRunIntoEnvironment(runs: FactoryRun[], pendingRun: FactoryRun | null) {
  if (!pendingRun) {
    return runs;
  }

  return [pendingRun, ...runs.filter((run) => run.id !== pendingRun.id && run.name !== pendingRun.name)];
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
