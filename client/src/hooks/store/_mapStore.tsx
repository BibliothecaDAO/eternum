import { HyperStructureInterface, Position } from "@bibliothecadao/eternum";
import { Hexagon } from "../../components/worldmap/HexGrid";
export interface MapStore {
  clickedHex: { col: number; row: number; hexIndex: number } | undefined;
  setClickedHex: (hex: { col: number; row: number; hexIndex: number } | undefined) => void;
  setClickedHyperstructure: (hyperstructure: HyperStructureInterface | undefined) => void;
  clickedHyperstructure: HyperStructureInterface | undefined;
  hexData: Hexagon[] | undefined;
  setHexData: (hexData: Hexagon[]) => void;
  selectedEntity: { id: bigint; position: Position } | undefined;
  setSelectedEntity: (entity: { id: bigint; position: Position } | undefined) => void;
  animationPath: { id: bigint; path: Position[] } | undefined;
  setAnimationPath: (path: { id: bigint; path: Position[] } | undefined) => void;
  selectedPath: { id: bigint; path: Position[] } | undefined;
  setSelectedPath: (path: { id: bigint; path: Position[] } | undefined) => void;
  isTravelMode: boolean;
  setIsTravelMode: (isTravelMode: boolean) => void;
  isExploreMode: boolean;
  setIsExploreMode: (isExploreMode: boolean) => void;
  isAttackMode: boolean;
  setIsAttackMode: (isAttackMode: boolean) => void;
}
export const createMapStoreSlice = (set: any) => ({
  clickedHex: undefined,
  setClickedHex: (hex: { col: number; row: number; hexIndex: number } | undefined) => {
    set({ clickedHex: hex });
  },
  setClickedHyperstructure: (hyperstructure: HyperStructureInterface | undefined) =>
    set({ clickedHyperstructure: hyperstructure }),
  clickedHyperstructure: undefined,
  hexData: undefined,
  setHexData: (hexData: Hexagon[]) => {
    set({ hexData });
  },
  selectedEntity: undefined,
  setSelectedEntity: (entity: { id: bigint; position: Position } | undefined) => set({ selectedEntity: entity }),
  animationPath: undefined,
  setAnimationPath: (animationPath: { id: bigint; path: Position[] } | undefined) => set({ animationPath }),
  selectedPath: undefined,
  setSelectedPath: (selectedPath: { id: bigint; path: Position[] } | undefined) => set({ selectedPath }),
  isTravelMode: false,
  setIsTravelMode: (isTravelMode: boolean) => set({ isTravelMode }),
  isExploreMode: false,
  setIsExploreMode: (isExploreMode: boolean) => set({ isExploreMode }),
  isAttackMode: false,
  setIsAttackMode: (isAttackMode: boolean) => set({ isAttackMode }),
});
