import { useGLTF } from "@react-three/drei";
import useUIStore from "../../../hooks/store/useUIStore";
import GroundGrid, { isHexOccupied } from "./GroundGrid";
import * as THREE from "three";
import { getUIPositionFromColRow } from "../../utils/utils";
import { useEffect, useMemo } from "react";
import { ExistingBuildings } from "./ExistingBuildings";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { BaseThreeTooltip } from "@/ui/elements/BaseThreeTooltip";
import { BuildingEnumToString, BuildingType } from "@bibliothecadao/eternum";
import { BuildingInfo } from "./SelectPreviewBuilding";

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

  const originalModels = useGLTF([
    "/models/buildings/castle.glb",
    "/models/buildings/mine.glb",
    "/models/buildings/farm.glb",
    "/models/buildings/fishery.glb",
    "/models/buildings/barracks.glb",
    "/models/buildings/market.glb",
    "/models/buildings/archer_range.glb",
    "/models/buildings/stable.glb",
    "/models/buildings/workers_hut.glb",
    "/models/buildings/workers_hut.glb",
    "/models/buildings/workers_hut.glb",
  ]);

  // Clone all models for manipulation
  const models = useMemo(() => originalModels.map((model) => model.scene.clone()), [originalModels]);

  console.log(previewBuilding);
  useEffect(() => {
    if (!previewBuilding || !hoveredBuildHex) return;
    const newColor = isHexOccupied(hoveredBuildHex.col, hoveredBuildHex.row, existingBuildings) ? "red" : "green";
    models[previewBuilding - 1].traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material = node.material.clone();
        node.material.color.set(newColor);
        node.material.transparent = true;
        node.material.opacity = 0.5;
      }
    });
  }, [previewBuilding, hoveredBuildHex, existingBuildings, models]);

  const previewModel = useMemo(() => {
    if (!previewBuilding) return null;
    return models[previewBuilding - 1];
  }, [previewBuilding, models]);

  return previewModel && previewCoords ? (
    <>
      <group position={[previewCoords.x, 2.33, -previewCoords.y]}>
        <primitive position={[0, 0, 0]} scale={3} object={previewModel} />
        {previewBuilding && <BuildingCostThree building={previewBuilding} />}
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
