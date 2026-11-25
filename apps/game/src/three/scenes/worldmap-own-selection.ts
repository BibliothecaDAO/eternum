import type { ID } from "@bibliothecadao/types";

type Owner = bigint | string | null | undefined;
type HeldThing = { id: ID; owner: Owner };

export type OwnSelection = { kind: "army" | "supply-post" | "structure"; id: ID };

export const ownSelectionOn = (
  tile: { army?: HeldThing; structure?: HeldThing; ownSupplyPost: ID | null },
  isViewer: (owner: Owner) => boolean,
): OwnSelection | null => {
  if (tile.army && isViewer(tile.army.owner)) return { kind: "army", id: tile.army.id };
  if (tile.ownSupplyPost !== null) return { kind: "supply-post", id: tile.ownSupplyPost };
  if (tile.structure && isViewer(tile.structure.owner)) return { kind: "structure", id: tile.structure.id };
  return null;
};
