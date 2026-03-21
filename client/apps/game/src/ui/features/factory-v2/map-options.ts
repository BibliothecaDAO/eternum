import {
  DEFAULT_TOKEN_PRECISION,
  formatIntegerStringTokenAmount,
  parseTokenAmountToIntegerString,
} from "@/ui/utils/token-amount";
import type {
  BlitzExplorationReward,
  Config,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import { findResourceById } from "@bibliothecadao/types";
import { getConfigFromNetwork, resolveBlitzConfigForDuration } from "@config";
import type { FactoryGameMode, FactoryLaunchChain } from "./types";

type ExplorationConfig = Config["exploration"];
type BlitzExplorationConfig = Config["blitz"]["exploration"];
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
  | "maxPlayers"
  | "prizeToken"
  | "prizeAmount"
  | "prizePrecision";

type FactoryMoreOptionSectionId = "discovery" | "hyperstructure" | "relic" | "players" | "prize" | "explorationRewards";
type FactoryMoreOptionPlacement = "advanced" | "blitz-setup";
type FactoryMoreOptionsVisibility = {
  twoPlayerMode?: boolean;
};

interface FactoryMoreOptionsConfigContext {
  explorationConfig: ExplorationConfig;
  blitzExplorationConfig: BlitzExplorationConfig | null;
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
  inputMode: "decimal" | "numeric" | "text";
  inputType: "number" | "text";
  step?: string;
  min?: number;
  max?: number;
  unitLabel?: string;
  placeholder?: string;
}

export interface FactoryMoreOptionSection {
  id: FactoryMoreOptionSectionId;
  title: string;
  description: string;
  fields: FactoryMoreOptionField[];
  previewRows?: FactoryMoreOptionPreviewRow[];
}

export interface FactoryMoreOptionPreviewRow {
  id: string;
  label: string;
  amountLabel: string;
  probabilityLabel: string;
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

const PERCENTAGE_MAX = 100;
const PERCENTAGE_PAIR_SUM_U16 = 65_535;
const PERCENTAGE_PAIR_SUM_HYPERSTRUCTURE = 100_000;
const RELIC_DISCOVERY_INTERVAL_SECONDS_PER_MINUTE = 60;
const BLITZ_MAX_PLAYERS_MIN = 1;
const BLITZ_PRIZE_DEFAULT_AMOUNT_LABEL = "Entry cost";
const BLITZ_PRIZE_DEFAULT_TOKEN_LABEL = "Entry ticket payment token address";
const BLITZ_PRIZE_DEFAULT_PRECISION_LABEL = "Token decimals";
const STARKNET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]+$/;
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
  prizeToken: "",
  prizeAmount: "",
  prizePrecision: "",
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
  prize: {
    title: "Entry Ticket",
    description: "Token and amount",
  },
  explorationRewards: {
    title: "Exploration rewards",
    description: "Active Blitz reward table",
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
  prizeToken: null,
  prizeAmount: null,
  prizePrecision: null,
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
    case "prizeToken":
      return "Token address used for Blitz prize fees.";
    case "prizeAmount":
      return "Human-readable amount, like 500 or 0.00004.";
    case "prizePrecision":
      return "Decimals used to convert the displayed amount into the raw onchain value.";
  }
};

const resolveConfig = (mode: FactoryGameMode, chain: FactoryLaunchChain, durationMinutes?: number | null) => {
  if (mode === "blitz") {
    return resolveBlitzConfigForDuration(chain, durationMinutes);
  }

  return getConfigFromNetwork(chain, mode);
};
const resolveMoreOptionsConfigContext = (
  mode: FactoryGameMode,
  chain: FactoryLaunchChain,
  durationMinutes?: number | null,
): FactoryMoreOptionsConfigContext => {
  const config = resolveConfig(mode, chain, durationMinutes);

  return {
    explorationConfig: config.exploration,
    blitzExplorationConfig: mode === "blitz" ? config.blitz.exploration : null,
    blitzRegistrationConfig: config.blitz.registration,
  };
};

function formatProbabilityFromBps(probabilityBps: number): string {
  const probabilityPercent = probabilityBps / 100;

  if (Number.isInteger(probabilityPercent)) {
    return `${probabilityPercent}%`;
  }

  return `${probabilityPercent.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function resolveBlitzExplorationRewardLabel(reward: BlitzExplorationReward): string {
  const resource = findResourceById(reward.rewardId);
  return resource?.trait ?? String(reward.rewardId);
}

function buildBlitzExplorationRewardRows(
  blitzExplorationConfig: BlitzExplorationConfig,
): FactoryMoreOptionPreviewRow[] {
  return blitzExplorationConfig.rewards.map((reward, index) => ({
    id: `${blitzExplorationConfig.rewardProfileId}-${index}-${reward.rewardId}`,
    label: resolveBlitzExplorationRewardLabel(reward),
    amountLabel: `${reward.amount.toLocaleString()}`,
    probabilityLabel: formatProbabilityFromBps(reward.probabilityBps),
  }));
}

function buildBlitzPrizeFields(): FactoryMoreOptionField[] {
  return [
    {
      id: "prizeToken",
      label: BLITZ_PRIZE_DEFAULT_TOKEN_LABEL,
      helperText: "Token address used for Blitz prize fees.",
      inputMode: "text",
      inputType: "text",
      placeholder: "0x...",
    },
    {
      id: "prizeAmount",
      label: BLITZ_PRIZE_DEFAULT_AMOUNT_LABEL,
      helperText: "Human-readable amount, like 500 or 0.00004.",
      inputMode: "decimal",
      inputType: "text",
      placeholder: "500",
    },
    {
      id: "prizePrecision",
      label: BLITZ_PRIZE_DEFAULT_PRECISION_LABEL,
      helperText: "Defaults to 18 unless you change the token address.",
      inputMode: "numeric",
      inputType: "number",
      min: 0,
      max: 255,
      step: "1",
      unitLabel: "dec",
      placeholder: "18",
    },
  ];
}

function createBlitzPrizeDraft(blitzRegistrationConfig: BlitzRegistrationConfig): Partial<FactoryMoreOptionsDraft> {
  return {
    prizeToken: String(blitzRegistrationConfig.fee_token ?? ""),
    prizeAmount: formatIntegerStringTokenAmount(blitzRegistrationConfig.fee_amount, DEFAULT_TOKEN_PRECISION),
    prizePrecision: "",
  };
}

function normalizeStarknetAddress(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeIntegerString(value: unknown): string {
  const digits = String(value ?? "").trim();

  if (!/^\d+$/.test(digits)) {
    return "";
  }

  return digits.replace(/^0+(?=\d)/, "") || "0";
}

function resolvePrizePrecisionValue(
  draftPrecision: string,
  requiresExplicitPrecision: boolean,
): { precision: number | null; error: string | null } {
  const trimmedPrecision = draftPrecision.trim();

  if (!trimmedPrecision) {
    return requiresExplicitPrecision
      ? { precision: null, error: "Token decimals are required when the prize token address changes." }
      : { precision: DEFAULT_TOKEN_PRECISION, error: null };
  }

  if (!/^\d+$/.test(trimmedPrecision)) {
    return { precision: null, error: "Token decimals must be a whole number between 0 and 255." };
  }

  const precision = Number(trimmedPrecision);

  if (!Number.isInteger(precision) || precision < 0 || precision > 255) {
    return { precision: null, error: "Token decimals must be a whole number between 0 and 255." };
  }

  return { precision, error: null };
}

function validateBlitzPrizeOverrides(
  draft: FactoryMoreOptionsDraft,
  blitzRegistrationConfig: BlitzRegistrationConfig,
): {
  errors: Pick<FactoryMoreOptionsErrors, "prizeToken" | "prizeAmount" | "prizePrecision">;
  overrides?: FactoryBlitzRegistrationOverrides;
  firstError: string | null;
} {
  const errors: Pick<FactoryMoreOptionsErrors, "prizeToken" | "prizeAmount" | "prizePrecision"> = {
    prizeToken: null,
    prizeAmount: null,
    prizePrecision: null,
  };

  const defaultToken = String(blitzRegistrationConfig.fee_token ?? "");
  const normalizedDefaultToken = normalizeStarknetAddress(defaultToken);
  const normalizedDraftToken = normalizeStarknetAddress(draft.prizeToken);
  const tokenChanged = normalizedDraftToken !== normalizedDefaultToken;

  if (!draft.prizeToken.trim()) {
    errors.prizeToken = "Prize token address is required.";
  } else if (!STARKNET_ADDRESS_PATTERN.test(draft.prizeToken.trim())) {
    errors.prizeToken = 'Prize token address must be a valid "0x" address.';
  }

  const { precision, error: precisionError } = resolvePrizePrecisionValue(draft.prizePrecision, tokenChanged);
  if (precisionError) {
    errors.prizePrecision = precisionError;
  }

  let parsedAmount: string | null = null;

  if (!draft.prizeAmount.trim()) {
    errors.prizeAmount = "Entry amount is required.";
  } else if (precision !== null) {
    try {
      parsedAmount = parseTokenAmountToIntegerString(draft.prizeAmount, precision, BLITZ_PRIZE_DEFAULT_AMOUNT_LABEL);
    } catch (error) {
      errors.prizeAmount = error instanceof Error ? error.message : "Entry amount is invalid.";
    }
  }

  const firstError = errors.prizeToken ?? errors.prizePrecision ?? errors.prizeAmount;

  if (firstError || parsedAmount === null) {
    return { errors, firstError };
  }

  const defaultAmount = normalizeIntegerString(blitzRegistrationConfig.fee_amount);
  const amountChanged = parsedAmount !== defaultAmount;

  if (!tokenChanged && !amountChanged) {
    return { errors, firstError: null };
  }

  return {
    errors,
    overrides: {
      ...(tokenChanged ? { fee_token: draft.prizeToken.trim() } : {}),
      fee_amount: parsedAmount,
    },
    firstError: null,
  };
}

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
  durationMinutes?: number | null,
): FactoryMoreOptionsDraft => {
  const { explorationConfig, blitzRegistrationConfig } = resolveMoreOptionsConfigContext(mode, chain, durationMinutes);

  const numericDraft = FIELD_DEFINITIONS.reduce<FactoryMoreOptionsDraft>(
    (draft, definition) => ({
      ...draft,
      [definition.id]: resolveDefaultFieldValue(definition, explorationConfig, blitzRegistrationConfig),
    }),
    EMPTY_MORE_OPTIONS_DRAFT,
  );

  if (mode !== "blitz") {
    return numericDraft;
  }

  return {
    ...numericDraft,
    ...createBlitzPrizeDraft(blitzRegistrationConfig),
  };
};

export const getFactoryMoreOptionSections = (
  mode: FactoryGameMode,
  visibility: FactoryMoreOptionsVisibility = {},
  chain: FactoryLaunchChain = "slot",
  durationMinutes?: number | null,
): FactoryMoreOptionSection[] => {
  const { blitzExplorationConfig } = resolveMoreOptionsConfigContext(mode, chain, durationMinutes);
  const sections = new Map<FactoryMoreOptionSectionId, FactoryMoreOptionField[]>();

  getFieldDefinitionsForPlacement(mode, visibility, "advanced").forEach((definition) => {
    const nextField: FactoryMoreOptionField = {
      id: definition.id,
      label: resolveFieldLabel(definition, mode),
      helperText: resolveFieldHelperText(definition, mode),
      inputMode: definition.kind === "integer" ? "numeric" : "decimal",
      inputType: "number",
      step: definition.step,
      min: definition.kind === "percentage-pair" ? 0 : definition.min,
      max: definition.kind === "percentage-pair" ? PERCENTAGE_MAX : definition.max,
      unitLabel: resolveFieldUnitLabel(definition),
    };
    const sectionFields = sections.get(definition.section) ?? [];
    sectionFields.push(nextField);
    sections.set(definition.section, sectionFields);
  });

  if (mode === "blitz" && !visibility.twoPlayerMode) {
    sections.set("prize", buildBlitzPrizeFields());
  }

  const advancedSections = Array.from(sections.entries()).map(([id, fields]) => ({
    id,
    title: SECTION_METADATA[id].title,
    description: SECTION_METADATA[id].description,
    fields,
  }));

  if (!blitzExplorationConfig) {
    return advancedSections;
  }

  return [
    ...advancedSections,
    {
      id: "explorationRewards",
      title: SECTION_METADATA.explorationRewards.title,
      description: SECTION_METADATA.explorationRewards.description,
      fields: [],
      previewRows: buildBlitzExplorationRewardRows(blitzExplorationConfig),
    },
  ];
};

export const getFactoryMoreOptionField = (
  mode: FactoryGameMode,
  fieldId: FactoryMoreOptionFieldId,
  visibility: FactoryMoreOptionsVisibility = {},
): FactoryMoreOptionField | null => {
  if (mode === "blitz" && !visibility.twoPlayerMode) {
    const blitzPrizeField = buildBlitzPrizeFields().find((field) => field.id === fieldId);

    if (blitzPrizeField) {
      return blitzPrizeField;
    }
  }

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
    inputMode: definition.kind === "integer" ? "numeric" : "decimal",
    inputType: "number",
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
  durationMinutes?: number | null,
): FactoryMoreOptionsValidationResult => {
  const { explorationConfig, blitzRegistrationConfig } = resolveMoreOptionsConfigContext(mode, chain, durationMinutes);
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

  if (mode === "blitz" && !visibility.twoPlayerMode) {
    const blitzPrizeValidation = validateBlitzPrizeOverrides(draft, blitzRegistrationConfig);

    errors.prizeToken = blitzPrizeValidation.errors.prizeToken;
    errors.prizeAmount = blitzPrizeValidation.errors.prizeAmount;
    errors.prizePrecision = blitzPrizeValidation.errors.prizePrecision;
    firstError ??= blitzPrizeValidation.firstError;

    if (blitzPrizeValidation.overrides) {
      Object.assign(blitzRegistrationOverrides, blitzPrizeValidation.overrides);
    }
  }

  return {
    errors,
    mapConfigOverrides: Object.keys(mapConfigOverrides).length > 0 ? mapConfigOverrides : undefined,
    blitzRegistrationOverrides:
      Object.keys(blitzRegistrationOverrides).length > 0 ? blitzRegistrationOverrides : undefined,
    firstError,
    hasErrors: firstError !== null,
  };
};
