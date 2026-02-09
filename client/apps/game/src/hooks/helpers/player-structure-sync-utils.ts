export type OwnedStructureLocation = {
  entity_id: unknown;
  coord_x: unknown;
  coord_y: unknown;
};

export type StructureSyncTarget = {
  entityId: number;
  position: { col: number; row: number };
};

export const selectUnsyncedOwnedStructureTargets = ({
  ownedStructures,
  currentPlayerStructureIds,
  inFlightStructureIds,
}: {
  ownedStructures: OwnedStructureLocation[];
  currentPlayerStructureIds: ReadonlySet<number>;
  inFlightStructureIds: ReadonlySet<number>;
}): StructureSyncTarget[] => {
  const seenEntityIds = new Set<number>();

  return ownedStructures.reduce<StructureSyncTarget[]>((acc, structure) => {
    const entityId = Number(structure.entity_id);
    const col = Number(structure.coord_x);
    const row = Number(structure.coord_y);

    if (!Number.isFinite(entityId) || !Number.isFinite(col) || !Number.isFinite(row)) {
      return acc;
    }

    if (seenEntityIds.has(entityId)) {
      return acc;
    }

    seenEntityIds.add(entityId);

    if (currentPlayerStructureIds.has(entityId) || inFlightStructureIds.has(entityId)) {
      return acc;
    }

    acc.push({ entityId, position: { col, row } });
    return acc;
  }, []);
};
