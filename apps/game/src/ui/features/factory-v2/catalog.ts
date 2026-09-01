import { GAME_ENVIRONMENTS, getGameEnvironmentsForChain, type GameEnvironment } from "@config";
import type { GameChain } from "@realms-world/chain";
import { env } from "../../../../env";
import type {
  FactoryEnvironmentOption,
  FactoryGameMode,
  FactoryLaunchPreset,
  FactoryLaunchStartRule,
  FactoryModeDefinition,
} from "./types";

const FACTORY_CHAIN_LABELS: Record<GameChain, string> = {
  appchain: "Appchain",
  madara: "Madara",
};

const FACTORY_MODE_DEFINITIONS: FactoryModeDefinition[] = [
  { id: "eternum", label: "Eternum" },
  { id: "blitz", label: "Blitz" },
];

const PREFERRED_FACTORY_MODE: FactoryGameMode = "blitz";

const buildEnvironmentOption = (environment: GameEnvironment): FactoryEnvironmentOption => ({
  id: environment.id,
  label: FACTORY_CHAIN_LABELS[environment.chain],
  mode: environment.gameType,
  chain: environment.chain,
});

/** The environments this build can launch: the shared list filtered to the build chain. */
const listBuildEnvironments = () => getGameEnvironmentsForChain(env.VITE_PUBLIC_CHAIN).map(buildEnvironmentOption);

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const factoryLaunchPresets: FactoryLaunchPreset[] = [
  {
    id: "eternum-ranked-season",
    mode: "eternum",
    name: "Standard world",
    description: "The usual Eternum launch.",
    defaults: {
      startRule: "next_hour",
      devMode: false,
      twoPlayerMode: false,
      singleRealmMode: false,
    },
  },
  // Blitz launches run on registered registrar presets: 6 = Regular Fast
  // (official-60 profile), 7 = Duel (official-90 profile). Presets 2/3 carried
  // local dev balance and 4/5 missed their balance profiles — all immutable,
  // retired, not offered.
  {
    id: "blitz-fast",
    mode: "blitz",
    name: "Regular Fast (1h)",
    description: "The standard one-hour game.",
    defaults: {
      startRule: "next_hour",
      durationMinutes: MINUTES_PER_HOUR,
      devMode: false,
      twoPlayerMode: false,
      singleRealmMode: false,
      version: "6",
    },
  },
  {
    id: "blitz-duel",
    mode: "blitz",
    name: "Duel (2 player)",
    description: "A 90-minute head-to-head game on the duel balance.",
    defaults: {
      startRule: "next_hour",
      durationMinutes: 90,
      devMode: false,
      twoPlayerMode: true,
      singleRealmMode: false,
      version: "7",
    },
  },
  {
    id: "blitz-sandbox",
    mode: "blitz",
    name: "Sandbox",
    description: "A long test game with dev mode on (Regular Fast rules).",
    defaults: {
      startRule: "next_hour",
      durationMinutes: 5 * MINUTES_PER_DAY,
      devMode: true,
      twoPlayerMode: false,
      singleRealmMode: false,
      version: "6",
    },
  },
];

const buildNextHourDate = (now = new Date()) => {
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  return nextHour;
};

const formatDateTimeLocalValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

const resolvePresetStartAtValue = (startRule: FactoryLaunchStartRule, now = new Date()) => {
  if (startRule === "next_hour") {
    return formatDateTimeLocalValue(buildNextHourDate(now));
  }

  return formatDateTimeLocalValue(now);
};

/** Modes offered on this build: the ones with a launch environment on the build chain. */
export const getFactoryModeDefinitions = () => {
  const environments = listBuildEnvironments();
  return FACTORY_MODE_DEFINITIONS.filter((mode) => environments.some((environment) => environment.mode === mode.id));
};

export const isFactoryModeAvailable = (mode: FactoryGameMode) =>
  getFactoryModeDefinitions().some((definition) => definition.id === mode);

export const getDefaultFactoryMode = (): FactoryGameMode =>
  isFactoryModeAvailable(PREFERRED_FACTORY_MODE) ? PREFERRED_FACTORY_MODE : getFactoryModeDefinitions()[0].id;

/** One launch environment per mode per build; a mode without one is not offered. */
export const resolveFactoryEnvironmentForMode = (mode: FactoryGameMode): FactoryEnvironmentOption => {
  const environment = listBuildEnvironments().find((candidate) => candidate.mode === mode);

  if (!environment) {
    throw new Error(`No ${mode} launch environment is configured for ${env.VITE_PUBLIC_CHAIN}`);
  }

  return environment;
};

/** Chain label for any environment id, including ids read back from run records. */
export const resolveFactoryEnvironmentLabel = (environmentId: string) => {
  const environment = GAME_ENVIRONMENTS.find((candidate) => candidate.id === environmentId);
  return environment ? FACTORY_CHAIN_LABELS[environment.chain] : "Unknown";
};

export const getFactoryLaunchPresetsForMode = (mode: FactoryGameMode) =>
  factoryLaunchPresets.filter((preset) => preset.mode === mode);

export const getDefaultPresetIdForModeSelection = (mode: FactoryGameMode) =>
  getFactoryLaunchPresetsForMode(mode)[0]?.id ?? "";

export const getFactoryPresetById = (presetId: string) =>
  factoryLaunchPresets.find((preset) => preset.id === presetId) ?? null;

export const getPresetStartAtValue = (preset: FactoryLaunchPreset, now = new Date()) =>
  resolvePresetStartAtValue(preset.defaults.startRule, now);
