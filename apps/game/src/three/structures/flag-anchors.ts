export const FLAG_ROLES = ["banner", "trim"] as const;

export type FlagRole = (typeof FLAG_ROLES)[number];

export interface FlagAnchor {
  role: FlagRole;
  position: readonly [number, number, number];
  size: readonly [number, number];
  facing: number;
}

const isFiniteList = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every((entry) => Number.isFinite(entry));

function isFlagAnchor(anchor: unknown): anchor is FlagAnchor {
  const candidate = anchor as Partial<FlagAnchor> | null | undefined;
  return (
    FLAG_ROLES.includes(candidate?.role as FlagRole) &&
    isFiniteList(candidate?.position, 3) &&
    isFiniteList(candidate?.size, 2) &&
    candidate.size.every((side) => side > 0) &&
    Number.isFinite(candidate.facing)
  );
}

export function requireFlagAnchors(anchors: unknown, where: string): FlagAnchor[] {
  if (!Array.isArray(anchors)) throw new Error(`Flag anchors must be a list in ${where}`);
  for (const anchor of anchors) {
    if (!isFlagAnchor(anchor)) {
      throw new Error(
        `A flag anchor needs role ${FLAG_ROLES.join("|")}, position [x,y,z], size [w,h] and facing in ${where}`,
      );
    }
  }
  return anchors;
}
