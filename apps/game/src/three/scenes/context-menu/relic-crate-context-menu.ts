import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { openRelicCrate } from "@/ui/features/military/chest/open-relic-crate";
import type { SetupResult } from "@bibliothecadao/dojo";
import type { HexPosition, ID } from "@bibliothecadao/types";
import { SceneName } from "../../types/common";

interface OpenRelicCrateContextMenuParams {
  event: MouseEvent;
  hexCoords: HexPosition;
  explorerId: ID;
  systemCalls: SetupResult["systemCalls"];
}

/** Right-click on a crate with an adjacent own explorer selected: one entry, open it. */
export const openRelicCrateContextMenu = ({ event, hexCoords, explorerId, systemCalls }: OpenRelicCrateContextMenuParams) => {
  const account = useAccountStore.getState().account;
  if (!account) return;
  useUIStore.getState().openContextMenu({
    id: `relic-crate-${hexCoords.col}-${hexCoords.row}`,
    title: "Relic crate",
    subtitle: `(${hexCoords.col}, ${hexCoords.row})`,
    position: { x: event.clientX, y: event.clientY },
    scene: SceneName.WorldMap,
    metadata: { entityType: "chest", hex: hexCoords },
    actions: [
      {
        id: `relic-crate-${hexCoords.col}-${hexCoords.row}-open`,
        label: "Open crate",
        icon: "/image-icons/relics.png",
        onSelect: () => void openRelicCrate({ systemCalls, account, explorerId, hex: hexCoords }),
      },
    ],
  });
};
