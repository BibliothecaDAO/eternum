import { useEffect, useRef, useState } from "react";
import { buildBlitzDurationOptions, supportsFactoryDuration } from "../duration";
import { buildFandomizedGameName } from "../funny-names";
import {
  factoryModeDefinitions,
  getDefaultEnvironmentIdForMode,
  getDefaultPresetIdForModeSelection,
  getFactoryEnvironmentOptions,
  getFactoryLaunchPresetsForMode,
  getFactoryPresetById,
  getPresetStartAtValue,
} from "../catalog";
import { toggleSingleRealmLaunchMode, toggleTwoPlayerLaunchMode } from "../launch-modes";
import type { FactoryGameMode, FactoryLaunchPreset, FactoryRun, FactoryWatcherState } from "../types";
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

const RUN_LOOKUP_ATTEMPTS = 8;
const RUN_LOOKUP_DELAY_MS = 1_500;

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
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isResolvingRunName, setIsResolvingRunName] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const runsByEnvironmentRef = useRef<Record<string, FactoryRun[]>>({});

  const modeDefinition = resolveModeDefinition(selectedMode);
  const environmentOptions = getFactoryEnvironmentOptions(selectedMode);
  const selectedEnvironment =
    environmentOptions.find((environment) => environment.id === selectedEnvironmentId) ?? environmentOptions[0] ?? null;
  const presets = getFactoryLaunchPresetsForMode(selectedMode);
  const modeRuns = runsByEnvironment[selectedEnvironment?.id ?? ""] ?? [];
  const selectedRun = modeRuns.find((run) => run.id === selectedRunId) ?? modeRuns[0] ?? null;
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0] ?? null;
  const matchingRun = resolveMatchingRunByName(modeRuns, draftGameName);
  const showsDuration = supportsFactoryDuration(selectedMode);
  const durationOptions = showsDuration ? buildBlitzDurationOptions(presets, draftDurationMinutes) : [];
  const isWatcherBusy = watcher !== null;
  const environmentUnavailableReason = resolveEnvironmentUnavailableReason(selectedEnvironment?.id);

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
        return true;
      }
    } catch (error) {
      setNotice(resolveWorkerErrorMessage(error));
      return false;
    }

    return runWatchedAction(
      {
        kind: "launch",
        title: `Launching ${requestedGameName}`,
        detail: "Starting the game.",
        workflowName: "game-launch.yml",
        statusLabel: "Watching",
      },
      async () => {
        await createFactoryRun(buildCreateRunRequest(environmentId, requestedGameName));
        const nextRun = await waitForRunRecord(environmentId, requestedGameName);
        if (nextRun) {
          selectFetchedRun(environmentId, nextRun);
        } else {
          await refreshEnvironmentRuns(environmentId);
          setNotice("Launch started. Check again in a moment if the game does not appear yet.");
        }
      },
    );
  };

  const continueSelectedRun = async () => {
    if (!selectedRun || isWatcherBusy) {
      return;
    }

    const stepId = resolveContinuableStepId(selectedRun);
    const environmentId = assertSupportedEnvironment(selectedRun.environment);

    if (!stepId || !environmentId) {
      return;
    }

    await runWatchedAction(
      {
        kind: "continue",
        title: `Continuing ${selectedRun.name}`,
        detail: "Doing the next safe part.",
        workflowName: stepId,
        statusLabel: "Watching",
      },
      async () => {
        await continueFactoryRun({
          environment: environmentId,
          gameName: selectedRun.name,
          launchStep: stepId,
        });
        await refreshRunRecord(environmentId, selectedRun.name);
      },
    );
  };

  const retrySelectedRun = async () => {
    if (!selectedRun || isWatcherBusy) {
      return;
    }

    const stepId = resolveRetryableStepId(selectedRun);
    const environmentId = assertSupportedEnvironment(selectedRun.environment);

    if (!stepId || !environmentId) {
      return;
    }

    await runWatchedAction(
      {
        kind: "retry",
        title: `Retrying ${selectedRun.name}`,
        detail: "Trying that part again.",
        workflowName: stepId,
        statusLabel: "Watching",
      },
      async () => {
        await continueFactoryRun({
          environment: environmentId,
          gameName: selectedRun.name,
          launchStep: stepId,
        });
        await refreshRunRecord(environmentId, selectedRun.name);
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
        title: `Checking ${selectedRun.name}`,
        detail: "Looking for the latest state.",
        workflowName: "factory-runs",
        statusLabel: "Watching",
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
        setNotice(`No game named ${trimmedName} exists on this network yet.`);
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
    isWatcherBusy,
    isLoadingRuns,
    isResolvingRunName,
    notice,
    environmentUnavailableReason,
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
    setWatcher(null);
  }

  function commitEnvironmentRuns(environmentId: string, nextRuns: FactoryRun[]) {
    setRunsByEnvironment((currentRuns) => ({
      ...currentRuns,
      [environmentId]: nextRuns,
    }));
  }

  function selectFetchedRun(environmentId: FactoryWorkerEnvironmentId, record: Awaited<ReturnType<typeof readFactoryRun>>) {
    const nextRun = mapFactoryWorkerRun(record);
    const nextRuns = replaceRunInEnvironment(runsByEnvironmentRef.current[environmentId] ?? [], nextRun);

    commitEnvironmentRuns(environmentId, nextRuns);
    setSelectedRunId(nextRun.id);
    setNotice(null);
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

  async function waitForRunRecord(environmentId: FactoryWorkerEnvironmentId, gameName: string) {
    for (let attempt = 0; attempt < RUN_LOOKUP_ATTEMPTS; attempt += 1) {
      const record = await readFactoryRunIfPresent(environmentId, gameName);

      if (record) {
        return record;
      }

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
      return false;
    } finally {
      setWatcher(null);
    }
  }

  function buildCreateRunRequest(environmentId: FactoryWorkerEnvironmentId, gameName: string) {
    return {
      environment: environmentId,
      gameName,
      gameStartTime: resolveStartTimeValue(draftStartAt),
      devModeOn: selectedPreset?.defaults.devMode ?? false,
      twoPlayerMode: selectedMode === "blitz" ? twoPlayerMode : false,
      singleRealmMode: selectedMode === "blitz" ? singleRealmMode : false,
      durationSeconds: showsDuration && draftDurationMinutes ? draftDurationMinutes * 60 : undefined,
    };
  }
};

async function loadEnvironmentRuns(
  environmentId: FactoryWorkerEnvironmentId,
  fallbackRuns: FactoryRun[],
) {
  const records = await listFactoryRuns(environmentId);

  if (records === null) {
    return fallbackRuns;
  }

  return mapAndSortFactoryWorkerRuns(records);
}

function resolveModeDefinition(mode: FactoryGameMode) {
  return factoryModeDefinitions.find((definition) => definition.id === mode) ?? factoryModeDefinitions[0];
}

function buildSuggestedGameName(mode: FactoryGameMode, runs: FactoryRun[]) {
  return buildFandomizedGameName(mode, runs.length + 1);
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

function resolveContinuableStepId(run: FactoryRun): FactoryWorkerLaunchStepId | null {
  return resolveActionableStepId(run, ["running", "pending"]);
}

function resolveRetryableStepId(run: FactoryRun): FactoryWorkerLaunchStepId | null {
  return resolveActionableStepId(run, ["failed"]);
}

function resolveActionableStepId(run: FactoryRun, statuses: Array<FactoryRun["steps"][number]["status"]>) {
  const step = run.steps.find((candidate) => statuses.includes(candidate.status));
  return (step?.id as FactoryWorkerLaunchStepId | undefined) ?? null;
}

function resolveStartTimeValue(startAt: string) {
  const date = new Date(startAt);
  return Number.isNaN(date.getTime()) ? startAt : date.toISOString();
}

function resolveEnvironmentUnavailableReason(environmentId?: string | null) {
  if (!environmentId || isFactoryWorkerEnvironmentSupported(environmentId)) {
    return null;
  }

  return "This network is not wired to the launch worker yet.";
}

function assertSupportedEnvironment(environmentId?: string | null) {
  if (!environmentId || !isFactoryWorkerEnvironmentSupported(environmentId)) {
    return null;
  }

  return environmentId;
}

function resolveWorkerErrorMessage(error: unknown) {
  if (error instanceof FactoryWorkerApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The factory worker could not be reached.";
}

function delay(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
