import { useGLTF } from "@react-three/drei";
import useUIStore from "../../../hooks/store/useUIStore";
import GroundGrid, { isHexOccupied } from "./GroundGrid";
import * as THREE from "three";
import { ResourceIdToMiningType, ResourceMiningTypes, getUIPositionFromColRow } from "../../utils/utils";
import { useEffect, useMemo } from "react";
import { ExistingBuildings, ModelsIndexes } from "./ExistingBuildings";
import { BaseThreeTooltip } from "@/ui/elements/BaseThreeTooltip";
import { BuildingEnumToString, BuildingType } from "@bibliothecadao/eternum";

export interface OriginalModels {
  [key: number | string]: THREE.Group;
}

const BuildArea = () => {
  return (
    <group>
      <BuildingPreview />
      <GroundGrid />
    </group>
  );
};

export default BuildArea;

const BuildingPreview = () => {
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const hoveredBuildHex = useUIStore((state) => state.hoveredBuildHex);
  const existingBuildings = useUIStore((state) => state.existingBuildings);

  const previewCoords = useMemo(() => {
    if (!hoveredBuildHex) return null;
    return getUIPositionFromColRow(hoveredBuildHex.col, hoveredBuildHex.row, true);
  }, [hoveredBuildHex]);

  const originalModels: OriginalModels = useMemo(
    () => ({
      [ModelsIndexes.Castle]: useGLTF("/models/buildings/castle.glb").scene.clone(),
      [ModelsIndexes.Farm]: useGLTF("/models/buildings/farm.glb").scene.clone(),
      [ModelsIndexes.Fishery]: useGLTF("/models/buildings/fishery.glb").scene.clone(),
      [ModelsIndexes.Barracks]: useGLTF("/models/buildings/barracks.glb").scene.clone(),
      [ModelsIndexes.Market]: useGLTF("/models/buildings/market.glb").scene.clone(),
      [ModelsIndexes.ArcheryRange]: useGLTF("/models/buildings/archer_range.glb").scene.clone(),
      [ModelsIndexes.Stable]: useGLTF("/models/buildings/stable.glb").scene.clone(),
      [ModelsIndexes.WorkersHut]: useGLTF("/models/buildings/workers_hut.glb").scene.clone(),
      [ModelsIndexes.Storehouse]: useGLTF("/models/buildings/storehouse.glb").scene.clone(),
      [ModelsIndexes.Bank]: useGLTF("/models/buildings/bank.glb").scene.clone(),
      [ResourceMiningTypes.Forge]: useGLTF("/models/buildings/forge.glb").scene.clone(),
      [ResourceMiningTypes.Mine]: useGLTF("/models/buildings/mine.glb").scene.clone(),
      [ResourceMiningTypes.LumberMill]: useGLTF("/models/buildings/lumber_mill.glb").scene.clone(),
      [ResourceMiningTypes.Dragonhide]: useGLTF("/models/buildings/dragonhide.glb").scene.clone(),
    }),
    [],
  );

  const modelIndex = useMemo(() => {
    if (previewBuilding?.type === BuildingType.Resource && previewBuilding.resource) {
      return ResourceIdToMiningType[previewBuilding.resource] || ResourceMiningTypes.Mine;
    }
    return previewBuilding?.type || 1;
  }, [previewBuilding]);

  useEffect(() => {
    if (!hoveredBuildHex) return;
    const newColor = isHexOccupied(hoveredBuildHex.col, hoveredBuildHex.row, existingBuildings) ? "red" : "green";
    originalModels[modelIndex].traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material = node.material.clone();
        node.material.color.set(newColor);
        node.material.transparent = true;
        node.material.opacity = 0.8;
      }
    });
  }, [modelIndex, hoveredBuildHex, existingBuildings, originalModels]);

  const previewModel = useMemo(() => {
    if (!previewBuilding) return null;
    return originalModels[modelIndex];
  }, [modelIndex, originalModels]);

  return previewModel && previewCoords ? (
    <>
      <group position={[previewCoords.x, 2.33, -previewCoords.y]}>
        <primitive position={[0, 0, 0]} scale={3} object={previewModel} />
      </group>
    </>
  ) : null;
};
