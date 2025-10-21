import type { SupportedNetwork } from "../types";

export type GameFactoryErrorCode =
  | "MISSING_CLASS_HASH"
  | "UNSUPPORTED_NETWORK"
  | "PRESET_NOT_FOUND"
  | "PLAN_VALIDATION_FAILED"
  | "EXECUTION_FAILED"
  | "FEE_ESTIMATION_FAILED"
  | "NOT_IMPLEMENTED";

export class GameFactoryError extends Error {
  constructor(
    message: string,
    public readonly code: GameFactoryErrorCode,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GameFactoryError";
  }
}

export class MissingClassHashError extends GameFactoryError {
  constructor(classId: string, network: SupportedNetwork, context?: Record<string, unknown>) {
    super(`Class hash not found for "${classId}" on network "${network}".`, "MISSING_CLASS_HASH", {
      classId,
      network,
      ...context,
    });
    this.name = "MissingClassHashError";
  }
}

export class UnsupportedNetworkError extends GameFactoryError {
  constructor(network: string) {
    super(`Unsupported network "${network}".`, "UNSUPPORTED_NETWORK", { network });
    this.name = "UnsupportedNetworkError";
  }
}

export class PresetNotFoundError extends GameFactoryError {
  constructor(presetId: string) {
    super(`Deployment preset "${presetId}" not found.`, "PRESET_NOT_FOUND", { presetId });
    this.name = "PresetNotFoundError";
  }
}

export class PlanValidationError extends GameFactoryError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "PLAN_VALIDATION_FAILED", context);
    this.name = "PlanValidationError";
  }
}

export class ExecutionFailedError extends GameFactoryError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "EXECUTION_FAILED", context);
    this.name = "ExecutionFailedError";
  }
}

export class FeeEstimationFailedError extends GameFactoryError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "FEE_ESTIMATION_FAILED", context);
    this.name = "FeeEstimationFailedError";
  }
}

export class NotImplementedError extends GameFactoryError {
  constructor(feature: string) {
    super(`${feature} is not implemented yet.`, "NOT_IMPLEMENTED", { feature });
    this.name = "NotImplementedError";
  }
}

