import type { HexEntityInfo, HexPosition, ID } from "@bibliothecadao/types";

export interface ArmyPositionRepairTarget {
  entityId: ID;
  canonicalPosition: HexPosition;
}

export interface ArmyPositionRepair<TTarget extends ArmyPositionRepairTarget = ArmyPositionRepairTarget> {
  target: TTarget;
  cachedPosition: HexPosition | undefined;
  staleEntries: HexPosition[];
  shouldUpdatePositionCache: boolean;
}

export function planArmyPositionRepairs<TTarget extends ArmyPositionRepairTarget>(input: {
  targets: Iterable<TTarget>;
  armiesPositions: ReadonlyMap<ID, HexPosition>;
  armyHexes: ReadonlyMap<number, ReadonlyMap<number, Pick<HexEntityInfo, "id">>>;
  skipEntityIds?: ReadonlySet<ID>;
}): Array<ArmyPositionRepair<TTarget>> {
  const targetsByEntityId = resolveRepairTargetsByEntityId(input.targets, input.skipEntityIds);
  if (targetsByEntityId.size === 0) {
    return [];
  }

  const staleEntriesByEntityId = findStaleArmyHexEntriesByEntityId(input.armyHexes, targetsByEntityId);

  return Array.from(targetsByEntityId.values()).flatMap((target) =>
    planArmyPositionRepair({
      armyHexes: input.armyHexes,
      armiesPositions: input.armiesPositions,
      staleEntries: staleEntriesByEntityId.get(target.entityId) ?? [],
      target,
    }),
  );
}

function resolveRepairTargetsByEntityId<TTarget extends ArmyPositionRepairTarget>(
  targets: Iterable<TTarget>,
  skipEntityIds: ReadonlySet<ID> | undefined,
): Map<ID, TTarget> {
  const targetsByEntityId = new Map<ID, TTarget>();

  for (const target of targets) {
    if (!skipEntityIds?.has(target.entityId)) {
      targetsByEntityId.set(target.entityId, target);
    }
  }

  return targetsByEntityId;
}

function findStaleArmyHexEntriesByEntityId<TTarget extends ArmyPositionRepairTarget>(
  armyHexes: ReadonlyMap<number, ReadonlyMap<number, Pick<HexEntityInfo, "id">>>,
  targetsByEntityId: ReadonlyMap<ID, TTarget>,
): Map<ID, HexPosition[]> {
  const staleEntriesByEntityId = new Map<ID, HexPosition[]>();

  for (const [col, rowMap] of armyHexes) {
    for (const [row, army] of rowMap) {
      const target = targetsByEntityId.get(army.id);
      if (!target || matchesHexPosition({ col, row }, target.canonicalPosition)) {
        continue;
      }
      appendStaleEntry(staleEntriesByEntityId, army.id, { col, row });
    }
  }

  return staleEntriesByEntityId;
}

function appendStaleEntry(staleEntriesByEntityId: Map<ID, HexPosition[]>, entityId: ID, position: HexPosition): void {
  const entries = staleEntriesByEntityId.get(entityId);
  if (entries) {
    entries.push(position);
    return;
  }

  staleEntriesByEntityId.set(entityId, [position]);
}

function planArmyPositionRepair<TTarget extends ArmyPositionRepairTarget>(input: {
  target: TTarget;
  armiesPositions: ReadonlyMap<ID, HexPosition>;
  armyHexes: ReadonlyMap<number, ReadonlyMap<number, Pick<HexEntityInfo, "id">>>;
  staleEntries: HexPosition[];
}): Array<ArmyPositionRepair<TTarget>> {
  const cachedPosition = input.armiesPositions.get(input.target.entityId);
  const shouldUpdatePositionCache = !matchesTrackedArmyPosition({
    armyHexes: input.armyHexes,
    cachedPosition,
    entityId: input.target.entityId,
    position: input.target.canonicalPosition,
  });

  if (!shouldUpdatePositionCache && input.staleEntries.length === 0) {
    return [];
  }

  return [
    {
      cachedPosition,
      shouldUpdatePositionCache,
      staleEntries: input.staleEntries,
      target: input.target,
    },
  ];
}

function matchesTrackedArmyPosition(input: {
  entityId: ID;
  position: HexPosition;
  cachedPosition: HexPosition | undefined;
  armyHexes: ReadonlyMap<number, ReadonlyMap<number, Pick<HexEntityInfo, "id">>>;
}): boolean {
  const cachedHex = input.armyHexes.get(input.position.col)?.get(input.position.row);
  return (
    input.cachedPosition?.col === input.position.col &&
    input.cachedPosition?.row === input.position.row &&
    cachedHex?.id === input.entityId
  );
}

function matchesHexPosition(left: HexPosition, right: HexPosition): boolean {
  return left.col === right.col && left.row === right.row;
}
