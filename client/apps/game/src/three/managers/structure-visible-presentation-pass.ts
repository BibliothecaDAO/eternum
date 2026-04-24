export function presentVisibleStructures<
  TStructure extends { entityId: TEntityId },
  TEntityId extends string | number | bigint,
>(input: { visibleStructures: TStructure[]; presentStructure: (structure: TStructure) => void }): Set<TEntityId> {
  const visibleStructureIds = new Set<TEntityId>();

  input.visibleStructures.forEach((structure) => {
    visibleStructureIds.add(structure.entityId);
    input.presentStructure(structure);
  });

  return visibleStructureIds;
}
