import { HyperstructureFinishedEvent, LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { ContractAddress, ID, Position, StructureType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { useEffect, useRef, useState } from "react";
import { Subscription } from "rxjs";
import { ClickedHex, HexPosition, Hexagon, HighlightPositions, TravelPath } from "../../types";
import { useDojo } from "../context/DojoContext";
import { useContributions } from "../helpers/useContributions";
import { useLeaderBoardStore } from "./useLeaderBoardStore";
import useUIStore from "./useUIStore";

enum ArmyMode {
  Travel,
  Explore,
  Attack,
}

export interface MapStore {
  worldMapBuilding: StructureType | null;
  setWorldMapBuilding: (building: StructureType | null) => void;
  clickedHex: ClickedHex | undefined;
  setClickedHex: (hex: ClickedHex | undefined) => void;
  hexData: Hexagon[] | undefined;
  setHexData: (hexData: Hexagon[]) => void;
  selectedEntity: { id: ID; position: Position } | undefined;
  setSelectedEntity: (entity: { id: ID; position: Position } | undefined) => void;
  selectedBattle: { id: ID; position: Position } | undefined;
  setSelectedBattle: (battle: { id: ID; position: Position } | undefined) => void;
  armyMode: ArmyMode | null;
  setArmyMode: (mode: ArmyMode | null) => void;
  travelPaths: Map<string, TravelPath>;
  setTravelPaths: (paths: Map<string, TravelPath>) => void;
  highlightPositions: HighlightPositions;
  setHighlightPositions: (positions: HighlightPositions) => void;
  hoveredHex: HexPosition | undefined;
  setHoveredHex: (position: HexPosition | undefined) => void;
  clearSelection: () => void;
  showAllArmies: boolean;
  toggleShowAllArmies: () => void;
  existingStructures: { col: number; row: number; type: StructureType; entityId: ID }[];
  setExistingStructures: (
    existingStructures: { col: number; row: number; type: StructureType; entityId: ID }[],
  ) => void;
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
  setSelectedEntity: (entity: { id: ID; position: Position } | undefined) => set({ selectedEntity: entity }),
  selectedBattle: undefined,
  setSelectedBattle: (battle: { id: ID; position: Position } | undefined) => set({ selectedBattle: battle }),
  armyMode: null,
  setArmyMode: (armyMode: ArmyMode | null) => set({ armyMode }),
  travelPaths: new Map<string, TravelPath>(),
  setTravelPaths: (paths: Map<string, TravelPath>) => set({ travelPaths: paths }),
  highlightPositions: { pos: [], color: 0 },
  setHighlightPositions: (positions: HighlightPositions) => {
    set({ highlightPositions: positions });
  },
  hoveredHex: undefined,
  setHoveredHex: (position: HexPosition | undefined) => set({ hoveredHex: position }),
  hoveredHexColor: 0,
  setHoveredHexColor: (color: number) => set({ hoveredHexColor: color }),
  clearSelection: () =>
    set({
      selectedEntity: undefined,
      selectedBattle: undefined,
      armyMode: null,
      highlightPositions: { pos: [], color: 0 },
      hoveredHexColor: 0,
      travelPaths: new Map<string, TravelPath>(),
    }),
  showAllArmies: false,
  toggleShowAllArmies: () => {
    set((state: MapStore) => {
      return { showAllArmies: !state.showAllArmies };
    });
  },
  existingStructures: [],
  setExistingStructures: (existingStructures: { col: number; row: number; type: StructureType; entityId: ID }[]) =>
    set({ existingStructures }),
});

export const useSetExistingStructures = () => {
  const [newFinishedHs, setNewFinishedHs] = useState<HyperstructureFinishedEvent | null>(null);
  const {
    setup: {
      components: { Structure, Position, Owner },
      updates: {
        eventUpdates: { createHyperstructureFinishedEvents, createHyperstructureCoOwnerChangeEvents },
      },
    },
    account: { account },
    masterAccount,
  } = useDojo();

  const { getContributions } = useContributions();

  const subEventFinishedCreated = useRef<boolean>(false);
  const eventFinishedSubscriptionRef = useRef<Subscription | undefined>();

  const subEventCoOwnerChangedCreated = useRef<boolean>(false);
  const eventCoOwnerChangedSubscriptionRef = useRef<Subscription | undefined>();

  const setExistingStructures = useUIStore((state) => state.setExistingStructures);

  const finishedHyperstructures = useLeaderBoardStore((state) => state.finishedHyperstructures);
  const setFinishedHyperstructures = useLeaderBoardStore((state) => state.setFinishedHyperstructures);

  const builtStructures = useEntityQuery([Has(Structure)]);

  useEffect(() => {
    if (newFinishedHs === null) return;
    setFinishedHyperstructures([...finishedHyperstructures, newFinishedHs]);
  }, [newFinishedHs]);

  useEffect(() => {
    if (!createHyperstructureFinishedEvents) return;

    const subscription = async () => {
      const observable = await createHyperstructureFinishedEvents();
      let events: HyperstructureFinishedEvent[] = [];
      const sub = observable.subscribe((event) => {
        if (event) {
          const parsedEvent: HyperstructureFinishedEvent =
            LeaderboardManager.instance().processHyperstructureFinishedEventData(event, getContributions);
          setNewFinishedHs(parsedEvent);
          events.push(parsedEvent);
        }
      });
      setFinishedHyperstructures(events);

      eventFinishedSubscriptionRef.current = sub;
    };

    if (subEventFinishedCreated.current) return;

    subEventFinishedCreated.current = true;
    subscription();

    return () => {
      eventFinishedSubscriptionRef.current?.unsubscribe();
      subEventFinishedCreated.current = false;
    };
  }, []);

  useEffect(() => {
    if (!createHyperstructureCoOwnerChangeEvents) return;

    const subscription = async () => {
      const observable = await createHyperstructureCoOwnerChangeEvents();
      const sub = observable.subscribe((event) => {
        if (event) {
          LeaderboardManager.instance().processHyperstructureCoOwnersChangeEvent(event);
        }
      });

      eventCoOwnerChangedSubscriptionRef.current = sub;
    };

    if (subEventCoOwnerChangedCreated.current) return;

    subEventCoOwnerChangedCreated.current = true;
    subscription();

    return () => {
      eventCoOwnerChangedSubscriptionRef.current?.unsubscribe();
      subEventCoOwnerChangedCreated.current = false;
    };
  }, []);

  useEffect(() => {
    const _tmp = builtStructures
      .map((entity) => {
        const position = getComponentValue(Position, entity);
        const structure = getComponentValue(Structure, entity);
        const owner = getComponentValue(Owner, entity);
        const type = StructureType[structure!.category as keyof typeof StructureType];
        if (account.address === masterAccount.address) return null;
        if (!position || !structure || !owner) return null;
        const isMine = owner?.address === ContractAddress(account.address);
        return {
          col: Number(position.x),
          row: Number(position.y),
          type: type as StructureType,
          entity: entity,
          entityId: structure.entity_id,
          isMine,
        };
      })
      .filter(Boolean) as { col: number; row: number; type: StructureType; entityId: ID }[];

    setExistingStructures(_tmp);
  }, [builtStructures, account.address]);
};
