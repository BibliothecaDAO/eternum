import type { Chain } from "@contracts";
import type {
  FactoryEnvironmentOption,
  FactoryGameMode,
  FactoryLaunchPreset,
  FactoryLaunchStartRule,
  FactoryModeDefinition,
} from "./types";

const FACTORY_ENVIRONMENT_LABELS: Record<string, string> = {
  "slot.eternum": "Slot",
  "mainnet.eternum": "Mainnet",
  "slot.blitz": "Slot",
  "mainnet.blitz": "Mainnet",
};

const FACTORY_ENVIRONMENTS_BY_MODE: Record<FactoryGameMode, string[]> = {
  eternum: ["slot.eternum", "mainnet.eternum"],
  blitz: ["slot.blitz", "mainnet.blitz"],
};

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export const factoryModeDefinitions: FactoryModeDefinition[] = [
  {
    id: "eternum",
    label: "Eternum",
    strapline: "Long-form world launches with post-deploy follow-through.",
    description:
      "Eternum runs need explicit post-launch handling for roles, banks, indexing, and operator recovery when external systems lag behind.",
    accentClassName: "from-gold/30 via-orange/20 to-red-900/30",
    focusLabel: "Operator focus: safe recovery and long-running visibility",
    stepPrinciples: ["Resume from the failed step", "Show external waits clearly", "Keep Eternum-only steps explicit"],
  },
  {
    id: "blitz",
    label: "Blitz",
    strapline: "Fast launch paths with lighter recovery and faster operator feedback.",
    description:
      "Blitz runs should feel quick, obvious, and low-friction. The UI should emphasize speed, low ceremony, and clear completion.",
    accentClassName: "from-amber-200/30 via-orange-200/10 to-stone-900/35",
    focusLabel: "Operator focus: launch speed and low-noise monitoring",
    stepPrinciples: ["Fewer steps, less clutter", "Make success obvious", "Hide Eternum-only complexity"],
  },
];

const factoryLaunchPresets: FactoryLaunchPreset[] = [
  {
    id: "eternum-ranked-season",
    mode: "eternum",
    name: "Ranked season world",
    description: "The normal long-form world.",
    defaults: {
      startRule: "next_hour",
      devMode: false,
      twoPlayerMode: false,
      singleRealmMode: false,
    },
  },
  {
    id: "eternum-sandbox-world",
    mode: "eternum",
    name: "Season world",
    description: "The live season launch.",
    defaults: {
      startRule: "next_hour",
      devMode: false,
      twoPlayerMode: false,
      singleRealmMode: false,
    },
  },
  {
    id: "blitz-sandbox",
    mode: "blitz",
    name: "Sandbox",
    description: "A roomy test run with dev mode on.",
    defaults: {
      startRule: "next_hour",
      durationMinutes: 5 * MINUTES_PER_DAY,
      devMode: true,
      twoPlayerMode: false,
      singleRealmMode: false,
    },
  },
  {
    id: "blitz-open",
    mode: "blitz",
    name: "Open",
    description: "A balanced 90-minute blitz.",
    defaults: {
      startRule: "next_hour",
      durationMinutes: 90,
      devMode: false,
      twoPlayerMode: false,
      singleRealmMode: false,
    },
  },
  {
    id: "blitz-duel",
    mode: "blitz",
    name: "Duel",
    description: "The same pace, ready for head-to-head play.",
    defaults: {
      startRule: "next_hour",
      durationMinutes: 90,
      devMode: false,
      twoPlayerMode: true,
      singleRealmMode: false,
    },
  },
  {
    id: "blitz-fast",
    mode: "blitz",
    name: "Fast",
    description: "A shorter run when you want a quicker turnaround.",
    defaults: {
      startRule: "next_hour",
      durationMinutes: MINUTES_PER_HOUR,
      devMode: false,
      twoPlayerMode: false,
      singleRealmMode: false,
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

const resolveFactoryEnvironmentChain = (environment: string): Chain => {
  const [chain] = environment.split(".");
  return chain === "mainnet" ? "mainnet" : "slot";
};

const resolveFactoryEnvironmentLabel = (environment: string) =>
  FACTORY_ENVIRONMENT_LABELS[environment] ??
  environment.replace(/\..+$/, "").replace(/(^\w|-\w)/g, (value) => value.replace("-", " ").toUpperCase());

const resolvePresetStartAtValue = (startRule: FactoryLaunchStartRule, now = new Date()) => {
  if (startRule === "next_hour") {
    return formatDateTimeLocalValue(buildNextHourDate(now));
  }

  return formatDateTimeLocalValue(now);
};

export const getFactoryEnvironmentOptions = (mode: FactoryGameMode): FactoryEnvironmentOption[] =>
  FACTORY_ENVIRONMENTS_BY_MODE[mode].map((environment) => ({
    id: environment,
    label: resolveFactoryEnvironmentLabel(environment),
    mode,
    chain: resolveFactoryEnvironmentChain(environment),
  }));

export const getDefaultEnvironmentIdForMode = (mode: FactoryGameMode) =>
  getFactoryEnvironmentOptions(mode)[0]?.id ?? "";

export const getFactoryLaunchPresetsForMode = (mode: FactoryGameMode) =>
  factoryLaunchPresets.filter((preset) => preset.mode === mode);

export const getDefaultPresetIdForModeSelection = (mode: FactoryGameMode) =>
  getFactoryLaunchPresetsForMode(mode)[0]?.id ?? "";

export const getFactoryPresetById = (presetId: string) =>
  factoryLaunchPresets.find((preset) => preset.id === presetId) ?? null;

export const getPresetStartAtValue = (preset: FactoryLaunchPreset, now = new Date()) =>
  resolvePresetStartAtValue(preset.defaults.startRule, now);
