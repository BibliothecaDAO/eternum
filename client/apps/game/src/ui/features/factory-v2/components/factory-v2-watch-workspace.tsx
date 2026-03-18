import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import {
  getCompletedStep,
  getCurrentStep,
  getEnvironmentLabel,
  getNextStep,
  getRunDetailMessage,
  getRunHeadline,
  getRunProgressLabel,
  getRunStatusMeta,
  getStepDetailMessage,
  getSimpleStepTitle,
  getStepStatusMeta,
  resolveRunPrimaryAction,
} from "../presenters";
import type { FactoryGameMode, FactoryPollingState, FactoryRun, FactoryWatcherState } from "../types";

const FIRST_UPDATE_WAIT_MESSAGE = "We just started this game. Please wait a moment.";
const AUTO_UPDATE_LABEL = "Updating automatically";

export const FactoryV2WatchWorkspace = ({
  mode,
  runs,
  selectedRun,
  activeRunName,
  acceptedRunMessage,
  watcher,
  pollingState,
  isWatcherBusy,
  isResolvingRunName,
  notice,
  lookupDisabledReason,
  onSelectRun,
  onResolveRunByName,
  onContinue,
  onRetry,
  onBringIndexerLive,
  onRefresh,
}: {
  mode: FactoryGameMode;
  runs: FactoryRun[];
  selectedRun: FactoryRun | null;
  activeRunName: string | null;
  acceptedRunMessage: string | null;
  watcher: FactoryWatcherState | null;
  pollingState: FactoryPollingState;
  isWatcherBusy: boolean;
  isResolvingRunName: boolean;
  notice: string | null;
  lookupDisabledReason: string | null;
  onSelectRun: (runId: string) => void;
  onResolveRunByName: (gameName: string) => Promise<boolean>;
  onContinue: () => void;
  onRetry: () => void;
  onBringIndexerLive: () => void;
  onRefresh: () => void;
}) => {
  const appearance = resolveFactoryModeAppearance(mode);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [watchGameName, setWatchGameName] = useState(selectedRun?.name ?? "");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFilteringRuns, setIsFilteringRuns] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowAllSteps(selectedRun?.status === "attention");
  }, [selectedRun?.id, selectedRun?.status]);

  useEffect(() => {
    setWatchGameName(selectedRun?.name ?? activeRunName ?? "");
    setIsFilteringRuns(false);
  }, [activeRunName, selectedRun?.id, selectedRun?.name]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const matchingRuns = resolveMatchingRunsByName(runs, isFilteringRuns ? watchGameName : "");
  const showsPendingRunState = Boolean(watcher) || Boolean(activeRunName) || pollingState.status !== "idle";
  const isPendingSelectedRun = Boolean(selectedRun && selectedRun.id.startsWith("pending:"));
  const isAwaitingAcceptedUpdate = Boolean(acceptedRunMessage);
  const showsInFlightState = isPendingSelectedRun || isAwaitingAcceptedUpdate;
  const statusMeta = selectedRun ? getRunStatusMeta(selectedRun.status) : null;
  const currentStep = selectedRun ? getCurrentStep(selectedRun) : null;
  const completedStep = selectedRun ? getCompletedStep(selectedRun) : null;
  const nextStep = selectedRun ? getNextStep(selectedRun) : null;
  const primaryAction = selectedRun && !isWatcherBusy ? resolveRunPrimaryAction(selectedRun) : null;
  const environmentLabel = selectedRun ? getEnvironmentLabel(selectedRun.environment) : null;
  const currentStepLabel = isPendingSelectedRun
    ? `Starting ${selectedRun?.name ?? "your game"}`
    : currentStep
      ? getSimpleStepTitle(currentStep)
      : "Everything is ready";
  const detailMessage = selectedRun
    ? isPendingSelectedRun
      ? (watcher?.detail ?? FIRST_UPDATE_WAIT_MESSAGE)
      : (acceptedRunMessage ?? watcher?.detail ?? notice ?? getRunDetailMessage(selectedRun))
    : "Type a game name to open it.";
  const headline = selectedRun
    ? isPendingSelectedRun
      ? `Launching ${selectedRun.name}`
      : isAwaitingAcceptedUpdate
        ? "Got it"
        : getRunHeadline(selectedRun)
    : (watcher?.title ?? "Find a game");
  const liveStatusLabel = buildLiveStatusLabel(pollingState, isPendingSelectedRun, selectedRun?.status ?? null);
  const launchPlaceholderName = activeRunName || watchGameName.trim() || "your game";
  const visiblePrimaryAction = isAwaitingAcceptedUpdate ? null : primaryAction;
  const showsManualRefresh =
    !isAwaitingAcceptedUpdate && pollingState.status !== "checking" && pollingState.status !== "live";
  const secondaryNotice = notice && notice !== detailMessage && !watcher ? notice : null;
  const selectRunByName = (value: string) => {
    setWatchGameName(value);
    setIsFilteringRuns(true);
    setIsPickerOpen(true);

    const matchingRun = resolveMatchingRunByName(runs, value);

    if (matchingRun && matchingRun.id !== selectedRun?.id) {
      onSelectRun(matchingRun.id);
      setIsPickerOpen(false);
    }
  };
  const chooseRun = (run: FactoryRun) => {
    setWatchGameName(run.name);
    setIsFilteringRuns(false);
    setIsPickerOpen(false);

    if (run.id !== selectedRun?.id) {
      onSelectRun(run.id);
    }
  };
  const handleGameNameEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const matchingRun = resolveMatchingRunByName(runs, watchGameName) ?? matchingRuns[0] ?? null;

    if (matchingRun) {
      chooseRun(matchingRun);
      return;
    }

    if (!lookupDisabledReason) {
      void onResolveRunByName(watchGameName);
    }
  };

  return (
    <article className="mx-auto max-w-md space-y-3">
      <div>
        <label
          htmlFor="factory-watch-game"
          className="block text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42"
        >
          Game name
        </label>
        <div ref={pickerRef} className="relative mt-2">
          <input
            id="factory-watch-game"
            value={watchGameName}
            onChange={(event) => selectRunByName(event.target.value)}
            onFocus={() => {
              setIsFilteringRuns(false);
              setIsPickerOpen(true);
            }}
            onKeyDown={handleGameNameEnter}
            placeholder="Type a game name"
            disabled={Boolean(lookupDisabledReason)}
            className={cn(
              "h-10 w-full rounded-[16px] border border-black/10 bg-white/78 px-4 pr-10 text-center text-sm font-medium text-black outline-none transition-colors placeholder:text-black/30 focus:border-black/25",
              lookupDisabledReason ? "cursor-not-allowed opacity-60" : "",
              appearance.listItemClassName,
            )}
          />
          <button
            type="button"
            onClick={() => {
              setIsFilteringRuns(false);
              setIsPickerOpen((open) => !open);
            }}
            disabled={Boolean(lookupDisabledReason)}
            className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/[0.04] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", isPickerOpen ? "rotate-180" : "")} />
          </button>
          {isPickerOpen && matchingRuns.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[18px] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,238,228,0.96))] shadow-[0_18px_48px_rgba(30,20,10,0.16)] backdrop-blur-xl">
              <div className="border-b border-black/6 px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.24em] text-black/34">
                Choose a game
              </div>
              <div className="max-h-60 overflow-y-auto p-1.5">
                {matchingRuns.slice(0, 6).map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseRun(run)}
                    className="flex w-full items-center justify-between rounded-[14px] border border-transparent bg-white/48 px-3 py-2.5 text-left text-[13px] text-black transition-colors hover:border-black/6 hover:bg-black/[0.035]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-black">{run.name}</div>
                      <div className="mt-0.5 text-[11px] text-black/42">{getEnvironmentLabel(run.environment)}</div>
                    </div>
                    <div
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]",
                        getRunStatusMeta(run.status).className,
                      )}
                    >
                      {getRunStatusMeta(run.status).label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {lookupDisabledReason ? (
          <p className="mt-2 text-center text-sm leading-6 text-black/50">{lookupDisabledReason}</p>
        ) : null}
        {isResolvingRunName ? (
          <p className="mt-2 text-center text-sm leading-6 text-black/50">Looking for that game.</p>
        ) : null}
      </div>

      {selectedRun ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-[26px] border px-5 py-6 text-center md:px-6 md:py-7",
            appearance.featureSurfaceClassName,
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute right-[-3rem] top-[-3rem] h-28 w-28 rounded-full blur-3xl",
              appearance.artGlowClassName,
            )}
          />

          <div className="relative space-y-4">
            <div className="space-y-2">
              {showsInFlightState ? (
                <div className="flex justify-center">
                  <FactoryV2LoaderHalo pollingState={pollingState} />
                </div>
              ) : null}
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">
                {selectedRun.name} on {environmentLabel}
              </div>
              {!showsInFlightState ? (
                <div className="flex justify-center">
                  <div
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
                      statusMeta?.className,
                    )}
                  >
                    {statusMeta?.label}
                  </div>
                </div>
              ) : null}
              <h3 className="text-[1.35rem] font-semibold tracking-tight text-black">{headline}</h3>
              {!showsInFlightState ? (
                <FactoryV2LiveStatus pollingState={pollingState} liveStatusLabel={liveStatusLabel} />
              ) : null}
            </div>

            <div className={cn("rounded-[20px] px-4 py-3.5 text-left", appearance.quietSurfaceClassName)}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Now</div>
              <div className="mt-2 text-[15px] font-semibold text-black">{currentStepLabel}</div>
              <p className="mt-2 text-sm leading-5 text-black/56">{detailMessage}</p>
            </div>

            <div className="grid gap-2 text-left">
              {completedStep ? (
                <FactoryV2StepMoment label="Done" stepLabel={getSimpleStepTitle(completedStep)} tone="done" />
              ) : null}
              {currentStep ? <FactoryV2StepMoment label="Now" stepLabel={currentStepLabel} tone="now" /> : null}
              {nextStep ? <FactoryV2StepMoment label="Next" stepLabel={getSimpleStepTitle(nextStep)} tone="next" /> : null}
            </div>

            <div className="space-y-2">
              <div className="text-[13px] text-black/54">{getRunProgressLabel(selectedRun)}</div>
              <div className="flex gap-2">
                {selectedRun.steps.map((step) => (
                  <div
                    key={step.id}
                    className={cn("h-1.5 flex-1 rounded-full", getStepStatusMeta(step.status).railClassName)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {visiblePrimaryAction ? (
                <button
                  type="button"
                  onClick={visiblePrimaryAction.kind === "retry" ? onRetry : onContinue}
                  disabled={isWatcherBusy || Boolean(lookupDisabledReason)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    visiblePrimaryAction.kind === "retry"
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : appearance.primaryButtonClassName,
                  )}
                >
                  {visiblePrimaryAction.kind === "retry" ? <RotateCcw className="h-4 w-4" /> : null}
                  {visiblePrimaryAction.label}
                </button>
              ) : null}

              {showsManualRefresh ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isWatcherBusy || Boolean(lookupDisabledReason)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    appearance.secondaryButtonClassName,
                  )}
                >
                  <RefreshCw className="h-4 w-4" />
                  Check again
                </button>
              ) : null}
            </div>

            {secondaryNotice ? <p className="text-sm leading-6 text-black/52">{secondaryNotice}</p> : null}

            <button
              type="button"
              onClick={() => setShowAllSteps((open) => !open)}
              className="text-sm font-medium text-black/58 transition-colors hover:text-black"
            >
              {showAllSteps ? "Hide details" : "See details"}
            </button>

            {showAllSteps ? (
              <div className="space-y-2 border-t border-black/8 pt-3 text-left">
                {selectedRun.steps.map((step) => (
                  <FactoryV2StepSummary
                    key={step.id}
                    step={step}
                    manualAction={resolveStepSummaryAction(step, {
                      isWatcherBusy,
                      isBlocked: Boolean(lookupDisabledReason) || showsInFlightState,
                      onBringIndexerLive,
                    })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : showsPendingRunState ? (
        <div className={cn("rounded-[26px] border p-5 text-center md:p-6", appearance.featureSurfaceClassName)}>
          <div className="space-y-3">
            <div className="flex justify-center">
              <FactoryV2LoaderHalo pollingState={pollingState} />
            </div>
            <h3 className="text-[1.2rem] font-semibold tracking-tight text-black">
              {watcher?.title ?? `Opening ${launchPlaceholderName}`}
            </h3>
            <p className="text-sm leading-6 text-black/56">{watcher?.detail ?? notice ?? FIRST_UPDATE_WAIT_MESSAGE}</p>
            {notice && notice !== (watcher?.detail ?? FIRST_UPDATE_WAIT_MESSAGE) ? (
              <p className="text-sm leading-6 text-black/52">{notice}</p>
            ) : null}
            <div className={cn("rounded-[18px] px-4 py-3 text-left", appearance.quietSurfaceClassName)}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Now</div>
              <div className="mt-2 text-[15px] font-semibold text-black">Starting {launchPlaceholderName}</div>
              <p className="mt-2 text-sm leading-5 text-black/56">{FIRST_UPDATE_WAIT_MESSAGE}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn("rounded-[26px] border p-5 text-center md:p-6", appearance.featureSurfaceClassName)}>
          <div className="text-sm leading-6 text-black/58">Type a game name and press Enter.</div>
        </div>
      )}
    </article>
  );
};

const FactoryV2LiveStatus = ({
  pollingState,
  liveStatusLabel,
}: {
  pollingState: FactoryPollingState;
  liveStatusLabel: string;
}) => (
  <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-black/8 bg-white/45 px-3 py-1.5 text-[12px] text-black/52">
    <div className="relative flex h-3.5 w-3.5 items-center justify-center">
      {pollingState.status === "live" ? (
        <div className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-emerald-400/55" />
      ) : null}
      <div
        className={cn(
          "relative h-2.5 w-2.5 rounded-full",
          pollingState.status === "idle"
            ? "bg-black/18"
            : pollingState.status === "paused"
              ? "bg-rose-500"
              : pollingState.status === "checking"
                ? "animate-pulse bg-amber-500"
                : "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.8)]",
        )}
      />
    </div>
    <span>{liveStatusLabel}</span>
  </div>
);

const FactoryV2LoaderHalo = ({ pollingState }: { pollingState: FactoryPollingState }) => (
  <div className="relative flex h-14 w-14 items-center justify-center">
    <div
      className={cn(
        "absolute h-14 w-14 rounded-full border",
        pollingState.status === "paused" ? "border-rose-300/55" : "border-amber-300/45",
      )}
    />
    <div
      className={cn(
        "absolute h-10 w-10 rounded-full border-2 border-transparent",
        pollingState.status === "paused"
          ? "border-t-rose-400"
          : "animate-spin border-t-amber-500 border-r-amber-300/70",
      )}
    />
    <div className={cn("h-3 w-3 rounded-full", pollingState.status === "paused" ? "bg-rose-400" : "bg-amber-400")} />
  </div>
);

const FactoryV2StepMoment = ({
  label,
  stepLabel,
  tone,
}: {
  label: string;
  stepLabel: string;
  tone: "done" | "now" | "next";
}) => {
  const toneClassName = resolveStepMomentToneClassName(tone);

  return (
    <div className={cn("flex items-center justify-between rounded-[16px] border px-4 py-2.5", toneClassName)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">{label}</span>
      <span className="text-sm font-medium text-black/72">{stepLabel}</span>
    </div>
  );
};

function resolveStepMomentToneClassName(tone: "done" | "now" | "next") {
  switch (tone) {
    case "done":
      return "border-emerald-200/80 bg-emerald-50/70 shadow-[0_10px_24px_rgba(16,185,129,0.08)]";
    case "now":
      return "border-amber-300/80 bg-[linear-gradient(180deg,rgba(255,247,237,0.94),rgba(254,215,170,0.78))] shadow-[0_14px_34px_rgba(217,119,6,0.16)]";
    case "next":
    default:
      return "border-black/8 bg-white/52 shadow-[0_8px_18px_rgba(15,23,42,0.05)]";
  }
}

const resolveMatchingRunByName = (runs: FactoryRun[], requestedName: string) => {
  const normalizedName = requestedName.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return runs.find((run) => run.name.trim().toLowerCase() === normalizedName) ?? null;
};

const resolveMatchingRunsByName = (runs: FactoryRun[], requestedName: string) => {
  const normalizedName = requestedName.trim().toLowerCase();

  if (!normalizedName) {
    return runs;
  }

  return runs.filter((run) => run.name.trim().toLowerCase().includes(normalizedName));
};

const FactoryV2StepSummary = ({
  step,
  manualAction,
}: {
  step: FactoryRun["steps"][number];
  manualAction: FactoryV2StepManualAction | null;
}) => {
  const statusMeta = getStepStatusMeta(step.status);

  return (
    <div className="flex items-start gap-3 rounded-[16px] border border-black/8 bg-black/[0.03] px-3.5 py-3">
      <div className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", statusMeta.railClassName)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-black">{getSimpleStepTitle(step)}</div>
          <div
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
              statusMeta.className,
            )}
          >
            {statusMeta.label}
          </div>
        </div>
        <div className="mt-2 text-sm leading-6 text-black/56">{getStepDetailMessage(step)}</div>
        {manualAction ? (
          <div className="mt-3 space-y-2 rounded-[14px] border border-black/8 bg-white/55 px-3 py-2.5">
            <div className="text-[12px] leading-5 text-black/52">{manualAction.description}</div>
            <button
              type="button"
              onClick={manualAction.onPress}
              className="inline-flex items-center justify-center rounded-full border border-black/12 bg-black/[0.05] px-3 py-1.5 text-[12px] font-semibold text-black transition-colors hover:bg-black/[0.08]"
            >
              {manualAction.label}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

interface FactoryV2StepManualAction {
  label: string;
  description: string;
  onPress: () => void;
}

function resolveStepSummaryAction(
  step: FactoryRun["steps"][number],
  options: {
    isWatcherBusy: boolean;
    isBlocked: boolean;
    onBringIndexerLive: () => void;
  },
): FactoryV2StepManualAction | null {
  if (step.status === "running" || options.isWatcherBusy || options.isBlocked) {
    return null;
  }

  if (step.id !== "create-indexer" && step.id !== "wait-indexer") {
    return null;
  }

  return {
    label: "Bring indexer live",
    description: "Use this if the indexer was deleted or needs to be started again.",
    onPress: options.onBringIndexerLive,
  };
}

function buildLiveStatusLabel(
  pollingState: FactoryPollingState,
  isPendingRun: boolean,
  runStatus: FactoryRun["status"] | null,
) {
  if (pollingState.status === "paused") {
    return pollingState.detail;
  }

  if (isPendingRun) {
    return "Getting ready";
  }

  if (pollingState.status === "checking") {
    return AUTO_UPDATE_LABEL;
  }

  if (runStatus === "complete") {
    return "All set";
  }

  if (pollingState.lastCheckedAt) {
    return AUTO_UPDATE_LABEL;
  }

  return pollingState.detail;
}
