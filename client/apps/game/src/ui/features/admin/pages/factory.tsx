import { useAccountStore } from "@/hooks/store/use-account-store";
import { buildWorldProfile, patchManifestWithFactory } from "@/runtime/world";
import { Controller } from "@/ui/modules/controller/controller";
import { ETERNUM_CONFIG } from "@/utils/config";
import { EternumProvider } from "@bibliothecadao/provider";
import type { Config as EternumConfig } from "@bibliothecadao/types";
import {
  SetResourceFactoryConfig,
  setAgentConfig,
  setBattleConfig,
  setBlitzRegistrationConfig,
  setBuildingConfig,
  setCapacityConfig,
  setDiscoverableVillageSpawnResourcesConfig,
  setFactoryAddress as setFactoryAddressConfig,
  setGameModeConfig,
  setHyperstructureConfig,
  setRealmUpgradeConfig,
  setResourceBridgeFeesConfig,
  setSeasonConfig,
  setSettlementConfig,
  setSpeedConfig,
  setStartingResourcesConfig,
  setStructureMaxLevelConfig,
  setTradeConfig,
  setTroopConfig,
  setVRFConfig,
  setVictoryPointsConfig,
  setVillageControllersConfig,
  setWeightConfig,
  setWorldConfig,
  setupGlobals,
} from "@config-deployer/config";
import { getGameManifest, type Chain } from "@contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shortString } from "starknet";
import { env } from "../../../../../env";

// Components
import { AdminHeader } from "../components/admin-header";
import { QuickAddGame } from "../components/quick-add-game";
import { PresetSelectionStep } from "../components/preset-selection";
import { DeploymentReviewStep } from "../components/deployment-review";
import { WorldQueueList } from "../components/world-queue";
import { AdvancedSection } from "../components/advanced";

// Hooks & Utils
import { useFactoryDeployment } from "../hooks/use-factory-deployment";
import { useFactoryAdmin } from "../hooks/use-factory-admin";
import { GAME_PRESETS, getPresetForChain } from "../constants/game-presets";
import { applyPresetToConfig } from "../utils/preset-to-config";
import {
  FACTORY_ADDRESSES,
  DEFAULT_VERSION,
  DEFAULT_NAMESPACE,
  DEFAULT_TORII_NAMESPACE,
  getDefaultMaxActionsForChain,
  getExplorerTxUrl,
  getFactoryDeployRepeatsForChain,
  getRpcUrlForChain,
} from "../constants";
import { generateFactoryCalldata, generateCairoOutput } from "../services/factory-config";
import {
  checkIndexerExists as checkIndexerExistsService,
  createIndexer as createIndexerService,
} from "../services/factory-indexer";
import { getManifestJsonString, type ChainType } from "../utils/manifest-loader";
import {
  cacheDeployedAddress,
  markWorldAsConfigured,
  setIndexerCooldown,
} from "../utils/storage";

// Types
import type { TxState, WorldStatus } from "../types/game-presets";

// ============================================================================
// Manifest Types
// ============================================================================

interface ManifestContract {
  class_hash: string;
  tag: string;
  selector: string;
  init_calldata?: any[];
}

interface ManifestModel {
  class_hash: string;
  tag: string;
}

interface ManifestEvent {
  class_hash: string;
  tag: string;
}

interface ManifestData {
  world: {
    class_hash: string;
    seed: string;
  };
  contracts: ManifestContract[];
  models: ManifestModel[];
  events: ManifestEvent[];
  libraries?: Array<{
    class_hash: string;
    tag?: string;
    version?: string;
    name?: string;
  }>;
}

// ============================================================================
// Main Component
// ============================================================================

export const FactoryPage = () => {
  const navigate = useNavigate();
  const { account } = useAccountStore();

  const currentChain = env.VITE_PUBLIC_CHAIN as ChainType;
  const factoryAddress = FACTORY_ADDRESSES[currentChain] || "";
  const factoryDeployRepeats = getFactoryDeployRepeatsForChain(currentChain);

  // State management
  const { state, actions } = useFactoryDeployment();
  const { refreshStatuses, getWorldDeployedAddressLocal } = useFactoryAdmin(currentChain);
  const [factoryConfigTx, setFactoryConfigTx] = useState<TxState>({ status: "idle" });

  // Auto-deploy cancellation refs
  const autoDeployCancelRef = useRef<Record<string, boolean>>({});

  // Base config
  const eternumConfig: EternumConfig = useMemo(() => ETERNUM_CONFIG(), []);

  // Load and parse manifest
  const manifestJson = useMemo(() => getManifestJsonString(currentChain), [currentChain]);
  const parsedManifest = useMemo((): ManifestData | null => {
    if (!manifestJson) return null;
    try {
      const parsed = JSON.parse(manifestJson);
      let manifest = parsed;
      if (parsed.configuration?.setup?.manifest) {
        manifest = parsed.configuration.setup.manifest;
      } else if (parsed.manifest) {
        manifest = parsed.manifest;
      }
      if (!manifest.world || !manifest.contracts || !manifest.models || !manifest.events) {
        return null;
      }
      return manifest;
    } catch {
      return null;
    }
  }, [manifestJson]);

  // Generate calldata for factory config
  const generatedCalldata = useMemo(() => {
    if (!parsedManifest) return [];
    return generateFactoryCalldata(
      parsedManifest,
      DEFAULT_VERSION,
      DEFAULT_NAMESPACE,
      getDefaultMaxActionsForChain(currentChain),
      true,
    );
  }, [parsedManifest, currentChain]);

  // Check world statuses on mount and when queue changes
  useEffect(() => {
    if (state.worldQueue.length > 0) {
      refreshStatuses(state.worldQueue).then(({ indexerStatusMap, deployedStatusMap }) => {
        const statuses: Record<string, WorldStatus> = {};
        state.worldQueue.forEach((name) => {
          statuses[name] = {
            deployed: deployedStatusMap[name] || false,
            configured: false,
            indexerExists: indexerStatusMap[name] || false,
            verifying: false,
          };
        });
        actions.setWorldStatuses(statuses);
      });
    }
  }, [state.worldQueue, refreshStatuses, actions.setWorldStatuses]);

  // ============================================================================
  // Deployment Handlers
  // ============================================================================

  const buildSeriesCalldata = (seriesName: string, gameNumber: string) => {
    const trimmedName = seriesName.trim();
    const trimmedGameNumber = gameNumber.trim();
    const seriesNameFelt = trimmedName ? shortString.encodeShortString(trimmedName) : "0x0";
    const parsedSeriesGameNumber = trimmedGameNumber ? BigInt(trimmedGameNumber.replace(/[^\d]/g, "")) : BigInt(0);
    return {
      seriesNameFelt,
      seriesGameNumber: parsedSeriesGameNumber.toString(),
    };
  };

  const buildQueueConfigOverrides = useCallback(() => {
    return {
      preset: state.deployment.selectedPreset || undefined,
      startTime: state.deployment.startTime || 0,
      customOverrides: { ...state.deployment.customOverrides },
    };
  }, [state.deployment.selectedPreset, state.deployment.startTime, state.deployment.customOverrides]);

  const handleConfigureWorld = useCallback(
    async (worldName: string) => {
      if (!account) return;

      const worldOverrides = state.worldConfigOverrides[worldName];
      const presetId = worldOverrides?.preset ?? state.deployment.selectedPreset;

      if (!presetId) {
        actions.setTxState("config", { status: "error", error: "Select a preset before configuring this world." });
        return;
      }

      actions.setTxState("config", { status: "running" });

      try {
        const preset = getPresetForChain(presetId, currentChain);
        const customOverrides = worldOverrides?.customOverrides ?? state.deployment.customOverrides;
        const startTime = worldOverrides?.startTime ?? state.deployment.startTime;
        const configForWorld = applyPresetToConfig(
          eternumConfig,
          preset,
          customOverrides,
          currentChain,
          startTime,
        );

        // Build runtime profile and patch manifest
        const profile = await buildWorldProfile(currentChain as Chain, worldName);
        const baseManifest = getGameManifest(currentChain as Chain);
        const patched = patchManifestWithFactory(
          baseManifest as any,
          profile.worldAddress,
          profile.contractsBySelector,
        );

        const localProvider = new EternumProvider(
          patched,
          env.VITE_PUBLIC_NODE_URL,
          env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
        );

        // Batch and run all config functions
        await (localProvider as any).beginBatch({ signer: account });

        const ctx = {
          account,
          provider: localProvider as any,
          config: configForWorld,
        } as any;

        await setWorldConfig(ctx);
        await setVRFConfig(ctx);
        await setGameModeConfig(ctx);
        await setFactoryAddressConfig(ctx);
        await setVictoryPointsConfig(ctx);
        await setDiscoverableVillageSpawnResourcesConfig(ctx);
        await setBlitzRegistrationConfig(ctx);
        await setAgentConfig(ctx);
        await setVillageControllersConfig(ctx);
        await setTradeConfig(ctx);
        await setSeasonConfig(ctx);
        await setResourceBridgeFeesConfig(ctx);
        await setBattleConfig(ctx);
        await setStructureMaxLevelConfig(ctx);
        await setupGlobals(ctx);
        await setCapacityConfig(ctx);
        await setSpeedConfig(ctx);
        await setHyperstructureConfig(ctx);
        await setSettlementConfig(ctx);
        await setStartingResourcesConfig(ctx);
        await setWeightConfig(ctx);
        await setRealmUpgradeConfig(ctx);
        await setTroopConfig(ctx);
        await setBuildingConfig(ctx);
        await SetResourceFactoryConfig(ctx);

        const receipt = await (localProvider as any).endBatch({ flush: true });
        actions.setTxState("config", { status: "success", hash: receipt?.transaction_hash });

        markWorldAsConfigured(worldName);
        actions.updateWorldStatus(worldName, { configured: true });
      } catch (err: any) {
        actions.setTxState("config", { status: "error", error: err.message });
      }
    },
    [account, state.deployment, state.worldConfigOverrides, eternumConfig, currentChain, actions],
  );

  const handleDeploy = useCallback(async () => {
    if (!account || !factoryAddress || !state.deployment.gameName || !state.deployment.selectedPreset) return;

    actions.setTxState("deploy", { status: "running" });

    try {
      const worldNameFelt = shortString.encodeShortString(state.deployment.gameName);
      const series = buildSeriesCalldata(state.deployment.seriesName, state.deployment.seriesGameNumber);

      const result = await account.execute({
        contractAddress: factoryAddress,
        entrypoint: "create_game",
        calldata: [worldNameFelt, DEFAULT_VERSION, series.seriesNameFelt, series.seriesGameNumber],
      });

      actions.setTxState("deploy", { status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);

      // Add to queue and update status
      actions.addToQueue(
        state.deployment.gameName,
        {
          seriesName: state.deployment.seriesName || undefined,
          seriesGameNumber: state.deployment.seriesGameNumber || undefined,
        },
        buildQueueConfigOverrides(),
      );

      actions.updateWorldStatus(state.deployment.gameName, { deployed: true });

      // Now configure the world with preset settings
      await handleConfigureWorld(state.deployment.gameName);
    } catch (err: any) {
      actions.setTxState("deploy", { status: "error", error: err.message });
    }
  }, [account, factoryAddress, state.deployment, buildQueueConfigOverrides, handleConfigureWorld, actions]);

  const handleAddToQueue = useCallback(() => {
    if (!state.deployment.gameName) return;

    actions.addToQueue(
      state.deployment.gameName,
      {
        seriesName: state.deployment.seriesName || undefined,
        seriesGameNumber: state.deployment.seriesGameNumber || undefined,
      },
      buildQueueConfigOverrides(),
    );
  }, [state.deployment, buildQueueConfigOverrides]);

  const handleQueueDeploy = useCallback(
    async (worldName: string) => {
      if (!account || !factoryAddress) return;

      const totalRepeats = Math.max(1, factoryDeployRepeats);
      autoDeployCancelRef.current[worldName] = false;

      actions.updateWorldStatus(worldName, {
        autoDeploying: { current: 0, total: totalRepeats, stopping: false },
      });

      try {
        const worldNameFelt = shortString.encodeShortString(worldName);
        const metadata = state.worldSeriesMetadata[worldName];
        const series = buildSeriesCalldata(metadata?.seriesName ?? "", metadata?.seriesGameNumber ?? "");
        let deployedAddress: string | null = null;

        for (let i = 0; i < totalRepeats; i++) {
          if (autoDeployCancelRef.current[worldName]) break;

          actions.updateWorldStatus(worldName, {
            autoDeploying: { current: i + 1, total: totalRepeats, stopping: false },
          });

          const result = await account.execute({
            contractAddress: factoryAddress,
            entrypoint: "create_game",
            calldata: [worldNameFelt, DEFAULT_VERSION, series.seriesNameFelt, series.seriesGameNumber],
          });

          await Promise.race([
            account.waitForTransaction(result.transaction_hash).catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ]);

          deployedAddress = await getWorldDeployedAddressLocal(worldName);
          if (deployedAddress) {
            actions.updateWorldStatus(worldName, { deployed: true });
            cacheDeployedAddress(worldName, deployedAddress);
            break;
          }
        }

        // Verify deployment if not yet confirmed
        if (!autoDeployCancelRef.current[worldName] && !deployedAddress) {
          actions.updateWorldStatus(worldName, { verifying: true });

          let addr: string | null = null;
          let attempts = 0;
          while (attempts < 10 && !addr) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            addr = await getWorldDeployedAddressLocal(worldName);
            attempts++;
          }

          actions.updateWorldStatus(worldName, {
            deployed: !!addr,
            verifying: false,
          });
          if (addr) cacheDeployedAddress(worldName, addr);
        }
      } catch (err: any) {
        console.error("Deploy error:", err);
      } finally {
        actions.updateWorldStatus(worldName, { autoDeploying: undefined });
        autoDeployCancelRef.current[worldName] = false;
      }
    },
    [account, factoryAddress, factoryDeployRepeats, state.worldSeriesMetadata],
  );

  const handleSetFactoryConfig = useCallback(async () => {
    if (!account || !parsedManifest || !factoryAddress || generatedCalldata.length === 0) return;

    setFactoryConfigTx({ status: "running" });

    try {
      const result = await account.execute({
        contractAddress: factoryAddress,
        entrypoint: "set_factory_config",
        calldata: generatedCalldata,
      });

      setFactoryConfigTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);
    } catch (err: any) {
      setFactoryConfigTx({ status: "error", error: err.message });
    }
  }, [account, parsedManifest, factoryAddress, generatedCalldata]);

  const handleSetFactoryConfigAndDeploy = useCallback(async () => {
    if (
      !account ||
      !parsedManifest ||
      !factoryAddress ||
      generatedCalldata.length === 0 ||
      !state.deployment.gameName ||
      !state.deployment.selectedPreset
    )
      return;

    setFactoryConfigTx({ status: "running" });
    actions.setTxState("deploy", { status: "running" });

    try {
      const worldNameFelt = shortString.encodeShortString(state.deployment.gameName);
      const series = buildSeriesCalldata(state.deployment.seriesName, state.deployment.seriesGameNumber);
      const result = await account.execute([
        {
          contractAddress: factoryAddress,
          entrypoint: "set_factory_config",
          calldata: generatedCalldata,
        },
        {
          contractAddress: factoryAddress,
          entrypoint: "create_game",
          calldata: [worldNameFelt, DEFAULT_VERSION, series.seriesNameFelt, series.seriesGameNumber],
        },
      ]);

      setFactoryConfigTx({ status: "success", hash: result.transaction_hash });
      actions.setTxState("deploy", { status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);

      actions.addToQueue(
        state.deployment.gameName,
        {
          seriesName: state.deployment.seriesName || undefined,
          seriesGameNumber: state.deployment.seriesGameNumber || undefined,
        },
        buildQueueConfigOverrides(),
      );

      actions.updateWorldStatus(state.deployment.gameName, { deployed: true });
      await handleConfigureWorld(state.deployment.gameName);
    } catch (err: any) {
      const message = err?.message || "Failed to set factory config and deploy.";
      setFactoryConfigTx({ status: "error", error: message });
      actions.setTxState("deploy", { status: "error", error: message });
    }
  }, [
    account,
    parsedManifest,
    factoryAddress,
    state.deployment,
    generatedCalldata,
    buildQueueConfigOverrides,
    handleConfigureWorld,
    actions,
  ]);

  const handleCreateIndexer = useCallback(
    async (worldName: string) => {
      const deployedWorldAddress = await getWorldDeployedAddressLocal(worldName);
      if (!deployedWorldAddress) {
        console.warn("World not deployed; cannot create indexer.");
        return;
      }

      try {
        setIndexerCooldown(worldName);

        await createIndexerService({
          env: currentChain,
          rpc_url: getRpcUrlForChain(currentChain),
          torii_namespaces: DEFAULT_TORII_NAMESPACE,
          torii_prefix: worldName,
          torii_world_address: deployedWorldAddress,
          external_contracts: [],
        });

        // Poll for indexer status
        const pollInterval = setInterval(async () => {
          const exists = await checkIndexerExistsService(worldName);
          if (exists) {
            actions.updateWorldStatus(worldName, { indexerExists: true });
            clearInterval(pollInterval);
          }
        }, 10000);

        setTimeout(() => clearInterval(pollInterval), 360000);
      } catch (error) {
        console.error("Error creating indexer:", error);
      }
    },
    [currentChain],
  );

  const handleReload = useCallback(async () => {
    actions.setTxState("deploy", { status: "idle" });
    actions.setTxState("config", { status: "idle" });
    setFactoryConfigTx({ status: "idle" });

    if (state.worldQueue.length > 0) {
      const { indexerStatusMap, deployedStatusMap } = await refreshStatuses(state.worldQueue);
      const statuses: Record<string, WorldStatus> = {};
      state.worldQueue.forEach((name) => {
        statuses[name] = {
          deployed: deployedStatusMap[name] || false,
          configured: false,
          indexerExists: indexerStatusMap[name] || false,
          verifying: false,
        };
      });
      actions.setWorldStatuses(statuses);
    }
  }, [state.worldQueue, refreshStatuses, actions]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const selectedPreset = state.deployment.selectedPreset ? GAME_PRESETS[state.deployment.selectedPreset] : null;

  const explorerTxUrl = state.txState.deploy.hash
    ? getExplorerTxUrl(currentChain as any, state.txState.deploy.hash)
    : undefined;
  const factoryConfigExplorerTxUrl = factoryConfigTx.hash
    ? getExplorerTxUrl(currentChain as any, factoryConfigTx.hash)
    : undefined;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto overflow-x-hidden bg-dark-brown">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <AdminHeader network={currentChain} onBack={() => navigate("/")} onReload={handleReload} />

        {/* Wallet Connection (if not connected) */}
        {!account && (
          <div className="mb-8 p-6 bg-orange/10 border border-orange/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-orange">Connect Your Wallet</h3>
                <p className="text-sm text-orange/80 mt-1">You need to connect a wallet to deploy games</p>
              </div>
              <Controller className="h-10 px-4" />
            </div>
          </div>
        )}

        {/* Quick Add Game to Queue */}
        <QuickAddGame
          gameName={state.deployment.gameName}
          seriesName={state.deployment.seriesName}
          seriesGameNumber={state.deployment.seriesGameNumber}
          onGameNameChange={(name) => actions.updateDeployment({ gameName: name })}
          onSeriesNameChange={(name) => actions.updateDeployment({ seriesName: name })}
          onSeriesGameNumberChange={(num) => actions.updateDeployment({ seriesGameNumber: num })}
          onRegenerateWorldName={actions.regenerateWorldName}
          onAddToQueue={handleAddToQueue}
          isNameInQueue={state.worldQueue.includes(state.deployment.gameName)}
        />

        {/* World Queue - Prominent Position */}
        <WorldQueueList
          worlds={state.worldQueue}
          statuses={state.worldStatuses}
          metadata={state.worldSeriesMetadata}
          onRemove={actions.removeFromQueue}
          onDeploy={handleQueueDeploy}
          onConfigure={handleConfigureWorld}
          onCreateIndexer={handleCreateIndexer}
          isDeploying={state.txState.deploy.status === "running"}
          currentChain={currentChain}
        />

        {/* Step 1: Preset Selection */}
        {state.deployment.step === "select-preset" && (
          <PresetSelectionStep selectedPreset={state.deployment.selectedPreset} onSelect={actions.selectPreset} />
        )}

        {/* Step 2: Review & Deploy */}
        {state.deployment.step === "review-deploy" && selectedPreset && (
          <DeploymentReviewStep
            preset={selectedPreset}
            deployment={state.deployment}
            txState={state.txState.deploy}
            isWalletConnected={!!account}
            explorerTxUrl={explorerTxUrl}
            onBack={actions.goBack}
            onUpdateDeployment={actions.updateDeployment}
            onRegenerateWorldName={actions.regenerateWorldName}
            onDeploy={handleDeploy}
            onAddToQueue={handleAddToQueue}
          />
        )}

        {/* Advanced Section */}
        {parsedManifest && (
          <AdvancedSection isExpanded={state.ui.showAdvanced} onToggle={() => actions.toggleUI("showAdvanced")}>
            <div className="space-y-6">
              {/* Configuration Info */}
              <div className="p-6 panel-wood rounded-xl border border-gold/20">
                <h3 className="text-lg font-bold text-gold mb-4">Configuration</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gold/70 uppercase tracking-wide">Factory Address</label>
                    <input
                      type="text"
                      value={factoryAddress}
                      disabled
                      className="w-full px-4 py-3 bg-brown/50 border border-gold/30 rounded-xl text-gold/60 font-mono text-sm cursor-not-allowed"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gold/70 uppercase tracking-wide">Version</label>
                      <input
                        type="text"
                        value={DEFAULT_VERSION}
                        disabled
                        className="w-full px-4 py-3 bg-brown/50 border border-gold/30 rounded-xl text-gold/60 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gold/70 uppercase tracking-wide">Namespace</label>
                      <input
                        type="text"
                        value={DEFAULT_NAMESPACE}
                        disabled
                        className="w-full px-4 py-3 bg-brown/50 border border-gold/30 rounded-xl text-gold/60 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={handleSetFactoryConfig}
                      disabled={
                        !account || !factoryAddress || generatedCalldata.length === 0 || factoryConfigTx.status === "running"
                      }
                      className="px-4 py-2 bg-gold hover:bg-gold/80 disabled:bg-brown/50 disabled:text-gold/40 disabled:cursor-not-allowed text-brown text-sm font-semibold rounded-lg transition-colors"
                    >
                      Set Factory Config
                    </button>
                    <button
                      onClick={handleSetFactoryConfigAndDeploy}
                      disabled={
                        !account ||
                        !factoryAddress ||
                        generatedCalldata.length === 0 ||
                        !state.deployment.gameName ||
                        !state.deployment.selectedPreset ||
                        factoryConfigTx.status === "running"
                      }
                      className="px-4 py-2 bg-brilliance/20 hover:bg-brilliance/30 disabled:bg-brown/50 disabled:text-gold/40 disabled:cursor-not-allowed text-brilliance text-sm font-semibold rounded-lg border border-brilliance/30 transition-colors"
                    >
                      Set Config + Deploy
                    </button>
                  </div>
                  {factoryConfigTx.status === "success" && factoryConfigExplorerTxUrl && (
                    <div className="flex items-center gap-3 text-sm text-brilliance">
                      <span className="font-semibold">Factory config updated.</span>
                      <a
                        href={factoryConfigExplorerTxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brilliance/80 hover:text-brilliance underline"
                      >
                        View Transaction
                      </a>
                    </div>
                  )}
                  {factoryConfigTx.status === "error" && factoryConfigTx.error && (
                    <p className="text-sm text-danger">{factoryConfigTx.error}</p>
                  )}
                </div>
              </div>

              {/* Deployment Summary */}
              <div className="p-6 panel-wood border border-gold/20 rounded-xl">
                <h3 className="text-lg font-bold text-gold mb-4">Manifest Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gold/10">
                    <span className="text-sm font-medium text-gold/70">Contracts</span>
                    <span className="text-sm font-bold text-gold">{parsedManifest.contracts.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gold/10">
                    <span className="text-sm font-medium text-gold/70">Models</span>
                    <span className="text-sm font-bold text-gold">{parsedManifest.models.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gold/10">
                    <span className="text-sm font-medium text-gold/70">Events</span>
                    <span className="text-sm font-bold text-gold">{parsedManifest.events.length}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm font-medium text-gold/70">Calldata Args</span>
                    <span className="text-sm font-bold text-gold">{generatedCalldata.length}</span>
                  </div>
                </div>
              </div>

              {/* Cairo Output Toggle */}
              <div className="space-y-4">
                <button
                  onClick={() => actions.toggleUI("showCairoOutput")}
                  className="px-4 py-2 text-sm font-semibold text-gold bg-brown/50 hover:bg-brown/70 border border-gold/30 rounded-lg transition-colors"
                >
                  {state.ui.showCairoOutput ? "Hide" : "Show"} Cairo Output
                </button>

                {state.ui.showCairoOutput && (
                  <div className="p-6 bg-brown border border-gold/30 rounded-xl">
                    <pre className="text-xs text-brilliance overflow-x-auto leading-relaxed font-mono">
                      {generateCairoOutput(
                        parsedManifest,
                        DEFAULT_VERSION,
                        getDefaultMaxActionsForChain(currentChain),
                        true,
                        DEFAULT_NAMESPACE,
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </AdvancedSection>
        )}
      </div>
    </div>
  );
};
