import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { useEffect, useState, type KeyboardEvent } from "react";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryGameMode, FactoryPollingState, FactoryRun, FactoryWatcherState } from "../types";
import {
  getCompletedStep,
  getCurrentStep,
  getEnvironmentLabel,
  getRunDetailMessage,
  getRunHeadline,
  getRunProgressLabel,
  getRunStatusMeta,
  getSimpleStepTitle,
  getStepStatusMeta,
  getNextStep,
  resolveRunPrimaryAction,
} from "../presenters";

export const FactoryV2WatchWorkspace = ({
  mode,
  runs,
  selectedRun,
  activeRunName,
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
  onRefresh,
}: {
  mode: FactoryGameMode;
  runs: FactoryRun[];
  selectedRun: FactoryRun | null;
  activeRunName: string | null;
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
  onRefresh: () => void;
}) => {
  const appearance = resolveFactoryModeAppearance(mode);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [watchGameName, setWatchGameName] = useState(selectedRun?.name ?? "");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    setShowAllSteps(selectedRun?.status === "attention");
  }, [selectedRun?.id, selectedRun?.status]);

  useEffect(() => {
    setWatchGameName(selectedRun?.name ?? activeRunName ?? "");
  }, [activeRunName, selectedRun?.id, selectedRun?.name]);

  const matchingRuns = resolveMatchingRunsByName(runs, watchGameName);
  const statusMeta = selectedRun ? getRunStatusMeta(selectedRun.status) : null;
  const currentStep = selectedRun ? getCurrentStep(selectedRun) : null;
  const completedStep = selectedRun ? getCompletedStep(selectedRun) : null;
  const nextStep = selectedRun ? getNextStep(selectedRun) : null;
  const primaryAction = selectedRun ? resolveRunPrimaryAction(selectedRun) : null;
  const environmentLabel = selectedRun ? getEnvironmentLabel(selectedRun.environment) : null;
  const currentStepLabel = currentStep ? getSimpleStepTitle(currentStep) : "Everything is done";
  const detailMessage = selectedRun ? watcher?.detail ?? notice ?? getRunDetailMessage(selectedRun) : "Type a game name to check it.";
  const headline = selectedRun ? getRunHeadline(selectedRun) : watcher?.title ?? "Looking for your game";
  const liveStatusLabel = buildLiveStatusLabel(pollingState);
  const launchPlaceholderName = activeRunName || watchGameName.trim() || "your game";
  const showsPendingRunState = Boolean(watcher) || Boolean(activeRunName) || pollingState.status !== "idle";
  const selectRunByName = (value: string) => {
    setWatchGameName(value);
    setIsPickerOpen(true);

    const matchingRun = resolveMatchingRunByName(runs, value);

    if (matchingRun && matchingRun.id !== selectedRun?.id) {
      onSelectRun(matchingRun.id);
      setIsPickerOpen(false);
    }
  };
  const chooseRun = (run: FactoryRun) => {
    setWatchGameName(run.name);
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
        <div className="relative mt-2">
          <input
            id="factory-watch-game"
            value={watchGameName}
            onChange={(event) => selectRunByName(event.target.value)}
            onFocus={() => setIsPickerOpen(true)}
            onBlur={() => window.setTimeout(() => setIsPickerOpen(false), 120)}
            onKeyDown={handleGameNameEnter}
            placeholder="Type a game name"
            disabled={Boolean(lookupDisabledReason)}
            className={cn(
              "h-10 w-full rounded-[16px] border border-black/10 bg-white/78 px-4 pr-10 text-center text-sm font-medium text-black outline-none transition-colors placeholder:text-black/30 focus:border-black/25",
              lookupDisabledReason ? "cursor-not-allowed opacity-60" : "",
              appearance.listItemClassName,
            )}
          />
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
        </div>
        {lookupDisabledReason ? <p className="mt-2 text-center text-sm leading-6 text-black/50">{lookupDisabledReason}</p> : null}
        {isResolvingRunName ? <p className="mt-2 text-center text-sm leading-6 text-black/50">Looking for that game.</p> : null}
        {isPickerOpen && matchingRuns.length > 0 ? (
          <div className={cn("mt-2 overflow-hidden rounded-[16px] border", appearance.featureSurfaceClassName)}>
            {matchingRuns.slice(0, 6).map((run) => (
              <button
                key={run.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseRun(run)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-black transition-colors hover:bg-black/[0.04]"
              >
                <span className="font-medium">{run.name}</span>
                <span className="text-xs uppercase tracking-[0.18em] text-black/36">
                  {getRunStatusMeta(run.status).label}
                </span>
              </button>
            ))}
          </div>
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
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">
                {selectedRun.name} on {environmentLabel}
              </div>
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
              <h3 className="text-[1.35rem] font-semibold tracking-tight text-black">{headline}</h3>
              <FactoryV2LiveStatus pollingState={pollingState} liveStatusLabel={liveStatusLabel} />
            </div>

            <div className={cn("rounded-[20px] px-4 py-3.5 text-left", appearance.quietSurfaceClassName)}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Now</div>
              <div className="mt-2 text-[15px] font-semibold text-black">{currentStepLabel}</div>
              <p className="mt-2 text-sm leading-5 text-black/56">{detailMessage}</p>
            </div>

            <div className="grid gap-2 text-left">
              {completedStep ? <FactoryV2StepMoment label="Done" stepLabel={getSimpleStepTitle(completedStep)} /> : null}
              {currentStep ? <FactoryV2StepMoment label="Now" stepLabel={currentStepLabel} /> : null}
              {nextStep ? <FactoryV2StepMoment label="Next" stepLabel={getSimpleStepTitle(nextStep)} /> : null}
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
              {primaryAction ? (
                <button
                  type="button"
                  onClick={primaryAction.kind === "retry" ? onRetry : onContinue}
                  disabled={isWatcherBusy || Boolean(lookupDisabledReason)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    primaryAction.kind === "retry"
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : appearance.primaryButtonClassName,
                  )}
                >
                  {primaryAction.kind === "retry" ? <RotateCcw className="h-4 w-4" /> : null}
                  {isWatcherBusy ? "Checking..." : primaryAction.label}
                </button>
              ) : null}

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
            </div>

            {notice && !watcher ? <p className="text-sm leading-6 text-black/52">{notice}</p> : null}

            <button
              type="button"
              onClick={() => setShowAllSteps((open) => !open)}
              className="text-sm font-medium text-black/58 transition-colors hover:text-black"
            >
              {showAllSteps ? "Hide steps" : "See all steps"}
            </button>

            {showAllSteps ? (
              <div className="space-y-2 border-t border-black/8 pt-3 text-left">
                {selectedRun.steps.map((step) => (
                  <FactoryV2StepSummary key={step.id} step={step} />
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
            <div className="flex justify-center">
              <div className="rounded-full border border-amber-300/50 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                {watcher?.statusLabel ?? "Watching"}
              </div>
            </div>
            <h3 className="text-[1.2rem] font-semibold tracking-tight text-black">
              {watcher?.title ?? `Watching ${launchPlaceholderName}`}
            </h3>
            <p className="text-sm leading-6 text-black/56">
              {watcher?.detail ?? notice ?? "We are still waiting for the first live status update from the launcher."}
            </p>
            <FactoryV2LiveStatus pollingState={pollingState} liveStatusLabel={liveStatusLabel} />
            {notice ? <p className="text-sm leading-6 text-black/52">{notice}</p> : null}
            <div className={cn("rounded-[18px] px-4 py-3 text-left", appearance.quietSurfaceClassName)}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Now</div>
              <div className="mt-2 text-[15px] font-semibold text-black">Starting {launchPlaceholderName}</div>
              <p className="mt-2 text-sm leading-5 text-black/56">
                We are waiting for the first live status update from the launcher.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn("rounded-[26px] border p-5 text-center md:p-6", appearance.featureSurfaceClassName)}>
          <div className="text-sm leading-6 text-black/58">Type a game name and press Enter to check it.</div>
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
    <div
      className={cn(
        "h-2.5 w-2.5 rounded-full",
        pollingState.status === "idle"
          ? "bg-black/18"
          : pollingState.status === "paused"
          ? "bg-rose-400"
          : pollingState.status === "checking"
            ? "animate-pulse bg-amber-400"
            : "bg-emerald-400",
      )}
    />
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
    <div
      className={cn(
        "h-3 w-3 rounded-full",
        pollingState.status === "paused" ? "bg-rose-400" : "bg-amber-400",
      )}
    />
  </div>
);

const FactoryV2StepMoment = ({ label, stepLabel }: { label: string; stepLabel: string }) => (
  <div className="flex items-center justify-between rounded-[16px] border border-black/8 bg-black/[0.03] px-4 py-2.5">
    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">{label}</span>
    <span className="text-sm font-medium text-black/72">{stepLabel}</span>
  </div>
);

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

const FactoryV2StepSummary = ({ step }: { step: FactoryRun["steps"][number] }) => {
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
        <div className="mt-2 text-sm leading-6 text-black/56">{step.latestEvent}</div>
      </div>
    </div>
  );
};

function buildLiveStatusLabel(pollingState: FactoryPollingState) {
  if (pollingState.status === "paused") {
    return pollingState.detail;
  }

  if (pollingState.status === "checking") {
    return "Checking live status";
  }

  if (pollingState.lastCheckedAt) {
    return "Watching live";
  }

  return pollingState.detail;
}
