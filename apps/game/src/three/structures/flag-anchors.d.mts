export type FlagRole = "banner" | "trim";

export interface FlagAnchor {
  role: FlagRole;
  position: readonly [number, number, number];
  size: readonly [number, number];
  facing: number;
}

export const FLAG_ROLES: readonly FlagRole[];
export function requireFlagAnchors(anchors: unknown, where: string): FlagAnchor[];
