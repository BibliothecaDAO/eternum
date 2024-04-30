import { useGLTF } from "@react-three/drei";
import useUIStore from "../../../hooks/store/useUIStore";
import GroundGrid, { isHexOccupied } from "./GroundGrid";
import * as THREE from "three";
import { getUIPositionFromColRow } from "../../utils/utils";
import { useEffect, useMemo } from "react";
import { ExistingBuildings } from "./ExistingBuildings";
import { BaseThreeTooltip } from "@/ui/elements/BaseThreeTooltip";
import { BuildingEnumToString, BuildingType } from "@bibliothecadao/eternum";

export interface OriginalModels {
  [key: number]: THREE.Group;
}

const BuildArea = () => {
  return (
    <group>
      <BuildingPreview />
      <ExistingBuildings />
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
      [BuildingType.Castle]: useGLTF("/models/buildings/castle.glb").scene.clone(),
      [BuildingType.Resource]: useGLTF("/models/buildings/mine.glb").scene.clone(),
      [BuildingType.Farm]: useGLTF("/models/buildings/farm.glb").scene.clone(),
      [BuildingType.FishingVillage]: useGLTF("/models/buildings/fishery.glb").scene.clone(),
      [BuildingType.Barracks]: useGLTF("/models/buildings/barracks.glb").scene.clone(),
      [BuildingType.Market]: useGLTF("/models/buildings/market.glb").scene.clone(),
      [BuildingType.ArcheryRange]: useGLTF("/models/buildings/archer_range.glb").scene.clone(),
      [BuildingType.Stable]: useGLTF("/models/buildings/stable.glb").scene.clone(),
      [BuildingType.WorkersHut]: useGLTF("/models/buildings/workers_hut.glb").scene.clone(),
      [BuildingType.Storehouse]: useGLTF("/models/buildings/storehouse.glb").scene.clone(),
    }),
    [],
  );

  useEffect(() => {
    if (!previewBuilding || !hoveredBuildHex) return;
    const newColor = isHexOccupied(hoveredBuildHex.col, hoveredBuildHex.row, existingBuildings) ? "red" : "green";
    originalModels[Number(previewBuilding)].traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material = node.material.clone();
        node.material.color.set(newColor);
        node.material.transparent = true;
        node.material.opacity = 0.8;
      }
    });
  }, [previewBuilding, hoveredBuildHex, existingBuildings, originalModels]);

  const previewModel = useMemo(() => {
    if (!previewBuilding) return null;
    return originalModels[previewBuilding];
  }, [previewBuilding, originalModels]);

  return previewModel && previewCoords ? (
    <>
      <group position={[previewCoords.x, 2.33, -previewCoords.y]}>
        <primitive position={[0, 0, 0]} scale={3} object={previewModel} />
        {/* {previewBuilding && <BuildingCostThree building={previewBuilding} />} */}
      </group>
    </>
  ) : null;
};

const BuildingCostThree = ({ building }: { building: BuildingType }) => {
  return (
    <BaseThreeTooltip distanceFactor={30}>
      <div className="flex flex-col  text-sm p-1 space-y-1">
        <div className="font-bold text-center">
          {BuildingEnumToString[building as keyof typeof BuildingEnumToString]}
        </div>
        {/* <BuildingInfo buildingId={building} /> */}
      </div>
    </BaseThreeTooltip>
  );
};
