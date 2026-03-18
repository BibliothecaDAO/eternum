import type {
  FactoryEnvironmentOption,
  FactoryGameMode,
  FactoryLaunchChain,
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
    strapline: "Larger worlds with a few extra finishing touches.",
    description: "Use this when you are launching a full Eternum world.",
    accentClassName: "from-gold/30 via-orange/20 to-red-900/30",
    focusLabel: "Bigger launch, clearer recovery",
    stepPrinciples: ["Keep the flow calm", "Show what needs attention", "Hide the heavy lifting"],
  },
  {
    id: "blitz",
    label: "Blitz",
    strapline: "Quick games with a short setup path.",
    description: "Use this for fast games that should feel easy to start and easy to check.",
    accentClassName: "from-amber-200/30 via-orange-200/10 to-stone-900/35",
    focusLabel: "Fast start, low noise",
    stepPrinciples: ["Keep it simple", "Show progress clearly", "Hide extra setup"],
  },
];

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
  {
    id: "eternum-sandbox-world",
    mode: "eternum",
    name: "Live world",
    description: "Use this when the real world is ready to go live.",
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
    description: "A long test game with dev mode on.",
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
    description: "A standard 90-minute game.",
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
    description: "A standard 90-minute head-to-head game.",
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
    description: "A shorter one-hour game.",
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

const resolveFactoryEnvironmentChain = (environment: string): FactoryLaunchChain => {
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
