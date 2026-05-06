import type { ActiveTransferData } from "@bibliothecadao/torii";
import type { StructureMapData } from "@bibliothecadao/eternum";

const MOCK_TRANSFER_DURATIONS_MS = [120_000, 180_000, 240_000, 90_000];
const MOCK_TRANSFER_PROGRESS = [0.15, 0.45, 0.72, 0.33];
const MOCK_TRANSFER_RESOURCE_IDS = [[1], [2], [3], [4, 5]];

export function buildMockActiveTransfers(
  structures: StructureMapData[],
  currentTimeMs: number,
): ActiveTransferData[] {
  const selectedStructures = structures
    .toSorted((left, right) => left.entityId - right.entityId)
    .slice(0, 4);

  if (selectedStructures.length < 2) {
    return [];
  }

  const pairs = buildMockTransferPairs(selectedStructures);

  return pairs.map(([source, destination], index) => {
    const durationMs = MOCK_TRANSFER_DURATIONS_MS[index % MOCK_TRANSFER_DURATIONS_MS.length]!;
    const progress = MOCK_TRANSFER_PROGRESS[index % MOCK_TRANSFER_PROGRESS.length]!;
    const startedAtMs = currentTimeMs - durationMs * progress;
    const endsAtMs = startedAtMs + durationMs;

    return {
      id: `live:mock-${source.entityId}-${destination.entityId}-${index}`,
      eventId: `mock-${index}`,
      txHash: `mock-${index}`,
      sourceEntityId: source.entityId,
      destinationEntityId: destination.entityId,
      resourceIds: MOCK_TRANSFER_RESOURCE_IDS[index % MOCK_TRANSFER_RESOURCE_IDS.length]!,
      startedAtMs,
      endsAtMs,
      progress,
    };
  });
}

function buildMockTransferPairs(structures: StructureMapData[]): Array<[StructureMapData, StructureMapData]> {
  if (structures.length === 2) {
    return [[structures[0]!, structures[1]!]];
  }

  if (structures.length === 3) {
    return [
      [structures[0]!, structures[1]!],
      [structures[1]!, structures[2]!],
      [structures[0]!, structures[2]!],
    ];
  }

  return [
    [structures[0]!, structures[1]!],
    [structures[1]!, structures[2]!],
    [structures[2]!, structures[3]!],
    [structures[0]!, structures[3]!],
  ];
}
