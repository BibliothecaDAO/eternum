import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import {
  getCompletedStep,
  getCurrentStep,
  getRunCurrentStepLabel,
  getEnvironmentLabel,
  getNextStep,
  getRunDetailMessage,
  getRunHeadline,
  getRunProgressLabel,
  getRunStatusHighlights,
  getRunStatusMeta,
  getSimpleStepTitle,
  getStepDetailMessage,
  getStepStatusMessage,
  getStepStatusMeta,
  resolveRunPrimaryAction,
  resolveRunProgressMetrics,
} from "../presenters";
import { canFundFactoryRunPrize } from "../prize-funding";
import type {
  FactoryGameMode,
  FactoryPollingState,
  FactoryRun,
  FactoryRunStepId,
  FactorySeriesChildStep,
  FactoryWatcherState,
} from "../types";
import { FactoryV2PrizeFundingCard } from "./factory-v2-prize-funding-card";

const FIRST_UPDATE_WAIT_MESSAGE = "This run just started. We are waiting for it to appear.";
const AUTO_UPDATE_LABEL = "Updating automatically";
const WATCH_SEARCH_EYEBROW = "Check a run";
const WATCH_SEARCH_TITLE = "Find a run";
const WATCH_SEARCH_DESCRIPTION = "Type the exact game, series, or rotation name or choose one from your recent runs.";
const WATCH_EMPTY_DESCRIPTION = "Type a run name and press Enter to check its status.";
const WATCH_TIMELINE_TITLE = "Setup progress";
const WATCH_TIMELINE_DESCRIPTION = "See what is done, what is happening now, and what comes next.";

type FactoryV2WatchWorkspaceProps = {
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
  onBringIndexerLive: () => void;
  onBringChildIndexerLive: (gameName: string) => void;
  onRefresh: () => void;
  onNudge: () => void;
  onStopAutoRetry: () => void;
  onFundPrize: (request: { amount: string; adminSecret: string; selectedGameNames: string[] }) => Promise<void> | void;
};

type FactoryV2WatchWorkspaceState = {
  matchingRuns: FactoryRun[];
  showsPendingRunState: boolean;
  isPendingSelectedRun: boolean;
  isAwaitingAcceptedUpdate: boolean;
  showsInFlightState: boolean;
  timelineRun: FactoryRun | null;
  statusMeta: ReturnType<typeof getRunStatusMeta> | null;
  currentStep: FactoryRun["steps"][number] | null;
  completedStep: FactoryRun["steps"][number] | null;
  nextStep: FactoryRun["steps"][number] | null;
  environmentLabel: string | null;
  currentStepLabel: string;
  detailMessage: string;
  headline: string;
  liveStatusLabel: string;
  searchNotice: string | null;
  secondaryNotice: string | null;
  launchPlaceholderName: string;
  actionBarProps: FactoryV2WatchActionBarProps | null;
};

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
  onBringIndexerLive,
  onBringChildIndexerLive,
  onRefresh,
  onNudge,
  onStopAutoRetry,
  onFundPrize,
}: FactoryV2WatchWorkspaceProps) => {
  const appearance = resolveFactoryModeAppearance(mode);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [showsPrizeFunding, setShowsPrizeFunding] = useState(false);
  const [watchGameName, setWatchGameName] = useState(selectedRun?.name ?? "");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFilteringRuns, setIsFilteringRuns] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowAllSteps(selectedRun?.status === "attention");
  }, [selectedRun?.id, selectedRun?.status]);

  useEffect(() => {
    setShowsPrizeFunding(false);
  }, [selectedRun?.id]);

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

  const state = resolveWatchWorkspaceState({
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
    watchGameName,
    isFilteringRuns,
    onContinue,
    onRefresh,
    onNudge,
    onStopAutoRetry,
    primaryButtonClassName: appearance.primaryButtonClassName,
    secondaryButtonClassName: appearance.secondaryButtonClassName,
  });
  const stepSummaryOptions = {
    isWatcherBusy,
    isBlocked: Boolean(lookupDisabledReason) || state.showsInFlightState,
    onBringIndexerLive,
  };
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

    const matchingRun = resolveMatchingRunByName(runs, watchGameName) ?? state.matchingRuns[0] ?? null;

    if (matchingRun) {
      chooseRun(matchingRun);
      return;
    }

    if (!lookupDisabledReason) {
      void onResolveRunByName(watchGameName);
    }
  };

  return (
    <article className="w-full space-y-3 pb-24 md:mx-auto md:max-w-md md:space-y-4 md:pb-0">
      <FactoryV2WatchSearchPanel
        appearanceClassName={appearance.quietSurfaceClassName}
        inputClassName={appearance.listItemClassName}
        pickerRef={pickerRef}
        watchGameName={watchGameName}
        matchingRuns={state.matchingRuns}
        isPickerOpen={isPickerOpen}
        lookupDisabledReason={lookupDisabledReason}
        isResolvingRunName={isResolvingRunName}
        searchNotice={state.searchNotice}
        onSelectRun={chooseRun}
        onTogglePicker={() => {
          setIsFilteringRuns(false);
          setIsPickerOpen((open) => !open);
        }}
        onFocusInput={() => {
          setIsFilteringRuns(false);
          setIsPickerOpen(true);
        }}
        onChangeInput={selectRunByName}
        onKeyDownInput={handleGameNameEnter}
      />

      <FactoryV2WatchWorkspaceContent
        appearance={appearance}
        selectedRun={selectedRun}
        state={state}
        watcher={watcher}
        pollingState={pollingState}
        notice={notice}
        showAllSteps={showAllSteps}
        stepSummaryOptions={stepSummaryOptions}
        onBringChildIndexerLive={onBringChildIndexerLive}
        showsPrizeFunding={showsPrizeFunding}
        onFundPrize={onFundPrize}
        onTogglePrizeFunding={() => setShowsPrizeFunding((current) => !current)}
        onToggleShowAllSteps={() => setShowAllSteps((open) => !open)}
      />
    </article>
  );
};

function resolveWatchWorkspaceState({
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
  watchGameName,
  isFilteringRuns,
  onContinue,
  onRefresh,
  onNudge,
  onStopAutoRetry,
  primaryButtonClassName,
  secondaryButtonClassName,
}: {
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
  watchGameName: string;
  isFilteringRuns: boolean;
  onContinue: () => void;
  onRefresh: () => void;
  onNudge: () => void;
  onStopAutoRetry: () => void;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
}): FactoryV2WatchWorkspaceState {
  const matchingRuns = resolveMatchingRunsByName(runs, isFilteringRuns ? watchGameName : "");
  const showsPendingRunState = Boolean(watcher) || Boolean(activeRunName) || pollingState.status !== "idle";
  const isPendingSelectedRun = Boolean(selectedRun && selectedRun.id.startsWith("pending:"));
  const isAwaitingAcceptedUpdate = Boolean(acceptedRunMessage);
  const showsInFlightState = isPendingSelectedRun || isAwaitingAcceptedUpdate;
  const timelineRun = selectedRun ? buildWatchTimelineRun(selectedRun) : null;
  const statusMeta = selectedRun ? getRunStatusMeta(selectedRun.status) : null;
  const currentStep = timelineRun ? getCurrentStep(timelineRun) : null;
  const completedStep = timelineRun ? getCompletedStep(timelineRun) : null;
  const nextStep = timelineRun ? getNextStep(timelineRun) : null;
  const searchNotice = resolveWatchSearchNotice({
    notice,
    selectedRun,
    watchGameName,
    watcher,
    isResolvingRunName,
    lookupDisabledReason,
  });
  const runNotice = searchNotice ? null : notice;
  const primaryAction = selectedRun && !isWatcherBusy ? resolveRunPrimaryAction(selectedRun) : null;
  const environmentLabel = selectedRun ? getEnvironmentLabel(selectedRun.environment) : null;
  const currentStepLabel = isPendingSelectedRun
    ? `Starting ${selectedRun?.name ?? "your run"}`
    : selectedRun
      ? getRunCurrentStepLabel(timelineRun ?? selectedRun)
      : "Everything is ready";
  const detailMessage = selectedRun
    ? isPendingSelectedRun
      ? (watcher?.detail ?? FIRST_UPDATE_WAIT_MESSAGE)
      : (acceptedRunMessage ?? watcher?.detail ?? runNotice ?? getRunDetailMessage(timelineRun ?? selectedRun))
    : WATCH_EMPTY_DESCRIPTION;
  const headline = selectedRun
    ? isPendingSelectedRun
      ? `Launching ${selectedRun.name}`
      : isAwaitingAcceptedUpdate
        ? "Got it"
        : getRunHeadline(timelineRun ?? selectedRun)
    : (watcher?.title ?? WATCH_SEARCH_TITLE);
  const liveStatusLabel = buildLiveStatusLabel(pollingState, isPendingSelectedRun, selectedRun);
  const launchPlaceholderName = activeRunName || watchGameName.trim() || "your run";
  const visiblePrimaryAction = shouldShowPrimaryRunAction(selectedRun, primaryAction, isAwaitingAcceptedUpdate)
    ? primaryAction
    : null;
  const showsNudgeAction = shouldShowRotationNudgeAction(selectedRun, isAwaitingAcceptedUpdate);
  const showsStopAutoRetryAction = shouldShowStopAutoRetryAction(selectedRun, isAwaitingAcceptedUpdate);
  const showsManualRefresh =
    !isAwaitingAcceptedUpdate && pollingState.status !== "checking" && pollingState.status !== "live";
  const secondaryNotice = runNotice && runNotice !== detailMessage && !watcher ? runNotice : null;
  const showsActionBar = Boolean(
    visiblePrimaryAction || showsManualRefresh || showsNudgeAction || showsStopAutoRetryAction,
  );

  return {
    matchingRuns,
    showsPendingRunState,
    isPendingSelectedRun,
    isAwaitingAcceptedUpdate,
    showsInFlightState,
    timelineRun,
    statusMeta,
    currentStep,
    completedStep,
    nextStep,
    environmentLabel,
    currentStepLabel,
    detailMessage,
    headline,
    liveStatusLabel,
    searchNotice,
    secondaryNotice,
    launchPlaceholderName,
    actionBarProps: showsActionBar
      ? {
          visiblePrimaryAction,
          showsManualRefresh,
          showsNudgeAction,
          showsStopAutoRetryAction,
          isWatcherBusy,
          isBlocked: Boolean(lookupDisabledReason),
          primaryButtonClassName,
          secondaryButtonClassName,
          onContinue,
          onRefresh,
          onNudge,
          onStopAutoRetry,
        }
      : null,
  };
}

const FactoryV2WatchWorkspaceContent = ({
  appearance,
  selectedRun,
  state,
  watcher,
  pollingState,
  notice,
  showAllSteps,
  stepSummaryOptions,
  onBringChildIndexerLive,
  showsPrizeFunding,
  onFundPrize,
  onTogglePrizeFunding,
  onToggleShowAllSteps,
}: {
  appearance: ReturnType<typeof resolveFactoryModeAppearance>;
  selectedRun: FactoryRun | null;
  state: FactoryV2WatchWorkspaceState;
  watcher: FactoryWatcherState | null;
  pollingState: FactoryPollingState;
  notice: string | null;
  showAllSteps: boolean;
  stepSummaryOptions: FactoryV2StepSummaryActionOptions;
  onBringChildIndexerLive: (gameName: string) => void;
  showsPrizeFunding: boolean;
  onFundPrize: (request: { amount: string; adminSecret: string; selectedGameNames: string[] }) => Promise<void> | void;
  onTogglePrizeFunding: () => void;
  onToggleShowAllSteps: () => void;
}) => {
  if (selectedRun) {
    return (
      <FactoryV2WatchRunCard
        appearance={appearance}
        selectedRun={selectedRun}
        timelineRun={state.timelineRun ?? selectedRun}
        environmentLabel={state.environmentLabel}
        showsInFlightState={state.showsInFlightState}
        headline={state.headline}
        pollingState={pollingState}
        liveStatusLabel={state.liveStatusLabel}
        currentStepLabel={state.currentStepLabel}
        detailMessage={state.detailMessage}
        statusHighlights={getRunStatusHighlights(selectedRun)}
        completedStep={state.completedStep}
        currentStep={state.currentStep}
        nextStep={state.nextStep}
        secondaryNotice={state.secondaryNotice}
        showAllSteps={showAllSteps}
        statusMeta={state.statusMeta}
        actionBarProps={state.actionBarProps}
        stepSummaryOptions={stepSummaryOptions}
        onBringChildIndexerLive={onBringChildIndexerLive}
        showsPrizeFunding={showsPrizeFunding}
        onFundPrize={onFundPrize}
        onTogglePrizeFunding={onTogglePrizeFunding}
        onToggleShowAllSteps={onToggleShowAllSteps}
      />
    );
  }

  if (state.showsPendingRunState) {
    return (
      <FactoryV2WatchPendingCard
        appearance={appearance}
        launchPlaceholderName={state.launchPlaceholderName}
        pollingState={pollingState}
        headline={watcher?.title ?? `Opening ${state.launchPlaceholderName}`}
        primaryNotice={watcher?.detail ?? notice ?? FIRST_UPDATE_WAIT_MESSAGE}
        secondaryNotice={notice && notice !== (watcher?.detail ?? FIRST_UPDATE_WAIT_MESSAGE) ? notice : null}
      />
    );
  }

  return <FactoryV2WatchEmptyCard appearanceClassName={appearance.featureSurfaceClassName} />;
};

const FactoryV2WatchRunCard = ({
  appearance,
  selectedRun,
  timelineRun,
  environmentLabel,
  showsInFlightState,
  headline,
  pollingState,
  liveStatusLabel,
  currentStepLabel,
  detailMessage,
  statusHighlights,
  completedStep,
  currentStep,
  nextStep,
  secondaryNotice,
  showAllSteps,
  statusMeta,
  actionBarProps,
  stepSummaryOptions,
  onBringChildIndexerLive,
  showsPrizeFunding,
  onFundPrize,
  onTogglePrizeFunding,
  onToggleShowAllSteps,
}: {
  appearance: ReturnType<typeof resolveFactoryModeAppearance>;
  selectedRun: FactoryRun;
  timelineRun: FactoryRun;
  environmentLabel: string | null;
  showsInFlightState: boolean;
  headline: string;
  pollingState: FactoryPollingState;
  liveStatusLabel: string;
  currentStepLabel: string;
  detailMessage: string;
  statusHighlights: string[];
  completedStep: FactoryRun["steps"][number] | null;
  currentStep: FactoryRun["steps"][number] | null;
  nextStep: FactoryRun["steps"][number] | null;
  secondaryNotice: string | null;
  showAllSteps: boolean;
  statusMeta: ReturnType<typeof getRunStatusMeta> | null;
  actionBarProps: FactoryV2WatchActionBarProps | null;
  stepSummaryOptions: FactoryV2StepSummaryActionOptions;
  onBringChildIndexerLive: (gameName: string) => void;
  showsPrizeFunding: boolean;
  onFundPrize: (request: { amount: string; adminSecret: string; selectedGameNames: string[] }) => Promise<void> | void;
  onTogglePrizeFunding: () => void;
  onToggleShowAllSteps: () => void;
}) => (
  <FactoryV2WatchSurfaceCard
    appearanceClassName={appearance.featureSurfaceClassName}
    artGlowClassName={appearance.artGlowClassName}
    dataTestId="factory-watch-selected-panel"
  >
    <div className="space-y-4 md:space-y-5">
      <div className="mx-auto max-w-sm space-y-3 text-center">
        {showsInFlightState ? (
          <div className="flex justify-center">
            <FactoryV2LoaderHalo pollingState={pollingState} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
          <span className="max-w-full truncate rounded-full border border-black/8 bg-white/62 px-3 py-1 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            {selectedRun.name}
          </span>
          {environmentLabel ? (
            <span className="rounded-full border border-black/8 bg-white/45 px-3 py-1">{environmentLabel}</span>
          ) : null}
        </div>

        {!showsInFlightState && statusMeta ? (
          <div className="flex justify-center">
            <div
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
                statusMeta.className,
              )}
            >
              {statusMeta.label}
            </div>
          </div>
        ) : null}

        <h3 className="text-[1.4rem] font-semibold tracking-tight text-black">{headline}</h3>

        {!showsInFlightState ? (
          <FactoryV2LiveStatus pollingState={pollingState} liveStatusLabel={liveStatusLabel} />
        ) : null}
      </div>

      <FactoryV2CurrentStepCard
        appearanceClassName={appearance.quietSurfaceClassName}
        timelineRun={timelineRun}
        currentStep={currentStep}
        currentStepLabel={currentStepLabel}
        detailMessage={detailMessage}
        statusHighlights={statusHighlights}
      />

      {selectedRun.kind === "series" ? (
        <>
          <FactoryV2AutoRetryCard autoRetry={selectedRun.autoRetry} />
          <FactoryV2MultiGameChildrenCard
            kind={selectedRun.kind}
            children={selectedRun.children ?? []}
            canManageIndexers={!isFactoryRunInProgress(selectedRun) && !Boolean(actionBarProps?.isWatcherBusy)}
            onBringChildIndexerLive={onBringChildIndexerLive}
          />
        </>
      ) : null}

      {selectedRun.kind === "rotation" ? (
        <>
          <FactoryV2AutoRetryCard autoRetry={selectedRun.autoRetry} />
          <FactoryV2RotationScheduleCard run={selectedRun} />
          <FactoryV2MultiGameChildrenCard
            kind={selectedRun.kind}
            children={selectedRun.children ?? []}
            canManageIndexers={!isFactoryRunInProgress(selectedRun) && !Boolean(actionBarProps?.isWatcherBusy)}
            onBringChildIndexerLive={onBringChildIndexerLive}
          />
        </>
      ) : null}

      {canFundFactoryRunPrize(selectedRun) ? (
        <FactoryV2PrizeFundingSection
          run={selectedRun}
          isBusy={Boolean(actionBarProps?.isWatcherBusy)}
          showsPrizeFunding={showsPrizeFunding}
          onSubmit={onFundPrize}
          onTogglePrizeFunding={onTogglePrizeFunding}
        />
      ) : null}

      <div className="space-y-2.5">
        <div className="mx-auto max-w-sm space-y-1 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">
            {WATCH_TIMELINE_TITLE}
          </div>
          <p className="text-[13px] leading-5 text-black/52">{WATCH_TIMELINE_DESCRIPTION}</p>
        </div>
        <div className="grid gap-2">
          {completedStep ? (
            <FactoryV2StepMoment label="Done" stepLabel={getSimpleStepTitle(completedStep)} tone="done" />
          ) : null}
          {currentStep ? <FactoryV2StepMoment label="Now" stepLabel={currentStepLabel} tone="now" /> : null}
          {nextStep ? (
            <FactoryV2StepMoment label="Up next" stepLabel={getSimpleStepTitle(nextStep)} tone="next" />
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-center text-[13px] text-black/54">{getRunProgressLabel(timelineRun)}</div>
        <FactoryV2SegmentedProgressTrack steps={timelineRun.steps} />
      </div>

      {actionBarProps ? <FactoryV2WatchActionBar {...actionBarProps} /> : null}

      {secondaryNotice ? <p className="text-center text-sm leading-6 text-black/52">{secondaryNotice}</p> : null}

      <button
        type="button"
        onClick={onToggleShowAllSteps}
        className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white/58 px-4 py-3 text-sm font-medium text-black/68 transition-colors hover:bg-white/72 hover:text-black"
      >
        {showAllSteps ? "Hide details" : "See details"}
      </button>

      {showAllSteps ? (
        <div className="space-y-2 rounded-[24px] border border-black/8 bg-white/38 p-3 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          {timelineRun.steps.map((step) => (
            <FactoryV2StepSummary
              key={step.id}
              step={step}
              manualAction={resolveStepSummaryAction(step, stepSummaryOptions)}
            />
          ))}
        </div>
      ) : null}
    </div>
  </FactoryV2WatchSurfaceCard>
);

const FactoryV2PrizeFundingSection = ({
  run,
  isBusy,
  showsPrizeFunding,
  onSubmit,
  onTogglePrizeFunding,
}: {
  run: FactoryRun;
  isBusy: boolean;
  showsPrizeFunding: boolean;
  onSubmit: (request: { amount: string; adminSecret: string; selectedGameNames: string[] }) => Promise<void> | void;
  onTogglePrizeFunding: () => void;
}) => (
  <div className="space-y-2">
    <button
      type="button"
      data-testid="factory-prize-toggle"
      onClick={onTogglePrizeFunding}
      className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white/58 px-4 py-3 text-sm font-medium text-black/68 transition-colors hover:bg-white/72 hover:text-black"
    >
      {showsPrizeFunding ? "Hide prize funding" : "Open prize funding"}
    </button>
    {showsPrizeFunding ? <FactoryV2PrizeFundingCard run={run} isBusy={isBusy} onSubmit={onSubmit} /> : null}
  </div>
);

const FactoryV2CurrentStepCard = ({
  appearanceClassName,
  timelineRun,
  currentStep,
  currentStepLabel,
  detailMessage,
  statusHighlights,
}: {
  appearanceClassName: string;
  timelineRun: FactoryRun;
  currentStep: FactoryRun["steps"][number] | null;
  currentStepLabel: string;
  detailMessage: string;
  statusHighlights: string[];
}) => {
  const progress = resolveWatchProgressMetrics(timelineRun, currentStep);
  const isRunningStep = currentStep?.status === "running";
  const statusLabel = resolveCurrentStepStatusLabel(currentStep, timelineRun.status);
  const progressFillClassName = resolveCurrentProgressFillClassName(isRunningStep, timelineRun.status);

  return (
    <div
      className={cn(
        "rounded-[24px] border border-black/8 px-4 py-4 text-center shadow-[0_16px_36px_rgba(30,20,10,0.08)]",
        appearanceClassName,
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em]">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1",
            isRunningStep
              ? "border-[#c4a173]/75 bg-[rgba(255,250,244,0.94)] text-[#6b4a24] shadow-[0_6px_16px_rgba(90,62,29,0.08)]"
              : "border-black/8 bg-white/60 text-black/44",
          )}
        >
          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
            <span className={cn("relative h-2.5 w-2.5 rounded-full", isRunningStep ? "bg-[#8b5b2e]" : "bg-black/28")} />
          </span>
          {statusLabel}
        </span>
        <span className="text-black/42">{progress.stepLabel}</span>
      </div>
      <div className="mt-3 text-[15px] font-semibold text-black">{currentStepLabel}</div>
      <p className="mt-2 text-sm leading-6 text-black/56">{detailMessage}</p>
      {statusHighlights.length > 0 ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {statusHighlights.map((highlight) => (
            <span
              key={highlight}
              className="rounded-full border border-black/8 bg-white/72 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/48"
            >
              {highlight}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-black/46">
          <span>{progress.progressLabel}</span>
          <span>{progress.percentLabel}</span>
        </div>
        <div
          data-testid="factory-watch-current-progress-track"
          className="relative h-2 overflow-hidden rounded-full bg-[#d9cabd]"
        >
          <div
            data-testid="factory-watch-current-progress-fill"
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
              progressFillClassName,
            )}
            style={{ width: `${progress.completionPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const FactoryV2AutoRetryCard = ({ autoRetry }: { autoRetry: FactoryRun["autoRetry"] }) => {
  if (!autoRetry?.enabled) {
    return null;
  }

  const statusLabel = autoRetry.cancelledAt
    ? "Auto-retry cancelled"
    : autoRetry.nextRetryAt
      ? `Next retry ${formatRunTimestamp(autoRetry.nextRetryAt)}`
      : `Retrying every ${autoRetry.intervalMinutes} minutes`;

  return (
    <div className="rounded-[22px] border border-black/8 bg-white/40 px-4 py-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Auto-retry</div>
      <p className="mt-2 text-sm leading-6 text-black/56">{statusLabel}</p>
    </div>
  );
};

const FactoryV2RotationScheduleCard = ({ run }: { run: FactoryRun }) => {
  if (run.kind !== "rotation" || !run.rotation || !run.evaluation) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-[24px] border border-black/8 bg-white/40 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="mx-auto max-w-sm space-y-1 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Rotation schedule</div>
        <p className="text-[13px] leading-5 text-black/52">
          This rotation keeps future games queued ahead until it reaches its maximum size.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <FactoryV2RotationMetric
          label="Created"
          value={`${run.rotation.createdGameCount} of ${run.rotation.maxGames}`}
        />
        <FactoryV2RotationMetric label="Queued ahead" value={`${run.rotation.queuedGameCount} games`} />
        <FactoryV2RotationMetric label="Game interval" value={`Every ${run.rotation.gameIntervalMinutes} minutes`} />
        <FactoryV2RotationMetric
          label="Next evaluation"
          value={
            run.evaluation.nextEvaluationAt
              ? formatRunTimestamp(run.evaluation.nextEvaluationAt)
              : `Every ${run.evaluation.intervalMinutes} minutes`
          }
        />
      </div>
    </div>
  );
};

const FactoryV2RotationMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[18px] border border-black/8 bg-white/62 px-3 py-3 text-center">
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">{label}</div>
    <div className="mt-1 text-[13px] font-semibold text-black">{value}</div>
  </div>
);

const FactoryV2MultiGameChildrenCard = ({
  kind,
  children,
  canManageIndexers,
  onBringChildIndexerLive,
}: {
  kind: FactoryRun["kind"];
  children: FactoryRun["children"];
  canManageIndexers: boolean;
  onBringChildIndexerLive: (gameName: string) => void;
}) => {
  if (!children || children.length === 0) {
    return null;
  }

  const copy = resolveMultiGameChildrenCopy(kind);

  return (
    <div className="space-y-2 rounded-[24px] border border-black/8 bg-white/40 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="mx-auto max-w-sm space-y-1 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">{copy.title}</div>
        <p className="text-[13px] leading-5 text-black/52">{copy.description}</p>
      </div>
      <div className="space-y-2">
        {children.map((child) => {
          const indexerAction = resolveChildIndexerAction(child, canManageIndexers, onBringChildIndexerLive);
          const stepGroups = resolveChildStepGroups(child);
          const errorMessage = resolveChildErrorMessage(child, stepGroups.failed);
          const fallbackSummary = resolveChildFallbackSummary(child, stepGroups);

          return (
            <div
              key={child.id}
              className="space-y-3 rounded-[18px] border border-black/8 bg-white/62 px-3 py-3 text-left"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-black/8 bg-white/72 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/48">
                      Game {child.seriesGameNumber}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-black">{child.gameName}</span>
                  </div>
                  {fallbackSummary ? (
                    <p className="mt-1 text-[12px] leading-5 text-black/50">{fallbackSummary}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 self-start">
                  {indexerAction ? (
                    <button
                      type="button"
                      onClick={indexerAction.onPress}
                      className="rounded-full border border-black/10 bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white"
                    >
                      {indexerAction.label}
                    </button>
                  ) : null}
                  <div className="rounded-full border border-black/8 bg-white/72 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/52">
                    {resolveChildStatusLabel(child.status)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {stepGroups.completed.length > 0 ? (
                  <FactoryV2ChildStepGroup label="Done" steps={stepGroups.completed} tone="done" />
                ) : null}
                {stepGroups.current.length > 0 ? (
                  <FactoryV2ChildStepGroup label="Now" steps={stepGroups.current} tone="current" />
                ) : null}
                {stepGroups.pending.length > 0 ? (
                  <FactoryV2ChildStepGroup label="Pending" steps={stepGroups.pending} tone="pending" />
                ) : null}
                {stepGroups.failed.length > 0 ? (
                  <FactoryV2ChildStepGroup label="Needs attention" steps={stepGroups.failed} tone="failed" />
                ) : null}
                {errorMessage ? (
                  <FactoryV2CopyableMessageBox
                    label="Error details"
                    message={errorMessage}
                    dataTestId={`factory-child-error-${child.gameName}`}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function resolveMultiGameChildrenCopy(kind: FactoryRun["kind"]) {
  if (kind === "rotation") {
    return {
      title: "Rotation games",
      description: "See which queued games are ready, still moving, or need help inside this rotation.",
    };
  }

  return {
    title: "Series games",
    description: "See which child games are ready, still moving, or need help inside this series.",
  };
}

function resolveChildIndexerAction(
  child: NonNullable<FactoryRun["children"]>[number],
  canManageIndexers: boolean,
  onBringChildIndexerLive: (gameName: string) => void,
): FactoryV2StepManualAction | null {
  if (!canManageIndexers || !canOperateOnChildIndexer(child)) {
    return null;
  }

  return {
    label: resolveChildIndexerActionLabel(child),
    description: "Check whether this game indexer is live or bring it back online.",
    onPress: () => onBringChildIndexerLive(child.gameName),
  };
}

function canOperateOnChildIndexer(child: NonNullable<FactoryRun["children"]>[number]) {
  return Boolean(child.worldAddress || child.indexerCreated);
}

function resolveChildIndexerActionLabel(child: NonNullable<FactoryRun["children"]>[number]) {
  if (child.indexerCreated) {
    return "Check indexer";
  }

  if (child.currentStepId === "create-indexers" || child.status === "failed") {
    return "Retry indexer";
  }

  return "Turn on indexer";
}

function resolveChildStepGroups(child: NonNullable<FactoryRun["children"]>[number]) {
  const steps = resolveChildTimelineSteps(child);

  return {
    completed: steps.filter((step) => step.status === "succeeded" || step.status === "already_done"),
    current: steps.filter((step) => step.status === "running"),
    pending: steps.filter((step) => step.status === "pending"),
    failed: steps.filter((step) => step.status === "blocked" || step.status === "failed"),
  };
}

const HIDDEN_CHILD_STEP_IDS = new Set<FactoryRunStepId>([
  "launch-request",
  "create-series",
  "wait-factory-index",
  "wait-for-factory-index",
  "wait-for-factory-indexes",
]);

function resolveChildTimelineSteps(child: NonNullable<FactoryRun["children"]>[number]): FactorySeriesChildStep[] {
  if (child.steps.length > 0) {
    return child.steps.filter((step) => shouldShowChildTimelineStep(step.id));
  }

  if (!child.currentStepId || !shouldShowChildTimelineStep(child.currentStepId)) {
    return [];
  }

  return [
    {
      id: child.currentStepId,
      status: resolveChildStepStatusFromChildStatus(child.status),
      latestEvent: child.latestEvent,
    },
  ];
}

function shouldShowChildTimelineStep(stepId: FactoryRunStepId) {
  return !HIDDEN_CHILD_STEP_IDS.has(stepId);
}

function resolveChildStepStatusFromChildStatus(status: NonNullable<FactoryRun["children"]>[number]["status"]) {
  switch (status) {
    case "failed":
      return "failed" as const;
    case "running":
      return "running" as const;
    case "succeeded":
      return "succeeded" as const;
    case "pending":
    default:
      return "pending" as const;
  }
}

function resolveChildFallbackSummary(
  child: NonNullable<FactoryRun["children"]>[number],
  stepGroups: ReturnType<typeof resolveChildStepGroups>,
) {
  const showsAnyStepGroup =
    stepGroups.completed.length > 0 ||
    stepGroups.current.length > 0 ||
    stepGroups.pending.length > 0 ||
    stepGroups.failed.length > 0;

  if (showsAnyStepGroup) {
    return null;
  }

  return normalizeCopyableMessage(child.latestEvent);
}

function resolveChildErrorMessage(
  child: NonNullable<FactoryRun["children"]>[number],
  failedSteps: FactorySeriesChildStep[],
) {
  for (const step of failedSteps) {
    const message = resolveChildStepErrorMessage(step);
    if (message) {
      return message;
    }
  }

  if (child.status !== "failed") {
    return null;
  }

  return normalizeCopyableMessage(child.latestEvent);
}

function resolveChildStepErrorMessage(step: FactorySeriesChildStep) {
  if (step.status !== "failed" && step.status !== "blocked") {
    return null;
  }

  return normalizeCopyableMessage(step.errorMessage || step.latestEvent);
}

function resolveChildStatusLabel(status: NonNullable<FactoryRun["children"]>[number]["status"]) {
  switch (status) {
    case "succeeded":
      return "Ready";
    case "running":
      return "Working";
    case "failed":
      return "Failed";
    case "pending":
    default:
      return "Pending";
  }
}

const FactoryV2ChildStepGroup = ({
  label,
  steps,
  tone,
}: {
  label: string;
  steps: FactorySeriesChildStep[];
  tone: "done" | "current" | "pending" | "failed";
}) => (
  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
    <div
      className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", resolveChildStepGroupLabelClassName(tone))}
    >
      {label}
    </div>
    <div className="flex flex-wrap gap-1.5">
      {steps.map((step) => (
        <span
          key={`${step.id}-${step.status}`}
          className={cn(
            "rounded-full border px-2 py-1 text-[10px] font-medium leading-4",
            resolveChildStepChipClassName(tone),
          )}
        >
          {getSimpleStepTitle({ id: step.id, title: step.id })}
        </span>
      ))}
    </div>
  </div>
);

function resolveChildStepGroupLabelClassName(tone: "done" | "current" | "pending" | "failed") {
  switch (tone) {
    case "done":
      return "text-black/42";
    case "current":
      return "text-[#7a4b22]";
    case "failed":
      return "text-rose-700";
    case "pending":
    default:
      return "text-black/44";
  }
}

function resolveChildStepChipClassName(tone: "done" | "current" | "pending" | "failed") {
  switch (tone) {
    case "done":
      return "border-black/8 bg-black/[0.04] text-black/56";
    case "current":
      return "border-[#d4b487]/65 bg-[rgba(255,249,239,0.92)] text-[#7a4b22]";
    case "failed":
      return "border-rose-300/60 bg-rose-50 text-rose-700";
    case "pending":
    default:
      return "border-black/8 bg-white/68 text-black/50";
  }
}

const FactoryV2WatchPendingCard = ({
  appearance,
  launchPlaceholderName,
  pollingState,
  headline,
  primaryNotice,
  secondaryNotice,
}: {
  appearance: ReturnType<typeof resolveFactoryModeAppearance>;
  launchPlaceholderName: string;
  pollingState: FactoryPollingState;
  headline: string;
  primaryNotice: string;
  secondaryNotice: string | null;
}) => (
  <FactoryV2WatchSurfaceCard
    appearanceClassName={appearance.featureSurfaceClassName}
    dataTestId="factory-watch-pending-panel"
  >
    <div className="mx-auto max-w-sm space-y-4 text-center">
      <div className="flex justify-center">
        <FactoryV2LoaderHalo pollingState={pollingState} />
      </div>
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42">
          {WATCH_SEARCH_EYEBROW}
        </div>
        <h3 className="text-[1.2rem] font-semibold tracking-tight text-black">{headline}</h3>
      </div>
      <p className="text-sm leading-6 text-black/56">{primaryNotice}</p>
      {secondaryNotice ? <p className="text-sm leading-6 text-black/52">{secondaryNotice}</p> : null}
      <div
        className={cn(
          "rounded-[22px] border border-black/8 px-4 py-4 text-center shadow-[0_14px_34px_rgba(30,20,10,0.07)]",
          appearance.quietSurfaceClassName,
        )}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Now</div>
        <div className="mt-2 text-[15px] font-semibold text-black">Opening {launchPlaceholderName}</div>
        <p className="mt-2 text-sm leading-6 text-black/56">{FIRST_UPDATE_WAIT_MESSAGE}</p>
      </div>
    </div>
  </FactoryV2WatchSurfaceCard>
);

const FactoryV2WatchEmptyCard = ({ appearanceClassName }: { appearanceClassName: string }) => (
  <FactoryV2WatchSurfaceCard appearanceClassName={appearanceClassName} dataTestId="factory-watch-empty-panel">
    <div className="mx-auto max-w-sm space-y-3 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42">{WATCH_SEARCH_EYEBROW}</div>
      <h3 className="text-[1.15rem] font-semibold tracking-tight text-black">{WATCH_SEARCH_TITLE}</h3>
      <p className="text-sm leading-6 text-black/56">{WATCH_EMPTY_DESCRIPTION}</p>
    </div>
  </FactoryV2WatchSurfaceCard>
);

const FactoryV2WatchSurfaceCard = ({
  appearanceClassName,
  artGlowClassName,
  dataTestId,
  children,
}: {
  appearanceClassName: string;
  artGlowClassName?: string;
  dataTestId: string;
  children: ReactNode;
}) => (
  <div
    data-testid={dataTestId}
    className={cn(
      "relative overflow-hidden rounded-[30px] border border-black/8 px-4 py-5 shadow-[0_20px_46px_rgba(30,20,10,0.11)] sm:px-5 sm:py-6 md:rounded-[28px] md:px-6 md:py-7",
      appearanceClassName,
    )}
  >
    {artGlowClassName ? (
      <div
        className={cn(
          "pointer-events-none absolute right-[-3rem] top-[-3rem] h-28 w-28 rounded-full blur-3xl",
          artGlowClassName,
        )}
      />
    ) : null}
    <div className="relative">{children}</div>
  </div>
);

const FactoryV2LiveStatus = ({
  pollingState,
  liveStatusLabel,
}: {
  pollingState: FactoryPollingState;
  liveStatusLabel: string;
}) => (
  <div className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-black/8 bg-white/45 px-3 py-1.5 text-[12px] text-black/52">
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

const FactoryV2WatchSearchPanel = ({
  appearanceClassName,
  inputClassName,
  pickerRef,
  watchGameName,
  matchingRuns,
  isPickerOpen,
  lookupDisabledReason,
  isResolvingRunName,
  searchNotice,
  onSelectRun,
  onTogglePicker,
  onFocusInput,
  onChangeInput,
  onKeyDownInput,
}: {
  appearanceClassName: string;
  inputClassName: string;
  pickerRef: RefObject<HTMLDivElement>;
  watchGameName: string;
  matchingRuns: FactoryRun[];
  isPickerOpen: boolean;
  lookupDisabledReason: string | null;
  isResolvingRunName: boolean;
  searchNotice: string | null;
  onSelectRun: (run: FactoryRun) => void;
  onTogglePicker: () => void;
  onFocusInput: () => void;
  onChangeInput: (value: string) => void;
  onKeyDownInput: (event: KeyboardEvent<HTMLInputElement>) => void;
}) => (
  <div
    data-testid="factory-watch-search-panel"
    className={cn(
      "rounded-[28px] border border-black/8 px-4 py-4 text-left shadow-[0_16px_40px_rgba(30,20,10,0.08)] sm:px-5",
      appearanceClassName,
    )}
  >
    <div className="mx-auto max-w-sm space-y-2 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42">{WATCH_SEARCH_EYEBROW}</div>
      <h3 className="text-[1.15rem] font-semibold tracking-tight text-black">{WATCH_SEARCH_TITLE}</h3>
      <p className="text-sm leading-6 text-black/54">{WATCH_SEARCH_DESCRIPTION}</p>
    </div>
    <div className="mx-auto mt-4 max-w-sm space-y-2 text-center">
      <label
        htmlFor="factory-watch-game"
        className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42"
      >
        Run name
      </label>
      <div ref={pickerRef} className="relative">
        <input
          id="factory-watch-game"
          value={watchGameName}
          onChange={(event) => onChangeInput(event.target.value)}
          onFocus={onFocusInput}
          onKeyDown={onKeyDownInput}
          placeholder="Type a run name"
          disabled={Boolean(lookupDisabledReason)}
          className={cn(
            "h-11 w-full rounded-[18px] border border-black/10 bg-white/78 px-4 pr-10 text-center text-sm font-medium text-black outline-none transition-colors placeholder:text-black/30 focus:border-black/25",
            lookupDisabledReason ? "cursor-not-allowed opacity-60" : "",
            inputClassName,
          )}
        />
        <button
          type="button"
          onClick={onTogglePicker}
          disabled={Boolean(lookupDisabledReason)}
          className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/[0.04] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", isPickerOpen ? "rotate-180" : "")} />
        </button>
        {isPickerOpen && matchingRuns.length > 0 ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[20px] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,238,228,0.96))] shadow-[0_18px_48px_rgba(30,20,10,0.16)] backdrop-blur-xl">
            <div className="border-b border-black/6 px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.24em] text-black/34">
              Recent runs
            </div>
            <div className="max-h-60 overflow-y-auto p-1.5">
              {matchingRuns.slice(0, 6).map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelectRun(run)}
                  className="flex w-full flex-col items-start gap-1.5 rounded-[14px] border border-transparent bg-white/48 px-3 py-2.5 text-left text-[13px] text-black transition-colors hover:border-black/6 hover:bg-black/[0.035] sm:flex-row sm:items-center sm:justify-between"
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
      {lookupDisabledReason ? <p className="text-sm leading-6 text-black/50">{lookupDisabledReason}</p> : null}
      {isResolvingRunName ? <p className="text-sm leading-6 text-black/50">Looking for that run.</p> : null}
      {searchNotice ? <FactoryV2SearchNotice message={searchNotice} /> : null}
      {!lookupDisabledReason && !isResolvingRunName && !searchNotice ? (
        <p className="text-sm leading-6 text-black/46">Press Enter to check its status.</p>
      ) : null}
    </div>
  </div>
);

const FactoryV2SearchNotice = ({ message }: { message: string }) => (
  <div className="rounded-[16px] border border-rose-300/50 bg-rose-50/80 px-3 py-2.5 text-sm leading-6 text-rose-700 shadow-[0_10px_24px_rgba(190,24,93,0.06)]">
    {message}
  </div>
);

const FactoryV2WatchActionBar = ({
  visiblePrimaryAction,
  showsManualRefresh,
  showsNudgeAction,
  showsStopAutoRetryAction,
  isWatcherBusy,
  isBlocked,
  primaryButtonClassName,
  secondaryButtonClassName,
  onContinue,
  onRefresh,
  onNudge,
  onStopAutoRetry,
}: FactoryV2WatchActionBarProps) => (
  <div
    data-testid="factory-watch-action-bar"
    className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-[24px] border border-black/10 bg-white/72 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_18px_42px_rgba(23,15,8,0.14)] backdrop-blur-xl md:static md:flex-row md:rounded-[20px] md:border-black/8 md:bg-transparent md:px-0 md:py-0 md:shadow-none md:backdrop-blur-0"
  >
    {visiblePrimaryAction ? (
      <button
        type="button"
        onClick={onContinue}
        disabled={isWatcherBusy || isBlocked}
        className={cn(
          "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          primaryButtonClassName,
        )}
      >
        {visiblePrimaryAction.label}
      </button>
    ) : null}

    {showsManualRefresh ? (
      <button
        type="button"
        onClick={onRefresh}
        disabled={isWatcherBusy || isBlocked}
        className={cn(
          "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          secondaryButtonClassName,
        )}
      >
        <RefreshCw className="h-4 w-4" />
        Check again
      </button>
    ) : null}

    {showsNudgeAction ? (
      <button
        type="button"
        onClick={onNudge}
        disabled={isWatcherBusy || isBlocked}
        className={cn(
          "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          secondaryButtonClassName,
        )}
      >
        <RefreshCw className="h-4 w-4" />
        Run now
      </button>
    ) : null}

    {showsStopAutoRetryAction ? (
      <button
        type="button"
        onClick={onStopAutoRetry}
        disabled={isWatcherBusy || isBlocked}
        className={cn(
          "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          "bg-rose-600 text-white hover:bg-rose-700",
        )}
      >
        <RotateCcw className="h-4 w-4" />
        Stop auto retry
      </button>
    ) : null}
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
  const toneAppearance = resolveStepMomentToneAppearance(tone);

  return (
    <div
      data-step-tone={tone}
      className={cn(
        "relative overflow-hidden grid grid-cols-[auto,1fr] items-start gap-3 rounded-[20px] border px-4 py-3 text-left transition-colors",
        toneAppearance.containerClassName,
      )}
    >
      {toneAppearance.accentBarClassName ? (
        <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-0.5", toneAppearance.accentBarClassName)} />
      ) : null}
      <span className="relative mt-1.5 flex h-2.5 w-2.5 items-center justify-center">
        {toneAppearance.pulseClassName ? (
          <span aria-hidden="true" className={cn("absolute h-2.5 w-2.5 rounded-full", toneAppearance.pulseClassName)} />
        ) : null}
        <span className={cn("relative h-2.5 w-2.5 rounded-full", toneAppearance.dotClassName)} />
      </span>
      <div className="min-w-0 space-y-1">
        <div className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", toneAppearance.labelClassName)}>
          {label}
        </div>
        <div className={cn("text-sm", toneAppearance.stepLabelClassName)}>{stepLabel}</div>
      </div>
    </div>
  );
};

function resolveStepMomentToneAppearance(tone: "done" | "now" | "next") {
  switch (tone) {
    case "done":
      return {
        containerClassName: "border-black/8 bg-black/[0.025] opacity-45 shadow-none",
        dotClassName: "bg-black/18",
        labelClassName: "text-black/34",
        stepLabelClassName: "font-medium text-black/50",
        accentBarClassName: null,
        pulseClassName: null,
      };
    case "now":
      return {
        containerClassName: "border-[#c6a777]/60 bg-[rgba(255,250,243,0.96)] shadow-[0_16px_34px_rgba(90,62,29,0.1)]",
        dotClassName: "bg-[#8b5b2e]",
        labelClassName: "text-[#6b4a24]",
        stepLabelClassName: "font-semibold text-black",
        accentBarClassName: null,
        pulseClassName: null,
      };
    case "next":
    default:
      return {
        containerClassName: "border-dashed border-black/10 bg-white/36 opacity-70 shadow-none",
        dotClassName: "bg-black/24",
        labelClassName: "text-black/34",
        stepLabelClassName: "font-medium text-black/56",
        accentBarClassName: null,
        pulseClassName: null,
      };
  }
}

const FactoryV2SegmentedProgressTrack = ({ steps }: { steps: FactoryRun["steps"] }) => (
  <div className="flex gap-2">
    {steps.map((step) => (
      <div
        key={step.id}
        className={cn(
          "relative h-1.5 flex-1 overflow-hidden rounded-full",
          step.status === "running" ? "bg-[#ead8b7]" : getStepStatusMeta(step.status).railClassName,
        )}
      >
        {step.status === "running" ? (
          <span className="absolute inset-y-0 left-0 w-3/4 rounded-full bg-[#8b5b2e]" />
        ) : null}
      </div>
    ))}
  </div>
);

function buildWatchTimelineRun(run: FactoryRun): FactoryRun {
  if (run.steps.some((step) => step.id === "launch-request")) {
    return run;
  }

  return {
    ...run,
    steps: [buildAcceptedLaunchRequestStep(), ...run.steps],
  };
}

function buildAcceptedLaunchRequestStep(): FactoryRun["steps"][number] {
  const latestEvent = getStepStatusMessage("launch-request", "succeeded") ?? "The request was accepted.";

  return {
    id: "launch-request",
    title: getSimpleStepTitle({ id: "launch-request", title: "launch-request" }),
    summary: latestEvent,
    workflowName: "launch-request",
    status: "succeeded",
    verification: latestEvent,
    latestEvent,
  };
}

function resolveWatchProgressMetrics(run: FactoryRun, currentStep: FactoryRun["steps"][number] | null) {
  const { currentStepIndex, currentStepNumber, totalSteps } = resolveRunProgressMetrics(run);
  const completionFraction =
    currentStep?.status === "running"
      ? (currentStepIndex + 0.55) / totalSteps
      : currentStepIndex >= 0
        ? currentStepIndex / totalSteps
        : currentStepNumber / totalSteps;
  const completionPercent = Math.max(12, Math.min(100, Math.round(completionFraction * 100)));

  return {
    completionPercent,
    progressLabel: `${currentStepNumber} of ${totalSteps} parts`,
    percentLabel: `${completionPercent}%`,
    stepLabel: `Step ${currentStepNumber} of ${totalSteps}`,
  };
}

function resolveCurrentStepStatusLabel(
  currentStep: FactoryRun["steps"][number] | null,
  runStatus: FactoryRun["status"],
) {
  if (currentStep?.status === "running") {
    return "In progress";
  }

  if (currentStep?.status === "failed" || currentStep?.status === "blocked" || runStatus === "attention") {
    return "Needs attention";
  }

  if (runStatus === "complete") {
    return "Ready";
  }

  if (runStatus === "running") {
    return "In progress";
  }

  if (runStatus === "waiting") {
    return "Getting ready";
  }

  return "Up next";
}

function resolveCurrentProgressFillClassName(isRunningStep: boolean, runStatus: FactoryRun["status"]) {
  if (isRunningStep) {
    return "bg-[#7a4b22]";
  }

  if (runStatus === "complete") {
    return "bg-[#1f1711]";
  }

  if (runStatus === "attention") {
    return "bg-[#7a2f2f]";
  }

  return "bg-[#4e3d2f]";
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
  const errorMessage = resolveRunStepErrorMessage(step);

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
        {errorMessage ? (
          <div className="mt-3">
            <FactoryV2CopyableMessageBox
              label="Error details"
              message={errorMessage}
              dataTestId={`factory-step-error-${step.id}`}
            />
          </div>
        ) : null}
        {manualAction ? (
          <div className="mt-3 space-y-2 rounded-[14px] border border-black/8 bg-white/55 px-3 py-2.5">
            <div className="text-[12px] leading-5 text-black/52">{manualAction.description}</div>
            <button
              type="button"
              onClick={manualAction.onPress}
              className="inline-flex w-full items-center justify-center rounded-full border border-black/12 bg-black/[0.05] px-3 py-1.5 text-[12px] font-semibold text-black transition-colors hover:bg-black/[0.08] sm:w-auto"
            >
              {manualAction.label}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const FactoryV2CopyableMessageBox = ({
  label,
  message,
  dataTestId,
}: {
  label: string;
  message: string;
  dataTestId?: string;
}) => {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 1_500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyState]);

  const copyMessage = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div
      data-testid={dataTestId}
      className="space-y-2 rounded-[16px] border border-rose-300/50 bg-rose-50/80 px-3 py-2.5 shadow-[0_10px_24px_rgba(190,24,93,0.06)]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">{label}</div>
        <button
          type="button"
          onClick={() => {
            void copyMessage();
          }}
          className="rounded-full border border-rose-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-white"
        >
          {resolveCopyableMessageActionLabel(copyState)}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[12px] border border-rose-200/80 bg-white/70 px-3 py-2 text-[11px] leading-5 text-rose-950">
        {message}
      </pre>
    </div>
  );
};

function resolveCopyableMessageActionLabel(copyState: "idle" | "copied" | "error") {
  switch (copyState) {
    case "copied":
      return "Copied";
    case "error":
      return "Copy failed";
    default:
      return "Copy";
  }
}

function resolveRunStepErrorMessage(step: FactoryRun["steps"][number]) {
  if (step.status !== "failed" && step.status !== "blocked") {
    return null;
  }

  const rawMessage = normalizeCopyableMessage(step.latestEvent || step.verification);
  const genericMessage = normalizeCopyableMessage(getStepStatusMessage(step.id, step.status));

  if (!rawMessage || rawMessage === genericMessage) {
    return null;
  }

  return rawMessage;
}

function normalizeCopyableMessage(message: string | null | undefined) {
  const normalizedMessage = message?.trim();
  return normalizedMessage ? normalizedMessage : null;
}

interface FactoryV2StepManualAction {
  label: string;
  description: string;
  onPress: () => void;
}

interface FactoryV2StepSummaryActionOptions {
  isWatcherBusy: boolean;
  isBlocked: boolean;
  onBringIndexerLive: () => void;
}

interface FactoryV2WatchActionBarProps {
  visiblePrimaryAction: ReturnType<typeof resolveRunPrimaryAction> | null;
  showsManualRefresh: boolean;
  showsNudgeAction: boolean;
  showsStopAutoRetryAction: boolean;
  isWatcherBusy: boolean;
  isBlocked: boolean;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  onContinue: () => void;
  onRefresh: () => void;
  onNudge: () => void;
  onStopAutoRetry: () => void;
}

function shouldShowStopAutoRetryAction(selectedRun: FactoryRun | null, isAwaitingAcceptedUpdate: boolean) {
  return Boolean(
    selectedRun &&
    !isAwaitingAcceptedUpdate &&
    (selectedRun.kind === "series" || selectedRun.kind === "rotation") &&
    !isFactoryRunInProgress(selectedRun) &&
    selectedRun.autoRetry?.enabled &&
    !selectedRun.autoRetry.cancelledAt,
  );
}

function shouldShowPrimaryRunAction(
  selectedRun: FactoryRun | null,
  primaryAction: ReturnType<typeof resolveRunPrimaryAction>,
  isAwaitingAcceptedUpdate: boolean,
) {
  return Boolean(selectedRun && primaryAction && !isAwaitingAcceptedUpdate && selectedRun.status !== "complete");
}

function shouldShowRotationNudgeAction(selectedRun: FactoryRun | null, isAwaitingAcceptedUpdate: boolean) {
  return Boolean(
    selectedRun?.kind === "rotation" &&
    selectedRun.status !== "complete" &&
    !isAwaitingAcceptedUpdate &&
    !isFactoryRunInProgress(selectedRun),
  );
}

function isFactoryRunInProgress(selectedRun: FactoryRun | null) {
  return selectedRun?.status === "running" || selectedRun?.status === "waiting";
}

function resolveStepSummaryAction(
  step: FactoryRun["steps"][number],
  options: FactoryV2StepSummaryActionOptions,
): FactoryV2StepManualAction | null {
  if (step.status === "running" || options.isWatcherBusy || options.isBlocked) {
    return null;
  }

  if (step.id !== "create-indexer" && step.id !== "create-indexers" && step.id !== "wait-indexer") {
    return null;
  }

  return {
    label: "Restart live updates",
    description: "Use this if live updates disappeared or need to start again.",
    onPress: options.onBringIndexerLive,
  };
}

function resolveScheduledMaintenanceLabel(run: FactoryRun | null) {
  if (!run || run.status !== "attention") {
    return null;
  }

  if (run.autoRetry?.enabled && !run.autoRetry.cancelledAt && run.autoRetry.nextRetryAt) {
    return "Waiting for retry";
  }

  if (run.kind === "rotation" && run.evaluation?.nextEvaluationAt) {
    return "Waiting for evaluation";
  }

  return null;
}

function resolveWatchSearchNotice({
  notice,
  selectedRun,
  watchGameName,
  watcher,
  isResolvingRunName,
  lookupDisabledReason,
}: {
  notice: string | null;
  selectedRun: FactoryRun | null;
  watchGameName: string;
  watcher: FactoryWatcherState | null;
  isResolvingRunName: boolean;
  lookupDisabledReason: string | null;
}) {
  if (!notice || watcher || isResolvingRunName || lookupDisabledReason) {
    return null;
  }

  if (!selectedRun) {
    return notice;
  }

  return doesWatchQueryTargetAnotherRun(watchGameName, selectedRun.name) ? notice : null;
}

function doesWatchQueryTargetAnotherRun(watchGameName: string, selectedRunName: string) {
  const normalizedWatchGameName = watchGameName.trim().toLowerCase();
  const normalizedSelectedRunName = selectedRunName.trim().toLowerCase();

  return Boolean(normalizedWatchGameName) && normalizedWatchGameName !== normalizedSelectedRunName;
}

function buildLiveStatusLabel(pollingState: FactoryPollingState, isPendingRun: boolean, run: FactoryRun | null) {
  if (isPendingRun) {
    return "Getting ready";
  }

  if (run?.status === "complete") {
    return "All set";
  }

  const scheduledMaintenanceLabel = resolveScheduledMaintenanceLabel(run);
  if (scheduledMaintenanceLabel) {
    return scheduledMaintenanceLabel;
  }

  if (pollingState.status === "paused") {
    return pollingState.detail;
  }

  if (pollingState.status === "checking") {
    return AUTO_UPDATE_LABEL;
  }

  if (pollingState.lastCheckedAt && isFactoryRunInProgress(run)) {
    return AUTO_UPDATE_LABEL;
  }

  return pollingState.detail;
}

function formatRunTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "soon";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
