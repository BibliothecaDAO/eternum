import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useExplore } from "../../../../hooks/helpers/useExplore";
import { useTravel } from "../../../../hooks/helpers/useTravel";
import { useNotificationsStore } from "../../../../hooks/store/useNotificationsStore";
import useUIStore from "../../../../hooks/store/useUIStore";
import { findDirection, getColRowFromUIPosition } from "../../../utils/utils";
import { getPositionsAtIndex } from "./utils";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";

export const useEventHandlers = (explored: Map<number, Set<number>>) => {
  const currentArmiesTick = useBlockchainStore((state) => state.currentArmiesTick);
  const { exploreHex } = useExplore();
  const { travelToHex } = useTravel();

  const setHoveredBuildHex = useUIStore((state) => state.setHoveredBuildHex);
  const setHoveredHex = useUIStore((state) => state.setHoveredHex);
  const hexData = useUIStore((state) => state.hexData);
  const hoveredHex = useUIStore((state) => state.hoveredHex);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setClickedHex = useUIStore((state) => state.setClickedHex);
  const clickedHex = useUIStore((state) => state.clickedHex);
  const travelPaths = useUIStore((state) => state.travelPaths);
  const clearSelection = useUIStore((state) => state.clearSelection);

  const setExploreNotification = useNotificationsStore((state) => state.setExploreNotification);

  // refs
  const selectedEntityRef = useRef(selectedEntity);
  const hoveredHexRef = useRef<any>(hoveredHex);
  const clickedHexRef = useRef(clickedHex);
  const travelPathsRef = useRef(travelPaths);
  const currentArmiesTickRef = useRef(currentArmiesTick);

  useEffect(() => {
    selectedEntityRef.current = selectedEntity;
    clickedHexRef.current = clickedHex;
    travelPathsRef.current = travelPaths;
    hoveredHexRef.current = hoveredHex;
    currentArmiesTickRef.current = currentArmiesTick;
  }, [hoveredHex, travelPaths, selectedEntity, explored, clickedHex, currentArmiesTick]);

  const hoverHandler = useCallback((e: any) => {
    const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
    if (!intersect) return;

    const instanceId = intersect.instanceId;
    const mesh = intersect.object;
    const pos = getPositionsAtIndex(mesh, instanceId);
    if (!pos) return;

    const coord = getColRowFromUIPosition(pos.x, pos.y, false);
    setHoveredHex({
      col: coord.col,
      row: coord.row,
    });
    setHoveredBuildHex({
      col: coord.col,
      row: coord.row,
    });
  }, []);

  const mouseOutHandler = useCallback((e: any) => {
    setHoveredHex(undefined);
  }, []);

  const clickHandler = useCallback(
    (e: any) => {
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (!intersect) {
        clearSelection();
        return;
      }

      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);

      if (!pos) return;

      const handleHexClick = (pos: any, instanceId: any) => {
        const clickedColRow = getColRowFromUIPosition(pos.x, pos.y);
        if (
          clickedHexRef.current?.contractPos.col === clickedColRow.col &&
          clickedHexRef.current?.contractPos.row === clickedColRow.row
        ) {
          setClickedHex(undefined);
        } else {
          setClickedHex({
            contractPos: { col: clickedColRow.col, row: clickedColRow.row },
            uiPos: [pos.x, -pos.y, pos.z],
            hexIndex: instanceId,
          });
        }
      };

      const handleArmyActionClick = (id: bigint) => {
        const travelPath = travelPathsRef.current.get(`${hoveredHexRef.current.col},${hoveredHexRef.current.row}`);
        if (!travelPath) return;
        const { path, isExplored } = travelPath;
        if (isExplored) {
          handleTravelClick({ id, path, currentArmiesTick: currentArmiesTickRef.current });
        } else {
          handleExploreClick({ id, path, currentArmiesTick: currentArmiesTickRef.current });
        }
      };

      if (!selectedEntityRef.current) {
        handleHexClick(pos, instanceId);
      } else {
        handleArmyActionClick(selectedEntityRef.current.id);
      }
    },
    [hexData],
  );

  async function handleTravelClick({
    id,
    path,
    currentArmiesTick,
  }: {
    id: bigint;
    path: any[];
    currentArmiesTick: number;
  }) {
    const directions = path
      .map((_, i) => {
        if (path[i + 1] === undefined) return undefined;
        return findDirection({ col: path[i].x, row: path[i].y }, { col: path[i + 1].x, row: path[i + 1].y });
      })
      .filter((d) => d !== undefined) as number[];
    clearSelection();
    await travelToHex({ travelingEntityId: id, directions, path, currentArmiesTick });
  }

  async function handleExploreClick({
    id,
    path,
    currentArmiesTick,
  }: {
    id: bigint;
    path: any[];
    currentArmiesTick: number;
  }) {
    if (!hexData) return;
    const direction =
      path.length === 2
        ? findDirection({ col: path[0].x, row: path[0].y }, { col: path[1].x, row: path[1].y })
        : undefined;
    const hexIndex = hexData.findIndex((h) => h.col === path[1].x && h.row === path[1].y);
    const biome = hexData[hexIndex].biome;
    setExploreNotification({
      entityId: id,
      biome,
    });

    clearSelection();

    await exploreHex({
      explorerId: id,
      direction,
      path,
      currentArmiesTick,
    });
  }

  return { hoverHandler, clickHandler, mouseOutHandler };
};
