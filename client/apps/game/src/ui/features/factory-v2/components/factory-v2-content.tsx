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

type FactoryNetworkAction = "launch" | "continue" | "retry";

export const FactoryV2Content = () => {
  const { chainId, connector } = useAccount();
  const factory = useFactoryV2();
  const controller = (connector as { controller?: WalletChainControllerLike } | undefined)?.controller;
  const connectedTxChain = resolveConnectedTxChainFromRuntime({ chainId, controller });
  const appearance = resolveFactoryModeAppearance(factory.selectedMode);
  const [selectedWorkflow, setSelectedWorkflow] = useState<FactoryWorkflowView>("start");
  const [pendingNetworkAction, setPendingNetworkAction] = useState<FactoryNetworkAction | null>(null);
  const [switchTargetChain, setSwitchTargetChain] = useState<Chain | null>(null);

  useEffect(() => {
    setSelectedWorkflow("start");
  }, [factory.selectedMode]);

  useEffect(() => {
    if (!factory.matchingRun) {
      return;
    }

    setSelectedWorkflow("watch");
  }, [factory.matchingRun]);

  const launchSelectedPreset = async () => {
    const launched = await factory.launchSelectedPreset();

    if (launched) {
      setSelectedWorkflow("watch");
    }
  };

  const runFactoryAction = async (action: FactoryNetworkAction) => {
    switch (action) {
      case "launch":
        await launchSelectedPreset();
        return;
      case "continue":
        await factory.continueSelectedRun();
        return;
      case "retry":
        await factory.retrySelectedRun();
        return;
    }
  };

  const runFactoryActionWithNetworkGuard = async (action: FactoryNetworkAction) => {
    if (factory.environmentUnavailableReason) {
      await runFactoryAction(action);
      return;
    }

    const targetChain = factory.selectedEnvironment?.chain ?? null;

    if (!targetChain || connectedTxChain === targetChain) {
      await runFactoryAction(action);
      return;
    }

    setPendingNetworkAction(action);
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

    const action = pendingNetworkAction;

    setPendingNetworkAction(null);
    setSwitchTargetChain(null);

    if (action) {
      await runFactoryAction(action);
    }
  };

  const closeSwitchNetworkPrompt = () => {
    setPendingNetworkAction(null);
    setSwitchTargetChain(null);
  };

  return (
    <section className={cn("relative overflow-hidden rounded-[36px] border p-5 md:p-8", appearance.canvasClassName)}>
      <div className={cn("pointer-events-none absolute inset-0", appearance.backdropClassName)} />
      <div className="relative mx-auto max-w-6xl space-y-6">
        <div className="space-y-4 border-b border-black/8 pb-6">
          <FactoryV2ModeSwitch
            modes={factoryModeDefinitions}
            selectedMode={factory.selectedMode}
            environmentOptions={factory.environmentOptions}
            selectedEnvironmentId={factory.selectedEnvironmentId}
            onSelectEnvironment={factory.selectEnvironment}
            onSelectMode={factory.selectMode}
          />
          <div className="flex justify-center">
            <FactoryV2WorkflowSwitch
              mode={factory.selectedMode}
              selectedView={selectedWorkflow}
              canWatch
              onSelect={setSelectedWorkflow}
            />
          </div>
        </div>

        {factory.notice ? (
          <div className="mx-auto max-w-md rounded-[18px] border border-amber-900/12 bg-white/72 px-4 py-3 text-center text-sm text-black/58">
            {factory.notice}
          </div>
        ) : null}

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
            launchDisabledReason={factory.environmentUnavailableReason}
            onSelectPreset={factory.selectPreset}
            onGameNameChange={factory.setDraftGameName}
            onStartAtChange={factory.setDraftStartAt}
            onDurationChange={factory.setDraftDurationMinutes}
            onToggleTwoPlayerMode={factory.toggleTwoPlayerMode}
            onToggleSingleRealmMode={factory.toggleSingleRealmMode}
            onFandomizeGameName={factory.fandomizeGameName}
            onLaunch={() => {
              void runFactoryActionWithNetworkGuard("launch");
            }}
            isWatcherBusy={factory.isWatcherBusy}
          />
        ) : null}

        {selectedWorkflow === "watch" ? (
          <FactoryV2WatchWorkspace
            mode={factory.selectedMode}
            runs={factory.modeRuns}
            selectedRun={factory.selectedRun}
            watcher={factory.watcher}
            isWatcherBusy={factory.isWatcherBusy}
            isResolvingRunName={factory.isResolvingRunName}
            lookupDisabledReason={factory.environmentUnavailableReason}
            onSelectRun={factory.selectRun}
            onResolveRunByName={factory.resolveRunByName}
            onContinue={() => {
              void runFactoryActionWithNetworkGuard("continue");
            }}
            onRetry={() => {
              void runFactoryActionWithNetworkGuard("retry");
            }}
            onRefresh={() => {
              void factory.refreshSelectedRun();
            }}
          />
        ) : null}
      </div>
      <SwitchNetworkPrompt
        open={switchTargetChain !== null}
        description={
          pendingNetworkAction === "launch"
            ? "This launch is set for another network."
            : "This game is attached to another network."
        }
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
