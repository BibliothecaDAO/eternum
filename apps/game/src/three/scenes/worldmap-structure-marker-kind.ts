import { StructureType } from "@bibliothecadao/types";

import type { StrategicStructureMarkerKind } from "../managers/strategic-marker-layer";

// The far view's marker for each structure category; a new category fails typecheck here until it has one.
const STRUCTURE_MARKER_KIND: Record<StructureType, StrategicStructureMarkerKind> = {
  [StructureType.Realm]: "realm",
  [StructureType.Hyperstructure]: "hyperstructure",
  [StructureType.Bank]: "bank",
  [StructureType.Mine]: "mine",
  [StructureType.BitcoinMine]: "mine",
  [StructureType.Village]: "village",
  [StructureType.Camp]: "village",
  [StructureType.Rift]: "mine",
  [StructureType.Ruin]: "realm",
  [StructureType.Beasts]: "village",
};

/** The plainest marker: what a structure of a category this client does not know is drawn as. */
const UNKNOWN_STRUCTURE_MARKER_KIND: StrategicStructureMarkerKind = "village";

const reportedUnknownCategories = new Set<number>();

/**
 * The far view's marker for a structure. The chain can hold a category this build was not compiled with: it is
 * reported once and drawn as the plainest marker, so one unknown structure never stops every marker on the map.
 */
export function structureMarkerKind(structureType: StructureType): StrategicStructureMarkerKind {
  const kind = STRUCTURE_MARKER_KIND[structureType] as StrategicStructureMarkerKind | undefined;
  if (kind !== undefined) return kind;
  if (!reportedUnknownCategories.has(structureType)) {
    reportedUnknownCategories.add(structureType);
    console.error(
      `[WorldMap] Structure category ${String(structureType)} has no far-view marker; drawing it as ${UNKNOWN_STRUCTURE_MARKER_KIND}`,
    );
  }
  return UNKNOWN_STRUCTURE_MARKER_KIND;
}
