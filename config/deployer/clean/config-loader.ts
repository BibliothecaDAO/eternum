import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Config as EternumConfig } from "@bibliothecadao/types";
import { resolveDeploymentEnvironment } from "./environment";
import type { DeploymentEnvironmentId } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../");

interface StoredConfiguration {
  configuration?: EternumConfig;
}

interface ConfigOverrides {
  startMainAt: number;
  factoryAddress: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  durationSeconds?: number;
}

export function loadEnvironmentConfiguration(environmentId: DeploymentEnvironmentId): EternumConfig {
  const environment = resolveDeploymentEnvironment(environmentId);
  const absolutePath = path.resolve(repoRoot, environment.configPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw) as StoredConfiguration;

  if (!parsed.configuration) {
    throw new Error(`No configuration object found in ${environment.configPath}`);
  }

  return parsed.configuration;
}

export function applyDeploymentConfigOverrides(baseConfig: EternumConfig, overrides: ConfigOverrides): EternumConfig {
  const cloned = structuredClone(baseConfig);
  const singleRealmMode = overrides.singleRealmMode ?? cloned.settlement?.single_realm_mode ?? false;
  const twoPlayerMode = overrides.twoPlayerMode ?? cloned.settlement?.two_player_mode ?? false;
  const durationSeconds = overrides.durationSeconds ?? cloned.season?.durationSeconds;

  if (singleRealmMode && twoPlayerMode) {
    throw new Error("single_realm_mode and two_player_mode cannot both be enabled");
  }

  if (!Number.isFinite(durationSeconds) || !Number.isInteger(durationSeconds) || durationSeconds < 60) {
    throw new Error("durationSeconds must be an integer greater than or equal to 60");
  }

  // Keep launch-time flag overrides centralized here so every caller applies
  // the same config shape and validation rules.
  cloned.dev = {
    ...(cloned.dev ?? {}),
    mode: {
      ...(cloned.dev?.mode ?? {}),
      on: overrides.devModeOn ?? cloned.dev?.mode?.on ?? false,
    },
  };
  cloned.season = {
    ...(cloned.season ?? {}),
    startMainAt: overrides.startMainAt,
    durationSeconds,
  };
  cloned.settlement = {
    ...(cloned.settlement ?? {}),
    single_realm_mode: singleRealmMode,
    two_player_mode: twoPlayerMode,
  };
  (cloned as any).factory_address = overrides.factoryAddress;
  return cloned;
}
