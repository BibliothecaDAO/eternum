import type { Config as EternumConfig } from "@bibliothecadao/types";
import type { ConfigStep, DeploymentEnvironmentId } from "../types";
import {
  setAgentConfig,
  setBattleConfig,
  setBankConfig,
  setBaseBuildingConfig,
  setBlitzRegistrationParametersConfig,
  setBuildingCategoryConfig,
  setCapacityConfig,
  setDiscoverableVillageSpawnResourcesConfig,
  setFactoryAddress,
  setFaithConfig,
  setGameModeConfig,
  setHyperstructureConfig,
  setMapConfig,
  setMercenariesNameConfig,
  setMMRConfig,
  setQuestConfig,
  setRealmUpgradeConfig,
  setResourceBridgeFeesConfig,
  setResourceFactoryConfig,
  setSeasonConfig,
  setSettlementConfig,
  setSpeedConfig,
  setStartingResourcesConfig,
  setStructureMaxLevelConfig,
  setTickConfig,
  setTradeConfig,
  setTroopConfig,
  setVRFConfig,
  setVictoryPointsConfig,
  setVillageControllersConfig,
  setWeightConfig,
  setWorldAdminConfig,
  type NativeConfigProvider,
} from "./native-steps";

interface StepSelectionInput {
  environmentId: DeploymentEnvironmentId;
  config: EternumConfig;
}

interface ConfigStepDefinition<Provider> extends ConfigStep<Provider> {
  environments?: readonly DeploymentEnvironmentId[];
  shouldRun?: (input: StepSelectionInput) => boolean;
}

function hasFactoryAddress(config: EternumConfig): boolean {
  return Boolean((config as EternumConfig & { factory_address?: string }).factory_address);
}

function isBlitzConfiguration(config: EternumConfig): boolean {
  return Boolean(config.blitz?.mode?.on);
}

function isEternumConfiguration(config: EternumConfig): boolean {
  return !isBlitzConfiguration(config);
}

function hasMmrConfig(config: EternumConfig): boolean {
  return Boolean((config as EternumConfig & { mmr?: unknown }).mmr);
}

function hasFaithConfig(config: EternumConfig): boolean {
  return Boolean(config.faith);
}

function hasSupportedVrfConfig(config: EternumConfig): boolean {
  const chain = config.setup?.chain;
  if (chain !== "mainnet" && chain !== "sepolia" && chain !== "slot") {
    return false;
  }

  const vrfProviderAddress = config.vrf?.vrfProviderAddress;
  if (!vrfProviderAddress) {
    return false;
  }

  try {
    return BigInt(vrfProviderAddress) !== 0n;
  } catch {
    return false;
  }
}

function defineStep(
  id: string,
  description: string,
  execute: ConfigStep<NativeConfigProvider>["execute"],
  options: Omit<ConfigStepDefinition<NativeConfigProvider>, "id" | "description" | "execute"> = {},
): ConfigStepDefinition<NativeConfigProvider> {
  return { id, description, execute, ...options };
}

function matchesEnvironment(
  step: ConfigStepDefinition<NativeConfigProvider>,
  environmentId: DeploymentEnvironmentId,
): boolean {
  return !step.environments || step.environments.includes(environmentId);
}

function shouldRunStep(step: ConfigStepDefinition<NativeConfigProvider>, input: StepSelectionInput): boolean {
  return step.shouldRun ? step.shouldRun(input) : true;
}

function toExecutableStep(step: ConfigStepDefinition<NativeConfigProvider>): ConfigStep<NativeConfigProvider> {
  const { environments: _environments, shouldRun: _shouldRun, ...executableStep } = step;
  return executableStep;
}

// The registry order is the contract between CI, the admin UI, and the onchain
// systems. Keep it explicit here instead of hiding it behind legacy helpers.
export const FACTORY_WORLD_CONFIG_STEP_DEFINITIONS: ConfigStepDefinition<NativeConfigProvider>[] = [
  defineStep("world-admin", "Set world admin config", setWorldAdminConfig),
  defineStep("mercenaries-name", "Set mercenaries name config", setMercenariesNameConfig),
  defineStep("vrf", "Set VRF config", setVRFConfig, {
    shouldRun: ({ config }) => hasSupportedVrfConfig(config),
  }),
  defineStep("game-mode", "Set game mode config", setGameModeConfig),
  defineStep("factory-address", "Set factory address", setFactoryAddress, {
    shouldRun: ({ config }) => hasFactoryAddress(config),
  }),
  defineStep("mmr", "Set MMR config", setMMRConfig, {
    shouldRun: ({ config }) => isBlitzConfiguration(config) && hasMmrConfig(config),
  }),
  defineStep("victory-points", "Set victory points config", setVictoryPointsConfig),
  defineStep(
    "village-spawn-resources",
    "Set discoverable village spawn resources config",
    setDiscoverableVillageSpawnResourcesConfig,
  ),
  defineStep("blitz-registration", "Set blitz registration config", setBlitzRegistrationParametersConfig, {
    environments: ["slot.blitz"],
  }),
  defineStep("agent", "Set agent config", setAgentConfig),
  defineStep("village-controllers", "Set village controllers config", setVillageControllersConfig, {
    shouldRun: ({ config }) => isEternumConfiguration(config),
  }),
  defineStep("trade", "Set trade config", setTradeConfig, {
    shouldRun: ({ config }) => isEternumConfiguration(config),
  }),
  defineStep("season", "Set season config", setSeasonConfig),
  defineStep("resource-bridge-fees", "Set resource bridge fees config", setResourceBridgeFeesConfig),
  defineStep("battle", "Set battle config", setBattleConfig),
  defineStep("structure-max-level", "Set structure max level config", setStructureMaxLevelConfig),
  defineStep("bank", "Set bank config", setBankConfig, {
    shouldRun: ({ config }) => isEternumConfiguration(config),
  }),
  defineStep("tick", "Set tick config", setTickConfig),
  defineStep("map", "Set map config", setMapConfig),
  defineStep("quest", "Set quest config", setQuestConfig),
  defineStep("capacity", "Set capacity config", setCapacityConfig),
  defineStep("speed", "Set speed config", setSpeedConfig),
  defineStep("hyperstructure", "Set hyperstructure config", setHyperstructureConfig),
  defineStep("settlement", "Set settlement config", setSettlementConfig),
  defineStep("faith", "Set faith config", setFaithConfig, {
    shouldRun: ({ config }) => isEternumConfiguration(config) && hasFaithConfig(config),
  }),
  defineStep("starting-resources", "Set starting resources config", setStartingResourcesConfig),
  defineStep("weight", "Set weight config", setWeightConfig),
  defineStep("realm-upgrade", "Set realm upgrade config", setRealmUpgradeConfig),
  defineStep("troop", "Set troop config", setTroopConfig),
  defineStep("building-base", "Set base building config", setBaseBuildingConfig),
  defineStep("building-categories", "Set building category config", setBuildingCategoryConfig),
  defineStep("resource-factory", "Set resource factory config", setResourceFactoryConfig),
];

export const FACTORY_WORLD_CONFIG_STEPS: ConfigStep<NativeConfigProvider>[] =
  FACTORY_WORLD_CONFIG_STEP_DEFINITIONS.map(toExecutableStep);

export function resolveFactoryWorldConfigSteps({
  environmentId,
  config,
}: StepSelectionInput): ConfigStep<NativeConfigProvider>[] {
  return FACTORY_WORLD_CONFIG_STEP_DEFINITIONS.filter(
    (step) => matchesEnvironment(step, environmentId) && shouldRunStep(step, { environmentId, config }),
  ).map(toExecutableStep);
}
