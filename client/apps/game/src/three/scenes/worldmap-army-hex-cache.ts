interface ArmyHexPosition {
  col: number;
  row: number;
}

interface ArmyHexEntryLike<TEntityId> {
  id: TEntityId;
}

interface RemoveAllArmyHexEntriesForEntityInput<TEntityId, TArmyHex extends ArmyHexEntryLike<TEntityId>> {
  armyHexes: Map<number, Map<number, TArmyHex>>;
  entityId: TEntityId;
}

/**
 * Remove every cached coordinate currently pointing to the given army entity.
 * This makes cache updates idempotent when updates arrive out-of-order.
 */
export function removeAllArmyHexEntriesForEntity<TEntityId, TArmyHex extends ArmyHexEntryLike<TEntityId>>(
  input: RemoveAllArmyHexEntriesForEntityInput<TEntityId, TArmyHex>,
): ArmyHexPosition[] {
  const { armyHexes, entityId } = input;
  const removedPositions: ArmyHexPosition[] = [];
  const emptyCols: number[] = [];

  for (const [col, rowMap] of armyHexes.entries()) {
    for (const [row, armyHexData] of rowMap.entries()) {
      if (armyHexData.id !== entityId) continue;

      rowMap.delete(row);
      removedPositions.push({ col, row });
    }

    if (rowMap.size === 0) {
      emptyCols.push(col);
    }
  }

  for (const col of emptyCols) {
    armyHexes.delete(col);
  }

  return removedPositions;
}
