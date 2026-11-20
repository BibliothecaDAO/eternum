import { StructureType } from "@bibliothecadao/types";

/** What stands on a double-clicked map tile, as the double-click reads it. */
export type DoubleClickTarget =
  /** A spire that is a portal: Frontier's lit spire, or a spire on Eternum's two layers. */
  { kind: "spire" } | { kind: "structure"; category: StructureType } | { kind: "other" };

/**
 * Each structure's double-click: a home with a board of its own goes into its local view; nothing else has an inside,
 * so a double-click on it does no more than its single click (owner, 4 November 2026: "I shouldnt be able to double
 * click a beast", "(no local mode for beasts)").
 */
const STRUCTURE_DOUBLE_CLICK = {
  [StructureType.Realm]: "enter",
  [StructureType.Village]: "enter",
  [StructureType.Hyperstructure]: "none",
  [StructureType.Bank]: "none",
  [StructureType.Mine]: "none",
  [StructureType.Camp]: "none",
  [StructureType.Rift]: "none",
  [StructureType.Ruin]: "none",
  [StructureType.Beasts]: "none",
} satisfies Record<StructureType, "enter" | "none">;

/** What a double-click can do, as the scene does it. */
interface WorldmapDoubleClickActions {
  /** Switch the view through the spire: into its Ethereal layer, or from Eternum's back to the surface. */
  throughSpire: () => void;
  /** Open the structure's local view. */
  enterStructure: () => void;
}

export const runWorldmapDoubleClick = (target: DoubleClickTarget, actions: WorldmapDoubleClickActions): void => {
  if (target.kind === "spire") actions.throughSpire();
  else if (target.kind === "structure" && STRUCTURE_DOUBLE_CLICK[target.category] === "enter") actions.enterStructure();
};
