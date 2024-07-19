import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Hexagon } from "@/types";
import { FELT_CENTER } from "@/ui/config";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { StructureType } from "@bibliothecadao/eternum";
import { useGLTF } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useExploredHexesStore } from "../../worldmap/hexagon/WorldHexagon";

export const StructurePreview = () => {
  const {
    setup: {
      account: { account },
      systemCalls: { create_hyperstructure },
    },
  } = useDojo();
  const hexData = useUIStore((state) => state.hexData);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const setHoveredBuildHex = useUIStore((state) => state.setHoveredBuildHex);
  const hoveredBuildHex = useUIStore((state) => state.hoveredBuildHex);
  const existingStructures = useUIStore((state) => state.existingStructures);
  const exploredHexes = useExploredHexesStore((state) => state.exploredHexes);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const [isLoading, setIsLoading] = useState(false);
  const [canPlace, setCanPlace] = useState(false);

  const previewCoords = useMemo(() => {
    if (!hoveredBuildHex) return null;
    return getUIPositionFromColRow(hoveredBuildHex.col, hoveredBuildHex.row, false);
  }, [hoveredBuildHex]);

  const models = useMemo(
    () => [
      useGLTF("/models/buildings/castle.glb").scene.clone(),
      useGLTF("/models/buildings/castle.glb").scene.clone(),
      useGLTF("/models/buildings/hyperstructure.glb").scene.clone(),
      useGLTF("/models/buildings/bank.glb").scene.clone(),
      useGLTF("/models/buildings/mine.glb").scene.clone(),
      useGLTF("/models/buildings/castle.glb").scene.clone(),
    ],
    [],
  );

  let structureType = previewBuilding ? previewBuilding.type : 1;

  useEffect(() => {
    if (!hoveredBuildHex || !hexData) return;
    setCanPlace(
      canPlaceStructure(hoveredBuildHex.col, hoveredBuildHex.row, existingStructures, exploredHexes, hexData),
    );
  }, [hoveredBuildHex, existingStructures, exploredHexes, previewBuilding]);

  useEffect(() => {
    models[structureType].traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material = node.material.clone();
        const col = canPlace ? "green" : "red";
        const color = new THREE.Color(col);
        color.multiplyScalar(5);
        node.material.color.set(color);
        node.material.transparent = true;
        node.material.opacity = 0.8;
      }
    });
  }, [models, structureType, canPlace]);

  const previewModel = useMemo(() => {
    if (!previewBuilding) return null;
    return models[structureType];
  }, [structureType, models, previewBuilding]);

  const onClick = useCallback(async () => {
    if (!isLoading && hoveredBuildHex && canPlace) {
      setIsLoading(true);
      setPreviewBuilding(null);
      setHoveredBuildHex(null);
      await create_hyperstructure({
        signer: account,
        coords: { x: hoveredBuildHex.col, y: hoveredBuildHex.row },
        creator_entity_id: realmEntityId,
      }).finally(() => setIsLoading(false));
    }
  }, [hoveredBuildHex, canPlace]);

  const scale = previewBuilding?.type === StructureType.Hyperstructure ? 1.5 : 3;

  return !isLoading && previewModel && previewCoords ? (
    <>
      <group position={[previewCoords.x, 0.32, -previewCoords.y]} onClick={onClick}>
        <primitive position={[0, 0, 0]} scale={scale} object={previewModel} />
      </group>
    </>
  ) : null;
};

const canPlaceStructure = (
  col: number,
  row: number,
  structures: any[],
  explored: Map<number, Set<number>>,
  hexData: Hexagon[],
) => {
  const hex = hexData?.find((hex) => hex.col === col && hex.row === row);
  const noWater = hex?.biome !== "ocean";
  const noCollision = structures.every((building) => building.col !== col || building.row !== row);
  const isExplored = explored.get(col - FELT_CENTER)?.has(row - FELT_CENTER);
  return noWater === true && noCollision === true && isExplored === true;
};
