import { Position } from "@bibliothecadao/eternum";
import { AudioManager } from "@/audio/core/AudioManager";
import type { MapSelectionIntent } from "@/hooks/store/map-selection";
import type { HexEntityInfo, HexPosition, ID } from "@bibliothecadao/types";
import { navigateToStructure } from "../utils/navigation";
import { openStructureContextMenu } from "./context-menu/structure-context-menu";

type OpenStructureContextMenuInput = Parameters<typeof openStructureContextMenu>[0];

interface WorldmapInteractionState {
  selectedHex?: { col: number; row: number } | null;
  selectOnMap(intent: MapSelectionIntent): void;
  setStructureEntityId(
    structureId: ID,
    options: {
      spectator: boolean;
      worldMapPosition?: Position;
    },
  ): void;
}

interface CreateWorldmapInteractionAdapterInput {
  state: WorldmapInteractionState;
  store?: OpenStructureContextMenuInput["store"];
}

export function createWorldmapInteractionAdapter({ state, store }: CreateWorldmapInteractionAdapterInput) {
  return {
    enterStructure(input: {
      hexCoords: HexPosition;
      structureId: ID;
      spectator: boolean;
      worldMapPosition?: Position;
    }) {
      state.setStructureEntityId(input.structureId, {
        spectator: input.spectator,
        worldMapPosition: input.worldMapPosition,
      });
      navigateToStructure(Position.fromNormalized({ x: input.hexCoords.col, y: input.hexCoords.row }), "hex");
    },

    /** A tap on a tile selects it as terrain; the map then selects the army or structure it holds, if any. */
    selectHex(input: { contractHexPosition: { x: number; y: number }; isMine: boolean }) {
      if (
        input.contractHexPosition.x === state.selectedHex?.col &&
        input.contractHexPosition.y === state.selectedHex?.row
      ) {
        return;
      }

      state.selectOnMap({ kind: "hex", hex: { col: input.contractHexPosition.x, row: input.contractHexPosition.y } });

      if (input.isMine) {
        AudioManager.getInstance().play("ui.hex_select");
      } else {
        AudioManager.getInstance().play("ui.hex_enemy");
      }
    },

    openOwnedStructureContextMenu(input: { event: MouseEvent; hexCoords: HexPosition; structure: HexEntityInfo }) {
      if (!store) {
        return;
      }
      openStructureContextMenu({
        event: input.event,
        structure: input.structure,
        hexCoords: input.hexCoords,
        store,
      });
    },
  };
}
