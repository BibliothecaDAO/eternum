import type {
  FactoryEnvironmentOption,
  FactoryGameMode,
  FactoryLaunchChain,
  FactoryLaunchPreset,
  FactoryLaunchStartRule,
  FactoryModeDefinition,
} from "./types";

const FACTORY_ENVIRONMENT_LABELS: Record<string, string> = {
  "appchain.eternum": "Appchain",
  "appchain.blitz": "Appchain",
};

const FACTORY_ENVIRONMENTS_BY_MODE: Record<FactoryGameMode, string[]> = {
  eternum: ["appchain.eternum"],
  blitz: ["appchain.blitz"],
};

/** `<chain>.<mode>` -> chain, so a new environment only needs a list entry. */
const resolveFactoryLaunchChain = (_environmentId: string): FactoryLaunchChain => "appchain";

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
    chain: resolveFactoryLaunchChain(environment),
  }));

export const getDefaultEnvironmentIdForMode = (mode: FactoryGameMode) =>
  getFactoryEnvironmentOptions(mode)[0]?.id ?? "";

export const resolveFactoryEnvironmentIdForModeAndChain = (mode: FactoryGameMode, chain: FactoryLaunchChain) =>
  getFactoryEnvironmentOptions(mode).find((environment) => environment.chain === chain)?.id ??
  getDefaultEnvironmentIdForMode(mode);

export const getFactoryLaunchPresetsForMode = (mode: FactoryGameMode) =>
  factoryLaunchPresets.filter((preset) => preset.mode === mode);

export const getDefaultPresetIdForModeSelection = (mode: FactoryGameMode) =>
  getFactoryLaunchPresetsForMode(mode)[0]?.id ?? "";

export const getFactoryPresetById = (presetId: string) =>
  factoryLaunchPresets.find((preset) => preset.id === presetId) ?? null;

export const getPresetStartAtValue = (preset: FactoryLaunchPreset, now = new Date()) =>
  resolvePresetStartAtValue(preset.defaults.startRule, now);
