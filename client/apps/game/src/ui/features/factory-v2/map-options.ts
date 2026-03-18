import { getConfigFromNetwork } from "@config";
import type { Config, FactoryBlitzRegistrationOverrides, FactoryMapConfigOverrides } from "@bibliothecadao/types";
import type { FactoryGameMode, FactoryLaunchChain } from "./types";

type ExplorationConfig = Config["exploration"];
type BlitzRegistrationConfig = Config["blitz"]["registration"];

type PairOverrideKey =
  | "shardsMinesWinProbability"
  | "shardsMinesFailProbability"
  | "agentFindProbability"
  | "agentFindFailProbability"
  | "campFindProbability"
  | "campFindFailProbability"
  | "holysiteFindProbability"
  | "holysiteFindFailProbability"
  | "bitcoinMineWinProbability"
  | "bitcoinMineFailProbability"
  | "hyperstructureWinProbAtCenter"
  | "hyperstructureFailProbAtCenter";

type DirectOverrideKey =
  | "hyperstructureFailProbIncreasePerHexDistance"
  | "hyperstructureFailProbIncreasePerHyperstructureFound"
  | "relicDiscoveryIntervalSeconds"
  | "relicHexDistanceFromCenter"
  | "relicChestRelicsPerChest";

type BlitzRegistrationOverrideKey = "registration_count_max";

export type FactoryMoreOptionFieldId =
  | "shards"
  | "camp"
  | "agent"
  | "holysite"
  | "bitcoinMine"
  | "hyperstructureCenter"
  | "hyperstructureRadiusMultiplier"
  | "hyperstructureChanceLossPerFound"
  | "relicDiscoveryInterval"
  | "relicHexDistance"
  | "relicsPerChest"
  | "maxPlayers";

type FactoryMoreOptionSectionId = "discovery" | "hyperstructure" | "relic" | "players";
type FactoryMoreOptionPlacement = "advanced" | "blitz-setup";
type FactoryMoreOptionsVisibility = {
  twoPlayerMode?: boolean;
};

interface FactoryMoreOptionsConfigContext {
  explorationConfig: ExplorationConfig;
  blitzRegistrationConfig: BlitzRegistrationConfig;
}

type FactoryMoreOptionDefinition =
  | {
      id: FactoryMoreOptionFieldId;
      section: FactoryMoreOptionSectionId;
      modes: FactoryGameMode[];
      isVisible?: (visibility: FactoryMoreOptionsVisibility) => boolean;
      kind: "percentage-pair";
      label: string | ((mode: FactoryGameMode) => string);
      step: string;
      pairSum: number;
      winKey: PairOverrideKey;
      failKey: PairOverrideKey;
    }
  | {
      id: FactoryMoreOptionFieldId;
      section: FactoryMoreOptionSectionId;
      modes: FactoryGameMode[];
      isVisible?: (visibility: FactoryMoreOptionsVisibility) => boolean;
      kind: "scaled-percentage";
      label: string;
      step: string;
      min: number;
      max: number;
      scale: number;
      rawKey: DirectOverrideKey;
    }
  | {
      id: FactoryMoreOptionFieldId;
      section: FactoryMoreOptionSectionId;
      modes: FactoryGameMode[];
      isVisible?: (visibility: FactoryMoreOptionsVisibility) => boolean;
      kind: "integer";
      label: string;
      step: string;
      min: number;
      max: number;
      displayScale?: number;
      unitLabel?: string;
      placement?: FactoryMoreOptionPlacement;
      destination: "map-config";
      rawKey: DirectOverrideKey;
    }
  | {
      id: FactoryMoreOptionFieldId;
      section: FactoryMoreOptionSectionId;
      modes: FactoryGameMode[];
      isVisible?: (visibility: FactoryMoreOptionsVisibility) => boolean;
      kind: "integer";
      label: string;
      step: string;
      min: number;
      max: number;
      displayScale?: number;
      unitLabel?: string;
      placement?: FactoryMoreOptionPlacement;
      destination: "blitz-registration";
      rawKey: BlitzRegistrationOverrideKey;
    };

export interface FactoryMoreOptionField {
  id: FactoryMoreOptionFieldId;
  label: string;
  helperText: string;
  inputMode: "percentage" | "integer";
  step: string;
  min: number;
  max: number;
  unitLabel?: string;
}

export interface FactoryMoreOptionSection {
  id: FactoryMoreOptionSectionId;
  title: string;
  description: string;
  fields: FactoryMoreOptionField[];
}

export type FactoryMoreOptionsDraft = Record<FactoryMoreOptionFieldId, string>;
export type FactoryMoreOptionsErrors = Record<FactoryMoreOptionFieldId, string | null>;

interface FactoryMoreOptionsValidationResult {
  errors: FactoryMoreOptionsErrors;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  firstError: string | null;
  hasErrors: boolean;
}

export type FactoryMapOptionFieldId = FactoryMoreOptionFieldId;
export type FactoryMapOptionSection = FactoryMoreOptionSection;
export type FactoryMapOptionField = FactoryMoreOptionField;
export type FactoryMapOptionsDraft = FactoryMoreOptionsDraft;
export type FactoryMapOptionsErrors = FactoryMoreOptionsErrors;

const PERCENTAGE_MAX = 100;
const PERCENTAGE_PAIR_SUM_U16 = 65_535;
const PERCENTAGE_PAIR_SUM_HYPERSTRUCTURE = 100_000;
const RELIC_DISCOVERY_INTERVAL_SECONDS_PER_MINUTE = 60;
const BLITZ_MAX_PLAYERS_MIN = 1;
const EMPTY_MORE_OPTIONS_DRAFT: FactoryMoreOptionsDraft = {
  shards: "",
  camp: "",
  agent: "",
  holysite: "",
  bitcoinMine: "",
  hyperstructureCenter: "",
  hyperstructureRadiusMultiplier: "",
  hyperstructureChanceLossPerFound: "",
  relicDiscoveryInterval: "",
  relicHexDistance: "",
  relicsPerChest: "",
  maxPlayers: "",
};
const SECTION_METADATA: Record<
  FactoryMoreOptionSectionId,
  {
    title: string;
    description: string;
  }
> = {
  discovery: {
    title: "Discovery",
    description: "Find chances",
  },
  hyperstructure: {
    title: "Hyperstructures",
    description: "Center and decay",
  },
  relic: {
    title: "Relics",
    description: "Blitz map tuning",
  },
  players: {
    title: "Players",
    description: "Blitz registration cap",
  },
};

const FIELD_DEFINITIONS: FactoryMoreOptionDefinition[] = [
  {
    id: "shards",
    section: "discovery",
    modes: ["eternum", "blitz"],
    kind: "percentage-pair",
    label: (mode) => (mode === "blitz" ? "Essence Rift chance" : "Shard Mine chance"),
    step: "0.001",
    pairSum: PERCENTAGE_PAIR_SUM_U16,
    winKey: "shardsMinesWinProbability",
    failKey: "shardsMinesFailProbability",
  },
  {
    id: "camp",
    section: "discovery",
    modes: ["eternum", "blitz"],
    kind: "percentage-pair",
    label: "Camp chance",
    step: "0.001",
    pairSum: PERCENTAGE_PAIR_SUM_U16,
    winKey: "campFindProbability",
    failKey: "campFindFailProbability",
  },
  {
    id: "agent",
    section: "discovery",
    modes: ["eternum", "blitz"],
    kind: "percentage-pair",
    label: "Agent chance",
    step: "0.001",
    pairSum: PERCENTAGE_PAIR_SUM_U16,
    winKey: "agentFindProbability",
    failKey: "agentFindFailProbability",
  },
  {
    id: "holysite",
    section: "discovery",
    modes: ["eternum"],
    kind: "percentage-pair",
    label: "Holy Site chance",
    step: "0.001",
    pairSum: PERCENTAGE_PAIR_SUM_U16,
    winKey: "holysiteFindProbability",
    failKey: "holysiteFindFailProbability",
  },
  {
    id: "bitcoinMine",
    section: "discovery",
    modes: ["eternum"],
    kind: "percentage-pair",
    label: "Bitcoin Mine chance",
    step: "0.001",
    pairSum: PERCENTAGE_PAIR_SUM_U16,
    winKey: "bitcoinMineWinProbability",
    failKey: "bitcoinMineFailProbability",
  },
  {
    id: "hyperstructureCenter",
    section: "hyperstructure",
    modes: ["eternum"],
    kind: "percentage-pair",
    label: "Center chance",
    step: "0.001",
    pairSum: PERCENTAGE_PAIR_SUM_HYPERSTRUCTURE,
    winKey: "hyperstructureWinProbAtCenter",
    failKey: "hyperstructureFailProbAtCenter",
  },
  {
    id: "hyperstructureRadiusMultiplier",
    section: "hyperstructure",
    modes: ["eternum"],
    kind: "scaled-percentage",
    label: "Radius multiplier",
    step: "0.01",
    min: 0,
    max: 655.35,
    scale: 10_000,
    rawKey: "hyperstructureFailProbIncreasePerHexDistance",
  },
  {
    id: "hyperstructureChanceLossPerFound",
    section: "hyperstructure",
    modes: ["eternum"],
    kind: "scaled-percentage",
    label: "Chance loss per found",
    step: "0.001",
    min: 0,
    max: 65.535,
    scale: 100_000,
    rawKey: "hyperstructureFailProbIncreasePerHyperstructureFound",
  },
  {
    id: "relicDiscoveryInterval",
    section: "relic",
    modes: ["blitz"],
    kind: "integer",
    label: "Relic discovery interval",
    step: "1",
    min: 0,
    max: Math.floor(65_535 / RELIC_DISCOVERY_INTERVAL_SECONDS_PER_MINUTE),
    displayScale: RELIC_DISCOVERY_INTERVAL_SECONDS_PER_MINUTE,
    unitLabel: "min",
    destination: "map-config",
    rawKey: "relicDiscoveryIntervalSeconds",
  },
  {
    id: "relicHexDistance",
    section: "relic",
    modes: ["blitz"],
    kind: "integer",
    label: "Hex distance from center",
    step: "1",
    min: 0,
    max: 255,
    destination: "map-config",
    rawKey: "relicHexDistanceFromCenter",
  },
  {
    id: "relicsPerChest",
    section: "relic",
    modes: ["blitz"],
    kind: "integer",
    label: "Relics per chest",
    step: "1",
    min: 0,
    max: 255,
    destination: "map-config",
    rawKey: "relicChestRelicsPerChest",
  },
  {
    id: "maxPlayers",
    section: "players",
    modes: ["blitz"],
    isVisible: ({ twoPlayerMode }) => !twoPlayerMode,
    kind: "integer",
    label: "Max players",
    step: "1",
    min: BLITZ_MAX_PLAYERS_MIN,
    max: 65_535,
    unitLabel: "players",
    placement: "blitz-setup",
    destination: "blitz-registration",
    rawKey: "registration_count_max",
  },
];

const getFieldDefinitionsForMode = (mode: FactoryGameMode, visibility: FactoryMoreOptionsVisibility = {}) =>
  FIELD_DEFINITIONS.filter(
    (definition) => definition.modes.includes(mode) && (definition.isVisible ? definition.isVisible(visibility) : true),
  );

const matchesFactoryMoreOptionPlacement = (
  definition: FactoryMoreOptionDefinition,
  placement: FactoryMoreOptionPlacement | "all",
) => {
  if (placement === "all") {
    return true;
  }

  if (definition.kind !== "integer") {
    return placement === "advanced";
  }

  return (definition.placement ?? "advanced") === placement;
};

const getFieldDefinitionsForPlacement = (
  mode: FactoryGameMode,
  visibility: FactoryMoreOptionsVisibility = {},
  placement: FactoryMoreOptionPlacement | "all" = "all",
) =>
  getFieldDefinitionsForMode(mode, visibility).filter((definition) =>
    matchesFactoryMoreOptionPlacement(definition, placement),
  );

const buildEmptyErrors = (): FactoryMoreOptionsErrors => ({
  shards: null,
  camp: null,
  agent: null,
  holysite: null,
  bitcoinMine: null,
  hyperstructureCenter: null,
  hyperstructureRadiusMultiplier: null,
  hyperstructureChanceLossPerFound: null,
  relicDiscoveryInterval: null,
  relicHexDistance: null,
  relicsPerChest: null,
  maxPlayers: null,
});

const resolveFieldLabel = (definition: FactoryMoreOptionDefinition, mode: FactoryGameMode) =>
  typeof definition.label === "function" ? definition.label(mode) : definition.label;

const resolveFieldUnitLabel = (definition: FactoryMoreOptionDefinition): string | undefined => {
  if (definition.kind === "percentage-pair" || definition.kind === "scaled-percentage") {
    return "%";
  }

  return definition.unitLabel;
};

const resolveFieldHelperText = (definition: FactoryMoreOptionDefinition, mode: FactoryGameMode): string => {
  switch (definition.id) {
    case "shards":
      return mode === "blitz" ? "Percent chance to find an Essence Rift." : "Percent chance to find a Shard Mine.";
    case "camp":
      return "Percent chance to find a Camp.";
    case "agent":
      return "Percent chance to find an Agent.";
    case "holysite":
      return "Percent chance to find a Holy Site.";
    case "bitcoinMine":
      return "Percent chance to find a Bitcoin Mine.";
    case "hyperstructureCenter":
      return "Percent chance to find a Hyperstructure at the center.";
    case "hyperstructureRadiusMultiplier":
      return "How quickly Hyperstructure chance falls with distance.";
    case "hyperstructureChanceLossPerFound":
      return "Extra chance loss after each Hyperstructure is found.";
    case "relicDiscoveryInterval":
      return "Minutes between relic discovery checks.";
    case "relicHexDistance":
      return "Maximum relic distance from the center.";
    case "relicsPerChest":
      return "How many relics each chest contains.";
    case "maxPlayers":
      return "Caps how many players can register for this Blitz launch.";
  }
};

const resolveConfig = (mode: FactoryGameMode, chain: FactoryLaunchChain) => getConfigFromNetwork(chain, mode);
const resolveMoreOptionsConfigContext = (
  mode: FactoryGameMode,
  chain: FactoryLaunchChain,
): FactoryMoreOptionsConfigContext => {
  const config = resolveConfig(mode, chain);

  return {
    explorationConfig: config.exploration,
    blitzRegistrationConfig: config.blitz.registration,
  };
};

const resolveDecimals = (step: string) => {
  const [, decimals = ""] = step.split(".");
  return decimals.length;
};

const formatDisplayValue = (value: number, step: string) => {
  const decimals = resolveDecimals(step);

  if (decimals === 0) {
    return String(Math.round(value));
  }

  return value.toFixed(decimals).replace(/\.?0+$/, "");
};

const resolveDefaultFieldValue = (
  definition: FactoryMoreOptionDefinition,
  explorationConfig: ExplorationConfig,
  blitzRegistrationConfig: BlitzRegistrationConfig,
) => {
  switch (definition.kind) {
    case "percentage-pair": {
      const win = explorationConfig[definition.winKey];
      const fail = explorationConfig[definition.failKey];
      const total = win + fail;
      const percentage = total > 0 ? (win / total) * PERCENTAGE_MAX : 0;
      return formatDisplayValue(percentage, definition.step);
    }
    case "scaled-percentage":
      return formatDisplayValue(
        (explorationConfig[definition.rawKey] / definition.scale) * PERCENTAGE_MAX,
        definition.step,
      );
    case "integer":
      if (definition.destination === "blitz-registration") {
        return String(blitzRegistrationConfig[definition.rawKey]);
      }

      return formatDisplayValue(explorationConfig[definition.rawKey] / (definition.displayScale ?? 1), definition.step);
  }
};

const parseNumericInput = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildRangeError = (definition: FactoryMoreOptionDefinition, label: string) => {
  switch (definition.kind) {
    case "percentage-pair":
      return `${label} must be between 0% and 100%.`;
    case "integer":
      return `${label} must be an integer between ${definition.min} and ${definition.max}.`;
    case "scaled-percentage":
      return `${label} must be between ${definition.min}% and ${definition.max}%.`;
  }
};

const validateFieldValue = (definition: FactoryMoreOptionDefinition, label: string, value: string) => {
  const parsed = parseNumericInput(value);

  if (parsed === null) {
    return `${label} is required.`;
  }

  if (definition.kind === "integer" && !Number.isInteger(parsed)) {
    return `${label} must be an integer between ${definition.min} and ${definition.max}.`;
  }

  if (definition.kind !== "percentage-pair" && (parsed < definition.min || parsed > definition.max)) {
    return buildRangeError(definition, label);
  }

  if (definition.kind === "percentage-pair" && (parsed < 0 || parsed > PERCENTAGE_MAX)) {
    return `${label} must be between 0% and 100%.`;
  }

  return null;
};

const buildRawOverrides = (
  definition: FactoryMoreOptionDefinition,
  numericValue: number,
  mapConfigOverrides: FactoryMapConfigOverrides,
  blitzRegistrationOverrides: FactoryBlitzRegistrationOverrides,
) => {
  switch (definition.kind) {
    case "percentage-pair": {
      const win = Math.round((numericValue / PERCENTAGE_MAX) * definition.pairSum);
      mapConfigOverrides[definition.winKey] = win;
      mapConfigOverrides[definition.failKey] = definition.pairSum - win;
      return;
    }
    case "scaled-percentage":
      mapConfigOverrides[definition.rawKey] = Math.round((numericValue / PERCENTAGE_MAX) * definition.scale);
      return;
    case "integer": {
      const rawValue = numericValue * (definition.displayScale ?? 1);

      if (definition.destination === "blitz-registration") {
        blitzRegistrationOverrides[definition.rawKey] = rawValue;
        return;
      }

      mapConfigOverrides[definition.rawKey] = rawValue;
      return;
    }
  }
};

export const createFactoryMoreOptionsDraft = (
  mode: FactoryGameMode,
  chain: FactoryLaunchChain,
): FactoryMoreOptionsDraft => {
  const { explorationConfig, blitzRegistrationConfig } = resolveMoreOptionsConfigContext(mode, chain);

  return FIELD_DEFINITIONS.reduce<FactoryMoreOptionsDraft>(
    (draft, definition) => ({
      ...draft,
      [definition.id]: resolveDefaultFieldValue(definition, explorationConfig, blitzRegistrationConfig),
    }),
    EMPTY_MORE_OPTIONS_DRAFT,
  );
};

export const createFactoryMapOptionsDraft = createFactoryMoreOptionsDraft;

export const getFactoryMoreOptionSections = (
  mode: FactoryGameMode,
  visibility: FactoryMoreOptionsVisibility = {},
): FactoryMoreOptionSection[] => {
  const sections = new Map<FactoryMoreOptionSectionId, FactoryMoreOptionField[]>();

  getFieldDefinitionsForPlacement(mode, visibility, "advanced").forEach((definition) => {
    const nextField: FactoryMoreOptionField = {
      id: definition.id,
      label: resolveFieldLabel(definition, mode),
      helperText: resolveFieldHelperText(definition, mode),
      inputMode: definition.kind === "integer" ? "integer" : "percentage",
      step: definition.step,
      min: definition.kind === "percentage-pair" ? 0 : definition.min,
      max: definition.kind === "percentage-pair" ? PERCENTAGE_MAX : definition.max,
      unitLabel: resolveFieldUnitLabel(definition),
    };
    const sectionFields = sections.get(definition.section) ?? [];
    sectionFields.push(nextField);
    sections.set(definition.section, sectionFields);
  });

  return Array.from(sections.entries()).map(([id, fields]) => ({
    id,
    title: SECTION_METADATA[id].title,
    description: SECTION_METADATA[id].description,
    fields,
  }));
};

export const getFactoryMapOptionSections = (mode: FactoryGameMode) => getFactoryMoreOptionSections(mode);

export const getFactoryMoreOptionField = (
  mode: FactoryGameMode,
  fieldId: FactoryMoreOptionFieldId,
  visibility: FactoryMoreOptionsVisibility = {},
): FactoryMoreOptionField | null => {
  const definition = getFieldDefinitionsForPlacement(mode, visibility, "all").find(
    (candidate) => candidate.id === fieldId,
  );

  if (!definition) {
    return null;
  }

  return {
    id: definition.id,
    label: resolveFieldLabel(definition, mode),
    helperText: resolveFieldHelperText(definition, mode),
    inputMode: definition.kind === "integer" ? "integer" : "percentage",
    step: definition.step,
    min: definition.kind === "percentage-pair" ? 0 : definition.min,
    max: definition.kind === "percentage-pair" ? PERCENTAGE_MAX : definition.max,
    unitLabel: resolveFieldUnitLabel(definition),
  };
};

export const validateFactoryMoreOptions = (
  mode: FactoryGameMode,
  chain: FactoryLaunchChain,
  draft: FactoryMoreOptionsDraft,
  visibility: FactoryMoreOptionsVisibility = {},
): FactoryMoreOptionsValidationResult => {
  const { explorationConfig, blitzRegistrationConfig } = resolveMoreOptionsConfigContext(mode, chain);
  const errors = buildEmptyErrors();
  const mapConfigOverrides: FactoryMapConfigOverrides = {};
  const blitzRegistrationOverrides: FactoryBlitzRegistrationOverrides = {};
  let firstError: string | null = null;

  getFieldDefinitionsForMode(mode, visibility).forEach((definition) => {
    const label = resolveFieldLabel(definition, mode);
    const value = draft[definition.id];
    const error = validateFieldValue(definition, label, value);
    if (error) {
      errors[definition.id] = error;
      firstError ??= error;
      return;
    }

    const parsedValue = parseNumericInput(value);
    if (parsedValue === null) {
      return;
    }

    const defaultValue = parseNumericInput(
      resolveDefaultFieldValue(definition, explorationConfig, blitzRegistrationConfig),
    );
    if (defaultValue === parsedValue) {
      return;
    }

    buildRawOverrides(definition, parsedValue, mapConfigOverrides, blitzRegistrationOverrides);
  });

  return {
    errors,
    mapConfigOverrides: Object.keys(mapConfigOverrides).length > 0 ? mapConfigOverrides : undefined,
    blitzRegistrationOverrides:
      Object.keys(blitzRegistrationOverrides).length > 0 ? blitzRegistrationOverrides : undefined,
    firstError,
    hasErrors: firstError !== null,
  };
};

export const validateFactoryMapOptions = (
  mode: FactoryGameMode,
  chain: FactoryLaunchChain,
  draft: FactoryMapOptionsDraft,
) => validateFactoryMoreOptions(mode, chain, draft);
