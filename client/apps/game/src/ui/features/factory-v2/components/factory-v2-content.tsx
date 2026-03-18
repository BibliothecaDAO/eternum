import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { SwitchNetworkPrompt } from "@/ui/components/switch-network-prompt";
import {
  getChainLabel,
  resolveConnectedTxChainFromRuntime,
  switchWalletToChain,
  type WalletChainControllerLike,
} from "@/ui/utils/network-switch";
import { useEffect, useState } from "react";
import { factoryModeDefinitions } from "../catalog";
import { useFactoryV2 } from "../hooks/use-factory-v2";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import { FactoryV2ModeSwitch } from "./factory-v2-mode-switch";
import { FactoryV2StartWorkspace } from "./factory-v2-start-workspace";
import { FactoryV2WatchWorkspace } from "./factory-v2-watch-workspace";
import { FactoryV2WorkflowSwitch, type FactoryWorkflowView } from "./factory-v2-workflow-switch";

type FactoryNetworkGuardedAction = "continue" | "retry" | "reindex";

export const FactoryV2Content = () => {
  const { chainId, connector } = useAccount();
  const factory = useFactoryV2();
  const controller = (connector as { controller?: WalletChainControllerLike } | undefined)?.controller;
  const connectedTxChain = resolveConnectedTxChainFromRuntime({ chainId, controller });
  const appearance = resolveFactoryModeAppearance(factory.selectedMode);
  const [selectedWorkflow, setSelectedWorkflow] = useState<FactoryWorkflowView>("start");
  const [pendingWatchAction, setPendingWatchAction] = useState<FactoryNetworkGuardedAction | null>(null);
  const [switchTargetChain, setSwitchTargetChain] = useState<Chain | null>(null);

  useEffect(() => {
    if (!factory.matchingRun) {
      return;
    }

    setSelectedWorkflow("watch");
  }, [factory.matchingRun]);

  useEffect(() => {
    if (!factory.shouldPreferWatchView) {
      return;
    }

    setSelectedWorkflow("watch");
  }, [factory.shouldPreferWatchView]);

  const launchSelectedPreset = async () => {
    setSelectedWorkflow("watch");
    const launched = await factory.launchSelectedPreset();

    if (launched) {
      setSelectedWorkflow("watch");
    }
  };

  const runWatchAction = async (action: FactoryNetworkGuardedAction) => {
    switch (action) {
      case "continue":
        await factory.continueSelectedRun();
        return;
      case "retry":
        await factory.retrySelectedRun();
        return;
      case "reindex":
        await factory.bringIndexerLiveForSelectedRun();
        return;
    }
  };

  const runNetworkGuardedWatchAction = async (action: FactoryNetworkGuardedAction) => {
    if (factory.environmentUnavailableReason) {
      await runWatchAction(action);
      return;
    }

    const targetChain = factory.selectedEnvironment?.chain ?? null;

    if (!targetChain || connectedTxChain === targetChain) {
      await runWatchAction(action);
      return;
    }

    setPendingWatchAction(action);
    setSwitchTargetChain(targetChain);
  };

  const handleSwitchNetwork = async () => {
    if (!switchTargetChain) {
      return;
    }

    const switched = await switchWalletToChain({
      controller,
      targetChain: switchTargetChain,
    });

    if (!switched) {
      return;
    }

    const action = pendingWatchAction;

    setPendingWatchAction(null);
    setSwitchTargetChain(null);

    if (action) {
      await runWatchAction(action);
    }
  };

  const closeSwitchNetworkPrompt = () => {
    setPendingWatchAction(null);
    setSwitchTargetChain(null);
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden border-y p-3 sm:p-4 md:rounded-[36px] md:border md:p-8",
        appearance.canvasClassName,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0", appearance.backdropClassName)} />
      <div className="relative mx-auto max-w-6xl space-y-4 md:space-y-6">
        <div className={cn("space-y-4 border-b pb-4 md:pb-6", appearance.sectionDividerClassName)}>
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
            onSelect={setSelectedWorkflow}
          />
        </div>

        {selectedWorkflow === "start" ? (
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
        ) : null}

        {selectedWorkflow === "watch" ? (
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
              void runNetworkGuardedWatchAction("continue");
            }}
            onRetry={() => {
              void runNetworkGuardedWatchAction("retry");
            }}
            onBringIndexerLive={() => {
              void runNetworkGuardedWatchAction("reindex");
            }}
            onRefresh={() => {
              void factory.refreshSelectedRun();
            }}
          />
        ) : null}
      </div>
      <SwitchNetworkPrompt
        open={switchTargetChain !== null}
        description="This game is attached to another network."
        hint={
          switchTargetChain
            ? `Switch your wallet to ${getChainLabel(switchTargetChain)} to continue.`
            : "Switch network to continue."
        }
        switchLabel={switchTargetChain ? `Switch To ${getChainLabel(switchTargetChain)}` : "Switch Network"}
        onClose={closeSwitchNetworkPrompt}
        onSwitch={handleSwitchNetwork}
      />
    </section>
  );
};
