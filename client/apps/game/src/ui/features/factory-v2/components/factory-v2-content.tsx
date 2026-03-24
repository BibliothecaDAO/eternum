import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useState } from "react";
import { factoryModeDefinitions } from "../catalog";
import { useFactoryV2 } from "../hooks/use-factory-v2";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import { FactoryV2DeveloperTools } from "./factory-v2-developer-tools";
import { FactoryV2ManageIndexersWorkspace } from "./factory-v2-manage-indexers-workspace";
import { FactoryV2ModeSwitch } from "./factory-v2-mode-switch";
import { FactoryV2StartWorkspace } from "./factory-v2-start-workspace";
import { FactoryV2WatchWorkspace } from "./factory-v2-watch-workspace";
import { FactoryV2WorkflowSwitch, type FactoryWorkflowView } from "./factory-v2-workflow-switch";

export const FactoryV2Content = () => {
  const factory = useFactoryV2();
  const appearance = resolveFactoryModeAppearance(factory.selectedMode);
  const [selectedWorkflow, setSelectedWorkflow] = useState<FactoryWorkflowView>(() =>
    resolveInitialFactoryWorkflow(factory.selectedRun),
  );

  const launchSelectedPreset = async () => {
    setSelectedWorkflow("watch");
    const launched = await factory.launchSelectedPreset();

    if (launched) {
      setSelectedWorkflow("watch");
    }
  };

  const selectWorkflow = (nextWorkflow: FactoryWorkflowView) => setSelectedWorkflow(nextWorkflow);

  return (
    <section className={cn("relative overflow-hidden md:rounded-[36px] md:border md:p-8", appearance.canvasClassName)}>
      <div className={cn("pointer-events-none absolute inset-0", appearance.backdropClassName)} />
      <div className="relative mx-auto max-w-6xl space-y-4 pt-3 md:space-y-6 md:pt-0">
        <div className={cn("px-2 pb-4 md:border-b md:px-0 md:pb-6", appearance.sectionDividerClassName)}>
          <div
            className={cn("rounded-[30px] px-4 py-5 backdrop-blur-xl md:px-6 md:py-6", appearance.mainSurfaceClassName)}
          >
            <div className="mx-auto max-w-xl space-y-5">
              <div className="space-y-5">
                <FactoryV2ModeSwitch
                  modes={factoryModeDefinitions}
                  selectedMode={factory.selectedMode}
                  environmentOptions={factory.environmentOptions}
                  selectedEnvironmentId={factory.selectedEnvironmentId}
                  onSelectEnvironment={factory.selectEnvironment}
                  onSelectMode={factory.selectMode}
                />
                <FactoryV2WorkflowSwitch
                  mode={factory.selectedMode}
                  selectedView={selectedWorkflow}
                  canWatch
                  onSelect={selectWorkflow}
                />
                {selectedWorkflow !== "start" ? (
                  <FactoryV2AdminSecretControl
                    appearance={appearance}
                    adminSecret={factory.factoryAdminSecret}
                    hasSavedAdminSecret={factory.hasSavedFactoryAdminSecret}
                    isBusy={factory.isWatcherBusy}
                    onAdminSecretChange={factory.setFactoryAdminSecret}
                    onSaveAdminSecret={factory.saveFactoryAdminSecret}
                    onClearAdminSecret={factory.clearFactoryAdminSecret}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {selectedWorkflow === "start" ? (
          <div className="space-y-3 px-1 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:space-y-4 md:px-0 md:pb-0">
            <FactoryV2StartWorkspace
              mode={factory.selectedMode}
              modeLabel={factory.modeDefinition.label}
              environmentLabel={factory.selectedEnvironment?.label ?? "Slot"}
              isMainnet={factory.selectedEnvironment?.chain === "mainnet"}
              launchTargetKind={factory.selectedLaunchKind}
              presets={factory.presets}
              selectedPreset={factory.selectedPreset}
              gameName={factory.draftGameName}
              seriesName={factory.draftSeriesName}
              rotationName={factory.draftRotationName}
              startAt={factory.draftStartAt}
              durationMinutes={factory.draftDurationMinutes}
              seriesGameCount={factory.draftSeriesGameCount}
              seriesGames={factory.draftSeriesGames}
              rotationPreviewGames={factory.draftRotationPreviewGames}
              rotationGameIntervalMinutes={factory.draftRotationGameIntervalMinutes}
              rotationMaxGames={factory.draftRotationMaxGames}
              rotationAdvanceWindowGames={factory.draftRotationAdvanceWindowGames}
              rotationEvaluationIntervalMinutes={factory.draftRotationEvaluationIntervalMinutes}
              autoRetryIntervalMinutes={factory.draftAutoRetryIntervalMinutes}
              showsDuration={factory.showsDuration}
              durationOptions={factory.durationOptions}
              twoPlayerMode={factory.twoPlayerMode}
              singleRealmMode={factory.singleRealmMode}
              seriesSuggestions={factory.seriesSuggestions}
              isLoadingSeries={factory.isLoadingSeries}
              seriesLookupError={factory.seriesLookupError}
              existingRunName={factory.matchingRun?.name ?? null}
              notice={factory.notice}
              launchDisabledReason={factory.environmentUnavailableReason}
              moreOptionsOpen={factory.moreOptions.isOpen}
              moreOptionSections={factory.moreOptions.sections}
              moreOptionDraft={factory.moreOptions.draft}
              moreOptionErrors={factory.moreOptions.errors}
              moreOptionsDisabledReason={factory.moreOptions.launchDisabledReason}
              onSelectLaunchTargetKind={factory.selectLaunchKind}
              onSelectPreset={factory.selectPreset}
              onGameNameChange={factory.setDraftGameName}
              onSeriesNameChange={factory.setDraftSeriesName}
              onRotationNameChange={factory.setDraftRotationName}
              onStartAtChange={factory.setDraftStartAt}
              onDurationChange={factory.setDraftDurationMinutes}
              onSeriesGameCountChange={factory.setDraftSeriesGameCount}
              onSeriesGameNameChange={factory.setSeriesGameName}
              onSeriesGameStartAtChange={factory.setSeriesGameStartAt}
              onRotationGameIntervalMinutesChange={factory.setDraftRotationGameIntervalMinutes}
              onRotationMaxGamesChange={factory.setDraftRotationMaxGames}
              onRotationAdvanceWindowGamesChange={factory.setDraftRotationAdvanceWindowGames}
              onRotationEvaluationIntervalChange={factory.setDraftRotationEvaluationIntervalMinutes}
              onAutoRetryIntervalChange={factory.setDraftAutoRetryIntervalMinutes}
              onSelectSeriesSuggestion={factory.selectSeriesSuggestion}
              onToggleMapOptions={factory.moreOptions.toggleOpen}
              onMapOptionValueChange={factory.moreOptions.setValue}
              onToggleTwoPlayerMode={factory.toggleTwoPlayerMode}
              onToggleSingleRealmMode={factory.toggleSingleRealmMode}
              onFandomizeGameName={factory.fandomizeGameName}
              deployerChain={factory.selectedEnvironment?.chain ?? "slot"}
              deployerEnvironmentLabel={factory.selectedEnvironment?.label ?? "Slot"}
              onLaunch={() => {
                void launchSelectedPreset();
              }}
              isWatcherBusy={factory.isWatcherBusy}
            />

            <FactoryV2DeveloperTools
              mode={factory.selectedMode}
              chain={factory.selectedEnvironment?.chain ?? "slot"}
              environmentLabel={factory.selectedEnvironment?.label ?? "Slot"}
              draftGameName={factory.draftGameName}
              selectedRunName={factory.selectedRun?.name ?? null}
            />
          </div>
        ) : null}

        {selectedWorkflow === "watch" ? (
          <div>
            <FactoryV2WatchWorkspace
              mode={factory.selectedMode}
              runs={factory.modeRuns}
              selectedRun={factory.selectedRun}
              activeRunName={factory.activeRunName}
              acceptedRunMessage={factory.acceptedRunMessage}
              watcher={factory.watcher}
              pollingState={factory.pollingState}
              isWatcherBusy={factory.isWatcherBusy}
              isResolvingRunName={factory.isResolvingRunName}
              notice={factory.notice}
              lookupDisabledReason={factory.environmentUnavailableReason}
              onSelectRun={factory.selectRun}
              onResolveRunByName={factory.resolveRunByName}
              onContinue={() => {
                void factory.continueSelectedRun();
              }}
              onRefresh={() => {
                void factory.refreshSelectedRun();
              }}
              onNudge={() => {
                void factory.nudgeSelectedRun();
              }}
              onStopAutoRetry={() => {
                void factory.cancelSelectedRunAutoRetry();
              }}
              onDeleteRun={() => {
                void factory.deleteSelectedRun();
              }}
              adminSecret={factory.factoryAdminSecret}
              hasAdminSecret={factory.factoryAdminSecret.trim().length > 0}
              deployerChain={factory.selectedEnvironment?.chain ?? "slot"}
              deployerEnvironmentLabel={factory.selectedEnvironment?.label ?? "Slot"}
              onFundPrize={(request) => factory.fundSelectedRunPrize(request)}
            />
          </div>
        ) : null}

        {selectedWorkflow === "manage" ? (
          <div className="px-1 md:px-0">
            <FactoryV2ManageIndexersWorkspace
              mode={factory.selectedMode}
              watcher={factory.watcher}
              adminSecret={factory.factoryAdminSecret}
              hasSavedAdminSecret={factory.hasSavedFactoryAdminSecret}
              environmentLabel={factory.selectedEnvironment?.label ?? "Slot"}
              liveIndexers={factory.liveIndexers}
              liveIndexersUpdatedAt={factory.liveIndexersUpdatedAt}
              hasLoadedLiveIndexersSnapshot={factory.hasLoadedLiveIndexersSnapshot}
              notice={factory.notice}
              isBusy={factory.isWatcherBusy}
              onLoadLiveIndexers={(request) => {
                void factory.loadLiveIndexers(request);
              }}
              onRefreshLiveIndexers={(request) => {
                void factory.refreshLiveIndexerSnapshot(request);
              }}
              onCreateIndexers={(request) => {
                void factory.createIndexers(request);
              }}
              onUpdateIndexerTier={(request) => {
                void factory.updateIndexerTiers(request);
              }}
              onDeleteIndexers={(request) => {
                return factory.deleteIndexers(request);
              }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
};

function resolveInitialFactoryWorkflow(
  selectedRun: ReturnType<typeof useFactoryV2>["selectedRun"],
): FactoryWorkflowView {
  return selectedRun ? "watch" : "start";
}

const FactoryV2AdminSecretControl = ({
  appearance,
  adminSecret,
  hasSavedAdminSecret,
  isBusy,
  onAdminSecretChange,
  onSaveAdminSecret,
  onClearAdminSecret,
}: {
  appearance: ReturnType<typeof resolveFactoryModeAppearance>;
  adminSecret: string;
  hasSavedAdminSecret: boolean;
  isBusy: boolean;
  onAdminSecretChange: (value: string) => void;
  onSaveAdminSecret: () => void;
  onClearAdminSecret: () => void;
}) => {
  const hasAdminSecret = adminSecret.trim().length > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[24px] border border-black/8 px-3 py-3 shadow-[0_12px_30px_rgba(23,15,8,0.06)] sm:flex-row sm:items-center sm:px-4",
        appearance.quietSurfaceClassName,
      )}
    >
      <div className="flex items-center gap-2 sm:min-w-[108px]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">Admin</div>
        {hasSavedAdminSecret ? (
          <span className="rounded-full border border-black/8 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/56">
            Saved
          </span>
        ) : null}
      </div>

      <input
        data-testid="factory-admin-secret"
        type="password"
        autoComplete="current-password"
        value={adminSecret}
        onChange={(event) => onAdminSecretChange(event.target.value)}
        placeholder="Secret for admin actions"
        className="h-11 min-w-0 flex-1 rounded-full border border-black/10 bg-white/84 px-4 text-sm text-black outline-none transition-colors focus:border-black/24"
      />

      <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
        <button
          type="button"
          data-testid="factory-admin-save"
          disabled={isBusy || !hasAdminSecret}
          onClick={onSaveAdminSecret}
          className={cn(
            "inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            appearance.secondaryButtonClassName,
          )}
        >
          Save
        </button>
        <button
          type="button"
          data-testid="factory-admin-clear"
          disabled={isBusy || !hasSavedAdminSecret}
          onClick={onClearAdminSecret}
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-black/62 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
