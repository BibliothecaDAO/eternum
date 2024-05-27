import { HyperStructureInterface, Position, StructureType } from "@bibliothecadao/eternum";
import { ClickedHex, Hexagon, HighlightPosition } from "../../types";
import { Has, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { useEffect, useMemo, useState } from "react";
import { useEntityQuery } from "@dojoengine/react";
import useUIStore from "./useUIStore";
import {
  HyperstructureEventInterface,
  parseHyperstructureFinishedEventData,
} from "@/dojo/events/hyperstructureEventQueries";
import useLeaderBoardStore from "./useLeaderBoardStore";

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
  clearSelection: () => void;
  existingStructures: { col: number; row: number; type: StructureType }[];
  setExistingStructures: (existingStructures: { col: number; row: number; type: StructureType }[]) => void;
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
  clearSelection: () => {
    set({
      selectedEntity: undefined,
      selectedPath: undefined,
      isTravelMode: false,
      isExploreMode: false,
      isAttackMode: false,
    });
  },
  existingStructures: [],
  setExistingStructures: (existingStructures: { col: number; row: number; type: StructureType; entityId: number }[]) =>
    set({ existingStructures }),
});

export const useSetExistingStructures = () => {
  const [newFinishedHs, setNewFinishedHs] = useState<HyperstructureEventInterface | null>(null);
  const { setup } = useDojo();
  const [subCreated, setSubCreated] = useState<boolean>(false);

  const setExistingStructures = useUIStore((state) => state.setExistingStructures);
  const finishedHyperstructures = useLeaderBoardStore((state) => state.finishedHyperstructures);
  const setFinishedHyperstructures = useLeaderBoardStore((state) => state.setFinishedHyperstructures);

  const builtStructures = useEntityQuery([Has(setup.components.Structure)]);

  useEffect(() => {
    if (newFinishedHs === null) return;
    setFinishedHyperstructures([...finishedHyperstructures, newFinishedHs]);
  }, [newFinishedHs]);

  useEffect(() => {
    const subscription = async () => {
      const observable = await setup.updates.eventUpdates.hyperstructureFinishedEvents();
      let events: HyperstructureEventInterface[] = [];

      const subscription = observable.subscribe((event) => {
        if (event) {
          const parsedEvent: HyperstructureEventInterface = parseHyperstructureFinishedEventData(event);
          events.push(parsedEvent);
          setNewFinishedHs(parsedEvent);
        }
      });
      setFinishedHyperstructures(events);
    };
    if (subCreated) return;
    subscription();
    setSubCreated(true);
  }, []);

  useMemo(() => {
    const _tmp = builtStructures
      .map((entity) => {
        const position = getComponentValue(setup.components.Position, entity);
        const structure = getComponentValue(setup.components.Structure, entity);
        const type = StructureType[structure!.category as keyof typeof StructureType];
        if (!position || !structure) return null;
        return {
          col: position.x,
          row: position.y,
          type: type as StructureType,
          entity: entity,
          entityId: Number(structure.entity_id),
        };
      })
      .filter(Boolean) as { col: number; row: number; type: StructureType; entityId: number }[];

    setExistingStructures(_tmp);
  }, [builtStructures]);
};
