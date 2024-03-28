import { Suspense, useEffect } from "react";
import RealmLandscape from "../../components/cityview/RealmLandscape";
// import { Model } from "../../components/cityview/CityView";
import useUIStore from "../../hooks/store/useUIStore";
import { BakeShadows, useTexture } from "@react-three/drei";
import RealmBuildings from "../../components/cityview/RealmBuildings";
import * as THREE from "three";
import HexInsideView from "../../components/cityview/hex/HexInsideView";

export const RealmCityViewScene = () => {
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  useEffect(() => {
    setIsLoadingScreenEnabled(false);
  }, []);

  const texture = useTexture({
    map: "/textures/paper/paper-color.jpg",
    displacementMap: "/textures/paper/paper-height.jpg",
    roughnessMap: "/textures/paper/paper-roughness.jpg",
    normalMap: "/textures/paper/paper-normal.jpg",
  });

  return (
    <>
      <HexInsideView center={{ col: 4, row: 4 }} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[2668, 1390.35]} />
        <meshStandardMaterial {...texture} />
      </mesh>
    </>
  );
};
