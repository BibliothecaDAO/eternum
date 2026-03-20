export interface VisibleTerrainInstanceRef {
  biomeKey: string;
  chunkKey: string;
  instanceIndex: number;
}

interface VisibleTerrainMembershipEntry extends VisibleTerrainInstanceRef {
  hexKey: string;
}

interface VisibleTerrainMembershipBuildResult {
  membership: Map<string, VisibleTerrainInstanceRef>;
  conflicts: string[];
}

export function buildVisibleTerrainMembership(
  entries: Iterable<VisibleTerrainMembershipEntry>,
): VisibleTerrainMembershipBuildResult {
  const membership = new Map<string, VisibleTerrainInstanceRef>();
  const conflicts = new Set<string>();

  for (const entry of entries) {
    if (membership.has(entry.hexKey)) {
      conflicts.add(entry.hexKey);
    }

    membership.set(entry.hexKey, {
      biomeKey: entry.biomeKey,
      chunkKey: entry.chunkKey,
      instanceIndex: entry.instanceIndex,
    });
  }

  return {
    membership,
    conflicts: Array.from(conflicts),
  };
}

export function replaceVisibleTerrainMembershipOwner(
  membership: Map<string, VisibleTerrainInstanceRef>,
  entry: VisibleTerrainMembershipEntry,
): VisibleTerrainInstanceRef | null {
  const previousOwner = membership.get(entry.hexKey) ?? null;

  membership.set(entry.hexKey, {
    biomeKey: entry.biomeKey,
    chunkKey: entry.chunkKey,
    instanceIndex: entry.instanceIndex,
  });

  return previousOwner;
}
