import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@bibliothecadao/eternum";
import { playResourceSound } from "@/three/sound/utils";
import { isAddressEqualToAccount } from "@/three/utils";
import { LeftView, RightView } from "@/types";
import { UnifiedArmyCreationModal } from "@/ui/features/military/components/unified-army-creation-modal";
import { SetupResult } from "@bibliothecadao/dojo";
import { BuildingType, HexEntityInfo, HexPosition, ResourcesIds } from "@bibliothecadao/types";
import { SceneName } from "../../types/common";
import { navigateToStructure } from "../../utils/navigation";
import { createConstructionMenu } from "./structure-construction-menu";

type Components = SetupResult["components"];

interface OpenStructureContextMenuParams {
  event: MouseEvent;
  structure: HexEntityInfo;
  hexCoords: HexPosition;
  components: Components;
  isSoundOn: boolean;
  effectsLevel: number;
}

export const openStructureContextMenu = ({
  event,
  structure,
  hexCoords,
  components,
  isSoundOn,
  effectsLevel,
}: OpenStructureContextMenuParams) => {
  const uiStore = useUIStore.getState();
  const idString = structure.id.toString();
  const isOwner = isAddressEqualToAccount(structure.owner);

  const openArmyCreationModal = (isExplorer: boolean) => {
    if (!isOwner) {
      return;
    }
    uiStore.setStructureEntityId(structure.id);
    uiStore.toggleModal(<UnifiedArmyCreationModal structureId={Number(structure.id)} isExplorer={isExplorer} />);
  };

  const selectConstructionBuilding = (building: BuildingType, view: LeftView, resource?: ResourcesIds) => {
    if (!isOwner) {
      let spectatorPosition: { col: number; row: number } | undefined;
      const contractPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
      const col = Number(contractPosition?.col ?? contractPosition?.x);
      const row = Number(contractPosition?.row ?? contractPosition?.y);

      if (Number.isFinite(col) && Number.isFinite(row)) {
        spectatorPosition = { col, row };
      }

      uiStore.setStructureEntityId(structure.id, {
        spectator: true,
        spectatorPosition,
      });
      navigateToStructure(hexCoords.col, hexCoords.row, "hex");
      return;
    }

    uiStore.setStructureEntityId(structure.id);
    navigateToStructure(hexCoords.col, hexCoords.row, "hex");
    uiStore.setSelectedBuilding(building);
    uiStore.setPreviewBuilding(resource !== undefined ? { type: building, resource } : { type: building });
    uiStore.setLeftNavigationView(view);
    uiStore.setRightNavigationView(RightView.None);

    if (resource !== undefined) {
      playResourceSound(resource, isSoundOn, effectsLevel);
    }
  };

  const { constructionAction, radialOptions } = createConstructionMenu({
    structure,
    components,
    simpleCostEnabled: uiStore.useSimpleCost,
    selectConstructionBuilding,
  });

  uiStore.openContextMenu({
    id: `structure-${idString}`,
    title: `Realm ${idString}`,
    subtitle: `(${hexCoords.col}, ${hexCoords.row})`,
    position: { x: event.clientX, y: event.clientY },
    scene: SceneName.WorldMap,
    layout: "radial",
    radialOptions,
    metadata: {
      entityId: structure.id,
      entityType: "structure",
      hex: hexCoords,
    },
    actions: [
      {
        id: `structure-${idString}-attack`,
        label: "Create Attack Army",
        icon: "/image-icons/military.png",
        onSelect: () => {
          openArmyCreationModal(true);
        },
      },
      {
        id: `structure-${idString}-defense`,
        label: "Create Defense Army",
        icon: "/image-icons/shield.png",
        onSelect: () => {
          openArmyCreationModal(false);
        },
      },
      constructionAction,
    ],
  });
};
