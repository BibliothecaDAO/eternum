/**
 * ABI-driven pipeline: parse manifest → generate policies, actions, executor.
 */
export type {
  ABIParam,
  ABIEntrypoint,
  ContractABIResult,
  PolicyMethod,
  GeneratedPolicies,
  ManifestContract,
  Manifest,
  ParamOverride,
  DomainOverlay,
  DomainOverlayMap,
  ActionResult,
  GameAction,
  ActionRoute,
} from "./types";

export {
  simplifyType,
  extractFromABI,
  extractAllFromManifest,
  getGameEntrypoints,
  tagMatchesGame,
  abiTypeToParamSchemaType,
} from "./parser";

export { generateActions, getAllActionTypes, mergeCompositeActions } from "./action-gen";
export type { GeneratedActions } from "./action-gen";

export { createABIExecutor } from "./executor";
export type { ABIExecutor, ABIExecutorOptions } from "./executor";

export {
  ETERNUM_OVERLAYS,
  HIDDEN_SUFFIXES,
  createHiddenOverlays,
  RESOURCE_PRECISION,
  RESOURCE_IDS,
  BUILDING_TYPES,
  BUILDING_GUIDE,
  num,
  precisionAmount,
  bool,
  numArray,
  resourceTuples,
  stealResourceTuples,
  contributionTuples,
} from "./domain-overlay";
