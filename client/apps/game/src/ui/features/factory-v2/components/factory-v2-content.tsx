import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useState } from "react";
import { factoryModeDefinitions } from "../catalog";
import { useFactoryV2 } from "../hooks/use-factory-v2";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import { FactoryV2ModeSwitch } from "./factory-v2-mode-switch";
import { FactoryV2StartWorkspace } from "./factory-v2-start-workspace";
import { FactoryV2WatchWorkspace } from "./factory-v2-watch-workspace";
import { FactoryV2WorkflowSwitch, type FactoryWorkflowView } from "./factory-v2-workflow-switch";

export const FactoryV2Content = () => {
  const factory = useFactoryV2();
  const appearance = resolveFactoryModeAppearance(factory.selectedMode);
  const [selectedWorkflow, setSelectedWorkflow] = useState<FactoryWorkflowView>("start");

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
          <div className="rounded-[30px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,248,240,0.55))] px-4 py-5 shadow-[0_20px_44px_rgba(30,20,10,0.08)] backdrop-blur-xl md:px-6 md:py-6">
            <div className="mx-auto max-w-xl space-y-5">
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
            </div>
          </div>
        </div>

        {selectedWorkflow === "start" ? (
          <div className="px-1 md:px-0">
            <FactoryV2StartWorkspace
              mode={factory.selectedMode}
              modeLabel={factory.modeDefinition.label}
              environmentLabel={factory.selectedEnvironment?.label ?? "Slot"}
              isMainnet={factory.selectedEnvironment?.chain === "mainnet"}
              presets={factory.presets}
              selectedPreset={factory.selectedPreset}
              gameName={factory.draftGameName}
              startAt={factory.draftStartAt}
              durationMinutes={factory.draftDurationMinutes}
              showsDuration={factory.showsDuration}
              durationOptions={factory.durationOptions}
              twoPlayerMode={factory.twoPlayerMode}
              singleRealmMode={factory.singleRealmMode}
              existingGameName={factory.matchingRun?.name ?? null}
              notice={factory.notice}
              launchDisabledReason={factory.environmentUnavailableReason}
              moreOptionsOpen={factory.moreOptions.isOpen}
              moreOptionSections={factory.moreOptions.sections}
              moreOptionDraft={factory.moreOptions.draft}
              moreOptionErrors={factory.moreOptions.errors}
              moreOptionsDisabledReason={factory.moreOptions.launchDisabledReason}
              onSelectPreset={factory.selectPreset}
              onGameNameChange={factory.setDraftGameName}
              onStartAtChange={factory.setDraftStartAt}
              onDurationChange={factory.setDraftDurationMinutes}
              onToggleMapOptions={factory.moreOptions.toggleOpen}
              onMapOptionValueChange={factory.moreOptions.setValue}
              onToggleTwoPlayerMode={factory.toggleTwoPlayerMode}
              onToggleSingleRealmMode={factory.toggleSingleRealmMode}
              onFandomizeGameName={factory.fandomizeGameName}
              onLaunch={() => {
                void launchSelectedPreset();
              }}
              isWatcherBusy={factory.isWatcherBusy}
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
              onRetry={() => {
                void factory.retrySelectedRun();
              }}
              onBringIndexerLive={() => {
                void factory.bringIndexerLiveForSelectedRun();
              }}
              onRefresh={() => {
                void factory.refreshSelectedRun();
              }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
};
