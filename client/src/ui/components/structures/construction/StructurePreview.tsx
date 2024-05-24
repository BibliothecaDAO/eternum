import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useCallback, useState } from "react";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow, ResourceIdToMiningType, ResourceMiningTypes } from "@/ui/utils/utils";
import { FELT_CENTER, useExploredHexesStore } from "../../worldmap/hexagon/WorldHexagon";
import { useStructures } from "@/hooks/helpers/useStructures";
import useRealmStore from "@/hooks/store/useRealmStore";

export interface OriginalModels {
  [key: number | string]: THREE.Group;
}

export const StructurePreview = () => {
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const setHoveredBuildHex = useUIStore((state) => state.setHoveredBuildHex);
  const hoveredBuildHex = useUIStore((state) => state.hoveredBuildHex);
  const existingStructures = useUIStore((state) => state.existingStructures);
  const exploredHexes = useExploredHexesStore((state) => state.exploredHexes);
  const { createHyperstructure } = useStructures();
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
      useGLTF("/models/buildings/bank.glb").scene.clone(),
      useGLTF("/models/buildings/bank.glb").scene.clone(),
      useGLTF("/models/buildings/mine.glb").scene.clone(),
      useGLTF("/models/buildings/castle.glb").scene.clone(),
    ],
    [],
  );

  let structureType = previewBuilding ? previewBuilding.type : 1;

  useEffect(() => {
    if (!hoveredBuildHex) return;
    setCanPlace(canPlaceStructure(hoveredBuildHex.col, hoveredBuildHex.row, existingStructures, exploredHexes));
  }, [hoveredBuildHex, existingStructures, exploredHexes, previewBuilding]);

  useEffect(() => {
    models[structureType].traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material = node.material.clone();
        node.material.color.set(canPlace ? "green" : "red");
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
    if (
      !isLoading &&
      hoveredBuildHex &&
      canPlaceStructure(hoveredBuildHex.col, hoveredBuildHex.row, existingStructures, exploredHexes)
    ) {
      setIsLoading(true);
      setPreviewBuilding(null);
      setHoveredBuildHex(null);
      createHyperstructure(realmEntityId, hoveredBuildHex.col, hoveredBuildHex.row).finally(() => setIsLoading(false));
    }
  }, [hoveredBuildHex, existingStructures, exploredHexes, createHyperstructure, previewBuilding]);

  return !isLoading && previewModel && previewCoords ? (
    <>
      <group position={[previewCoords.x, 0.32, -previewCoords.y]} onClick={onClick}>
        <primitive position={[0, 0, 0]} scale={3} object={previewModel} />
      </group>
    </>
  ) : null;
};

export const canPlaceStructure = (col: number, row: number, structures: any[], explored: Map<number, Set<number>>) => {
  const noCollision = structures.every((building) => building.col !== col || building.row !== row);
  const isExplored = explored.get(col - FELT_CENTER)?.has(row - FELT_CENTER);
  return noCollision === true && isExplored === true;
};
