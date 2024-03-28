import { Suspense, useEffect, useState } from "react";
import RealmLandscape from "../../components/cityview/RealmLandscape";
// import { Model } from "../../components/cityview/CityView";
import useUIStore from "../../hooks/store/useUIStore";
import { BakeShadows, Text, Instance, Instances, useTexture } from "@react-three/drei";
import RealmBuildings from "../../components/cityview/RealmBuildings";
import * as THREE from "three";
import HexInsideView from "../../components/cityview/hex/HexInsideView";
import { HEX_RADIUS } from "../../components/worldmap/hexagon/WorldHexagon";
import { get } from "lodash";
import { getUIPositionFromColRow } from "../../utils/utils";
import { createHexagonShape } from "../../components/worldmap/hexagon/HexagonGeometry";

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

  const [hexes, setHexes] = useState<any[]>([]);

  useEffect(() => {
    const MAX_SIZE = 5;

    function isInsideHex(q: number, r: number) {
      // Using axial coordinates (q, r) directly for hex grid
      return Math.abs(q) <= MAX_SIZE - 1 && Math.abs(r) <= MAX_SIZE - 1 && Math.abs(q + r) <= MAX_SIZE - 1;
    }

    for (let i = -20; i < 20; i++) {
      for (let j = -20; j < 20; j++) {
        if (isInsideHex(i, j)) {
          hexes.push({ ...getUIPositionFromColRow(i, j, true), col: i, row: j });
        }
      }
    }
  }, []);

  const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));
  const mainPosition = getUIPositionFromColRow(0, 0, true);
  //   const pos = getUIPositionFromColRow(0, 1, true);
  //   const mul = 8;
  const pos = getUIPositionFromColRow(7, 4, true);
  const pos2 = getUIPositionFromColRow(-7, 5, true);
  const pos3 = getUIPositionFromColRow(-7, -4, true);
  const pos4 = getUIPositionFromColRow(7, -5, true);
  const pos5 = getUIPositionFromColRow(0, 9, true);
  const pos6 = getUIPositionFromColRow(0, -9, true);
  return (
    <>
      {/* <HexInsideView center={{ col: 4, row: 4 }} /> */}
      <group position={[mainPosition.x, 0, -mainPosition.y]} rotation={[0, 0, 0]}>
        <HexInsideView center={{ col: 4, row: 4 }} color="red" />
      </group>
      <group position={[pos.x, 0, -pos.y]} rotation={[0, 0, 0]}>
        <HexInsideView center={{ col: 4, row: 4 }} color="yellow" />
      </group>
      <group position={[pos2.x, 0, -pos2.y]}>
        <HexInsideView center={{ col: 4, row: 4 }} color="pink" />
      </group>
      <group position={[pos3.x, 0, -pos3.y]}>
        <HexInsideView center={{ col: 4, row: 4 }} color="green" />
      </group>
      <group position={[pos4.x, 0, -pos4.y]}>
        <HexInsideView center={{ col: 4, row: 4 }} color="gray" />
      </group>
      <group position={[pos5.x, 0, -pos5.y]}>
        <HexInsideView center={{ col: 4, row: 4 }} color="orange" />
      </group>
      <group position={[pos6.x, 0, -pos6.y]}>
        <HexInsideView center={{ col: 4, row: 4 }} color="violet" />
      </group>
      {/* <group rotation={[Math.PI / -2, 0, 0]}>
        <Instances
          limit={1600} // Optional: max amount of items (for calculating buffer size)
          range={1600} // Optional: draw-range
          geometry={hexagonGeometry}
        >
          <meshMatcapMaterial color="red" />
          {hexes.map((hex, index) => {
            return (
              <Instance key={index} color="red" position={[hex.x, hex.y, 0.31]}>
                <Text color="black" anchorX="center" anchorY="middle" position={[0, 0, 0.1]}>
                  {hex.col},{hex.row}
                </Text>
              </Instance>
            );
          })}
        </Instances>
      </group> */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[2668, 1390.35]} />
        <meshStandardMaterial {...texture} />
      </mesh>
    </>
  );
};
