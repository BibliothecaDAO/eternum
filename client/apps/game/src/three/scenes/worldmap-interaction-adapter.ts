import { AudioManager } from "@/audio/core/AudioManager";
import type { HexEntityInfo, HexPosition, ID } from "@bibliothecadao/types";
import { navigateToStructure } from "../utils/navigation";
import { openStructureContextMenu } from "./context-menu/structure-context-menu";

type OpenStructureContextMenuInput = Parameters<typeof openStructureContextMenu>[0];

interface WorldmapInteractionState {
  selectedHex?: { col: number; row: number } | null;
  openArmyCreationPopup(input: { structureId: ID; isExplorer: boolean; direction: number }): void;
  setSelectedHex(input: { col: number; row: number } | null): void;
  setStructureEntityId(
    structureId: ID,
    options: {
      spectator: boolean;
      worldMapPosition?: { col: number; row: number };
    },
  ): void;
}

interface SelectedHexManagerLike {
  setPosition(x: number, z: number): void;
}

interface CreateWorldmapInteractionAdapterInput {
  state: WorldmapInteractionState;
  selectedHexManager?: SelectedHexManagerLike;
  dojoComponents?: OpenStructureContextMenuInput["components"];
}

export function createWorldmapInteractionAdapter({
  state,
  selectedHexManager,
  dojoComponents,
}: CreateWorldmapInteractionAdapterInput) {
  return {
    enterStructure(input: {
      hexCoords: HexPosition;
      structureId: ID;
      spectator: boolean;
      worldMapPosition?: { col: number; row: number };
    }) {
      state.setStructureEntityId(input.structureId, {
        spectator: input.spectator,
        worldMapPosition: input.worldMapPosition,
      });
      navigateToStructure(input.hexCoords.col, input.hexCoords.row, "hex");
    },

    selectHex(input: {
      contractHexPosition: { x: number; y: number };
      isMine: boolean;
      position: { x: number; z: number };
    }) {
      if (
        input.contractHexPosition.x === state.selectedHex?.col &&
        input.contractHexPosition.y === state.selectedHex?.row
      ) {
        return;
      }

      selectedHexManager?.setPosition(input.position.x, input.position.z);
      state.setSelectedHex({
        col: input.contractHexPosition.x,
        row: input.contractHexPosition.y,
      });

      if (input.isMine) {
        AudioManager.getInstance().play("ui.click");
      }
    },

    openOwnedStructureContextMenu(input: {
      event: MouseEvent;
      hexCoords: HexPosition;
      structure: HexEntityInfo;
    }) {
      if (!dojoComponents) {
        return;
      }
      openStructureContextMenu({
        event: input.event,
        structure: input.structure,
        hexCoords: input.hexCoords,
        components: dojoComponents,
      });
    },

    openArmyCreation(input: {
      direction: number;
      structureId: ID;
    }) {
      state.openArmyCreationPopup({
        structureId: input.structureId,
        isExplorer: true,
        direction: input.direction,
      });
    },
  };
}
