import { expeditionDepth, isEtherealTile, type EtherealLayer, type ExpeditionRules } from "@bibliothecadao/eternum";

export type EtherealSurface = "ethereal" | EtherealLayer | "deep";

export const DEEP_SURFACE_CODE = 4;
export const surfaceCode = (surface: EtherealSurface | undefined): number =>
  surface === "deep" ? DEEP_SURFACE_CODE : typeof surface === "number" ? surface : 0;

/** Frontier's contract row selects its depth; Eternum's alternate layer and surface Spires retain their basalt. */
export function etherealSurfaceAt(
  rules: ExpeditionRules | null,
  hex: { row: number; alt: boolean },
  spire: boolean,
): EtherealSurface | undefined {
  if (!isEtherealTile(rules, hex)) return spire ? "ethereal" : undefined;
  if (hex.alt || !rules) return "ethereal";
  const depth = expeditionDepth(rules, { y: hex.row });
  if (depth !== 1 && depth !== 2 && depth !== 3) throw new Error(`Invalid Ethereal depth: ${depth}`);
  return depth;
}
