import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
export function resolveRegistrarExecutionDetails() {
  return {
    version: 3 as const,
    tip: 0,
    resourceBounds: resolveGameTransactionResourceBounds(),
  };
}
