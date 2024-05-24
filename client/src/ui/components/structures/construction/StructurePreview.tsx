import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { BaseThreeTooltip } from "@/ui/elements/BaseThreeTooltip";
import { BuildingEnumToString, BuildingType, StructureType } from "@bibliothecadao/eternum";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow, ResourceIdToMiningType, ResourceMiningTypes } from "@/ui/utils/utils";
import { ModelsIndexes, structureTypeToModelsIndex } from "../../construction/ExistingBuildings";
import { isHexOccupied } from "../../construction/GroundGrid";
import { preview } from "vite";

export interface OriginalModels {
  [key: number | string]: THREE.Group;
}

export const StructurePreview = () => {
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const hoveredBuildHex = useUIStore((state) => state.hoveredBuildHex);
  const existingStructures = useUIStore((state) => state.existingStructures);

  const previewCoords = useMemo(() => {
    if (!hoveredBuildHex) return null;
    return getUIPositionFromColRow(hoveredBuildHex.col, hoveredBuildHex.row, true);
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
    const newColor = isHexOccupied(hoveredBuildHex.col, hoveredBuildHex.row, existingStructures) ? "red" : "green";
    models[structureType].traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material = node.material.clone();
        node.material.color.set(newColor);
        node.material.transparent = true;
        node.material.opacity = 0.8;
      }
    });
  }, [hoveredBuildHex, existingStructures, models]);

  const previewModel = useMemo(() => {
    if (!previewBuilding) return null;
    return models[structureType];
  }, [structureType, models, previewBuilding]);

  return previewModel && previewCoords ? (
    <>
      <group position={[previewCoords.x, 0.32, -previewCoords.y]}>
        <primitive position={[0, 0, 0]} scale={3} object={previewModel} />
      </group>
    </>
  ) : null;
};

export const canPlaceStructure = (col: number, row: number, structures: any[], explored: any[]) => {
  return (
    !structures.some((building) => building.col === col && building.row === row) &&
    explored.some((hex) => hex.col === col && hex.row === row)
  );
};
