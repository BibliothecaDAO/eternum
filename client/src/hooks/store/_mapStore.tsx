import { HyperStructureInterface, Position, StructureType } from "@bibliothecadao/eternum";
import { ClickedHex, Hexagon, HighlightPosition } from "../../types";

export interface MapStore {
  worldMapBuilding: StructureType | null;
  setWorldMapBuilding: (building: StructureType | null) => void;
  clickedHex: ClickedHex | undefined;
  setClickedHex: (hex: ClickedHex | undefined) => void;
  hexData: Hexagon[] | undefined;
  setHexData: (hexData: Hexagon[]) => void;
  selectedEntity: { id: bigint; position: Position } | undefined;
  setSelectedEntity: (entity: { id: bigint; position: Position } | undefined) => void;
  animationPaths: { id: bigint; path: Position[]; enemy: boolean }[];
  setAnimationPaths: (path: { id: bigint; path: Position[]; enemy: boolean }[]) => void;
  selectedPath: { id: bigint; path: Position[] } | undefined;
  setSelectedPath: (path: { id: bigint; path: Position[] } | undefined) => void;
  isTravelMode: boolean;
  setIsTravelMode: (isTravelMode: boolean) => void;
  isExploreMode: boolean;
  setIsExploreMode: (isExploreMode: boolean) => void;
  isAttackMode: boolean;
  setIsAttackMode: (isAttackMode: boolean) => void;
  highlightPositions: HighlightPosition[];
  setHighlightPositions: (positions: HighlightPosition[]) => void;
}
export const createMapStoreSlice = (set: any) => ({
  worldMapBuilding: null,
  setWorldMapBuilding: (building: StructureType | null) => {
    set({ worldMapBuilding: building });
  },
  clickedHex: undefined,
  setClickedHex: (hex: ClickedHex | undefined) => {
    set({ clickedHex: hex });
  },
  hexData: undefined,
  setHexData: (hexData: Hexagon[]) => {
    set({ hexData });
  },
  selectedEntity: undefined,
  setSelectedEntity: (entity: { id: bigint; position: Position } | undefined) => set({ selectedEntity: entity }),
  animationPaths: [],
  setAnimationPaths: (animationPaths: { id: bigint; path: Position[]; enemy: boolean }[]) => set({ animationPaths }),
  selectedPath: undefined,
  setSelectedPath: (selectedPath: { id: bigint; path: Position[] } | undefined) => set({ selectedPath }),
  isTravelMode: false,
  setIsTravelMode: (isTravelMode: boolean) => set({ isTravelMode }),
  isExploreMode: false,
  setIsExploreMode: (isExploreMode: boolean) => set({ isExploreMode }),
  isAttackMode: false,
  setIsAttackMode: (isAttackMode: boolean) => set({ isAttackMode }),
  highlightPositions: [],
  setHighlightPositions: (positions: HighlightPosition[]) => set({ highlightPositions: positions }),
});
