/**
 * How far a realm builds from its castle: the contract accepts a building whose path from the centre is at most
 * level + 1 steps (construction.cairo resolve_building_coord), so each castle level adds one ring of plots.
 */
export const buildableRadius = (level: number): number => level + 1;

/** The plots within that radius, the castle's own hex excluded: 6 at the first ring, then 18, 36, 60. */
export const buildablePlotCount = (level: number): number => {
  const radius = buildableRadius(level);
  return 3 * radius * (radius + 1);
};
