import { expeditionDepth, isEtherealTile, type EtherealLayer, type ExpeditionRules } from "@bibliothecadao/eternum";
import looks from "./ethereal-depths.json";

interface EtherealDepthLook {
  title: string;
  stone: string;
  shadow: string;
  energy: string;
  scale: number;
  veins: number;
  shape: string;
  height: number;
  density: number;
}

export const ETHEREAL_DEPTH_LOOKS: Readonly<Record<EtherealLayer, EtherealDepthLook>> = looks;
export type EtherealSurface = "ethereal" | EtherealLayer;

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
