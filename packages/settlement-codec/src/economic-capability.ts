import economicCapabilityRegistry from "../schema/economic-capability-registry-v0.json";

export type EconomicCapabilityFamilyId =
  | "resource"
  | "structure_ownership"
  | "lazy_production"
  | "arrival"
  | "military_and_cargo"
  | "trade_and_donkey"
  | "amm_and_lp"
  | "reward_state"
  | "pending_withdrawal"
  | "active_exit_backing"
  | "player_economic_lock"
  | "exit_position"
  | "settlement_callback";

export interface EconomicCapabilityFamily {
  id: EconomicCapabilityFamilyId;
  method: string;
  requestType: string;
  resultType: string;
  actions: readonly string[];
}

export interface EconomicCapabilityOperation {
  operationId: number;
  name: string;
  family: EconomicCapabilityFamilyId;
  authorizedCallerClasses: readonly string[];
  requestType: string;
  resultType: string;
  affectedModels: readonly string[];
  backingEffect: string;
  indexEffect: string;
}

export interface EconomicCapabilityRegistry {
  version: 0;
  status: "a9-feasibility-candidate";
  families: readonly EconomicCapabilityFamily[];
  operations: readonly EconomicCapabilityOperation[];
}

const REGISTRY = economicCapabilityRegistry as EconomicCapabilityRegistry;
const OPERATION_BY_ID = new Map(REGISTRY.operations.map((operation) => [operation.operationId, operation]));

export function getEconomicCapabilityRegistry(): EconomicCapabilityRegistry {
  return REGISTRY;
}

export function getEconomicCapabilityOperation(operationId: number): EconomicCapabilityOperation {
  const operation = OPERATION_BY_ID.get(operationId);
  if (!operation) throw new Error(`unregistered economic operation: ${operationId}`);
  return operation;
}

export function getEconomicCapabilitiesForCaller(callerClass: string): readonly EconomicCapabilityOperation[] {
  return REGISTRY.operations.filter((operation) => operation.authorizedCallerClasses.includes(callerClass));
}
