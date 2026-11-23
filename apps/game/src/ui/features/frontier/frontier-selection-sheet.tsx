import { DeepSiteCard, useSelectedDeepSite } from "./deep/deep-site-card";
import { ClearedSiteSheet, SiteReceipt, useSelectedClearedSite } from "./sites/site-receipt";
import { RealmSpireSheet, useSelectedSpire } from "./spire-card";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ReactNode } from "react";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildSheet, useOpenPlot } from "./build/build-sheet";
import { TileCard, useSelectedTarget } from "./sites/tile-card";
import { SpireCard, useSelectedTileObject } from "./sites/tile-object-cards";
import { CastleUpgrade, useKeepSelected } from "./upgrade/castle-upgrade";
import { TransferTroopsSheet, useSelectedTransfer } from "./army/transfer-troops";
import { ReinforceSheet, useSelectedReinforcement } from "./army/reinforce";
import { BuildingCard } from "./building/building-card";
import { useTappedBuilding } from "./research/selected-building";

type SelectionCardKind =
  | "transfer"
  | "reinforce"
  | "plot"
  | "deep-site"
  | "target"
  | "cleared"
  | "realm-spire"
  | "spire"
  | "keep"
  | "building";

export const isRealmBoardCard = (kind: SelectionCardKind): boolean =>
  kind === "plot" || kind === "keep" || kind === "building";

export const useSelectionCard = ({
  realm,
  onResearch,
}: {
  /** The realm the board draws: the player's own, or the realm they visit or watch. */
  realm: NativeRows["Structure"] | null;
  /** Opens Research, on a node where the card names one, for a card whose next step is there. */
  onResearch: (node?: string) => void;
}): { kind: SelectionCardKind; key: string; sheet: ReactNode } | null => {
  const selectedHex = useUIStore((state) => state.selectedHex);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const openPlot = useOpenPlot(realm);
  const target = useSelectedTarget();
  const cleared = useSelectedClearedSite();
  const deepSite = useSelectedDeepSite();
  const tileObject = useSelectedTileObject();
  const keep = useKeepSelected(realm);
  const building = useTappedBuilding(realm);
  const spire = useSelectedSpire();
  const transfer = useSelectedTransfer(realm);
  const reinforcing = useSelectedReinforcement(realm);
  const closeSelectedTile = useUIStore((state) => state.closeSelectedTile);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const armyWhereItStands = useUIStore(
    (state) => state.mapSelection?.kind === "army" && state.mapSelection.tile === "own",
  );
  const close = () => {
    closeSelectedTile();
    setSelectedBuildingHex(null);
  };
  const at = `${selectedHex?.col},${selectedHex?.row}:${selectedBuildingHex?.innerCol},${selectedBuildingHex?.innerRow}`;
  const card = (kind: SelectionCardKind, sheet: ReactNode) => ({ kind, key: `${kind}@${at}`, sheet });
  if (realm && transfer) return card("transfer", <TransferTroopsSheet realm={realm} pair={transfer} onClose={close} />);
  if (realm && reinforcing)
    return card("reinforce", <ReinforceSheet realm={realm} army={reinforcing} onClose={close} />);
  if (realm && openPlot) return card("plot", <BuildSheet realm={realm} plot={openPlot} onClose={close} />);
  if (deepSite) return card("deep-site", <DeepSiteCard site={deepSite} onClose={close} />);
  if (target)
    return card(
      "target",
      <TileCard selected={target} onClose={close} receipt={cleared ? <SiteReceipt selected={cleared} /> : undefined} />,
    );
  if (cleared && !armyWhereItStands) return card("cleared", <ClearedSiteSheet selected={cleared} onClose={close} />);
  if (spire && !armyWhereItStands) return card("realm-spire", <RealmSpireSheet spire={spire} onClose={close} />);
  if (tileObject?.kind === "spire") return card("spire", <SpireCard onClose={close} />);
  if (realm && keep) return card("keep", <CastleUpgrade realm={realm} onResearchPage={onResearch} onClose={close} />);
  if (realm && building)
    return card(
      "building",
      <BuildingCard realm={realm} building={building} onResearchPage={onResearch} onClose={close} />,
    );
  return null;
};
