import type { CosmeticResolutionResult } from "./types";

export interface DebugOverrideParams {
  owner: string;
  kind: "army" | "structure";
  baseType: number | string;
  variant: number | string;
  target: string;
}

interface CosmeticDebugController {
  resolveOverride(params: DebugOverrideParams): CosmeticResolutionResult | undefined;
}

let activeController: CosmeticDebugController | undefined;

export const cosmeticDebugController: CosmeticDebugController = {
  resolveOverride: (params) => activeController?.resolveOverride(params),
};

export function registerCosmeticDebugController(controller: CosmeticDebugController): () => void {
  activeController = controller;
  return () => {
    if (activeController === controller) activeController = undefined;
  };
}
