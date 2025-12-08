export const VICTORY_POINT_VALUES = {
  exploreTile: 10,
  claimWorldStructureFromBandits: 500,
  claimHyperstructureFromBandits: 3_000,
  openRelicChest: 1_000,
  // One VP per nearby settled realm, typically capped at six realms.
  hyperstructureControlPerRealmPerSecond: 1,
  hyperstructureControlMaxRealms: 6,
} as const;

export const formatHyperstructureControlVpRange = (
  maxRealms: number = VICTORY_POINT_VALUES.hyperstructureControlMaxRealms,
): string => {
  const maxVp = maxRealms * VICTORY_POINT_VALUES.hyperstructureControlPerRealmPerSecond;
  return `0 - ${maxVp} VP/s`;
};
