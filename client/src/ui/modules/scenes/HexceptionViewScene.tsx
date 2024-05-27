import { useEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import BuildArea from "../../components/construction/BuildArea";
import { getUIPositionFromColRow } from "../../utils/utils";
import BigHexBiome from "../../components/construction/BigHexBiome";
import { useControls } from "leva";
import * as THREE from "three";
import { HexType, useHexPosition } from "@/hooks/helpers/useHexPosition";
import { ExistingBuildings } from "@/ui/components/construction/ExistingBuildings";

const positions = {
  main: getUIPositionFromColRow(0, 0, true),
  east: getUIPositionFromColRow(7, 5, true),
  northEast: getUIPositionFromColRow(0, 9, true),
  northWest: getUIPositionFromColRow(-7, 4, true),
  west: getUIPositionFromColRow(-7, -5, true),
  southWest: getUIPositionFromColRow(0, -9, true),
  southEast: getUIPositionFromColRow(7, -4, true),
};

export const HexceptionViewScene = () => {
  const { mainHex, neighborHexesInsideView, hexType } = useHexPosition();

  const texture = useTexture({
    map: "/textures/paper/paper-color.jpg",
    displacementMap: "/textures/paper/paper-height.jpg",
    roughnessMap: "/textures/paper/paper-roughness.jpg",
    normalMap: "/textures/paper/paper-normal.jpg",
  });

  // only realm can build
  const canConstruct = hexType === HexType.REALM;

  return (
    <>
      <group position={[positions.main.x, 0, -positions.main.y]} rotation={[0, 0, 0]}>
        <group visible={canConstruct}>
          <BuildArea />
        </group>
        <ExistingBuildings />
        <group visible={!canConstruct}>
          {mainHex && <BigHexBiome biome={mainHex.biome as any} flat={hexType !== HexType.EMPTY} />}
        </group>
      </group>
      {neighborHexesInsideView && (
        <group>
          {Object.values(positions)
            .slice(0)
            .map((position, index) => {
              const hex = neighborHexesInsideView[index - 1];
              return (
                hex?.biome && (
                  <group key={index} position={[position.x, 0, -position.y]} rotation={[0, 0, 0]}>
                    <BigHexBiome biome={hex.biome as any} flat={false} />
                  </group>
                )
              );
            })}
        </group>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[2668, 1390.35]} />
        <meshStandardMaterial {...texture} />
      </mesh>
      <HexceptionLight />
    </>
  );
};

const HexceptionLight = () => {
  const dLightRef = useRef<any>();
  // if (import.meta.env.DEV) {
  //   useHelper(dLightRef, THREE.DirectionalLightHelper, 10, "hotpink");
  //   useHelper(sLightRef, THREE.PointLightHelper, 10, "green");
  // }

  const { lightPosition, bias, intensity } = useControls("Hexception Light", {
    lightPosition: {
      // value: { x: 37, y: 17, z: 2 },
      // value: { x: 22, y: 9, z: -5 },
      value: { x: 29, y: 20, z: 35 },
      step: 0.01,
    },
    intensity: {
      value: 1.65,
      min: 0,
      max: 10,
      step: 0.01,
    },
    bias: {
      value: 0.04,
      min: -0.05,
      max: 0.05,
      step: 0.001,
    },
  });

  const target = useMemo(() => {
    const pos = getUIPositionFromColRow(4, 4, true);
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }, []);

  useEffect(() => {
    dLightRef.current.target.position.set(target.x, 2, -target.y);
    // sLightRef.current.target.position.set(target.x, 2, -target.y);
  }, [target]);

  return (
    <group>
      <directionalLight
        ref={dLightRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={75}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-bias={bias}
        position={[lightPosition.x, lightPosition.y, lightPosition.z]}
        color={"#fff"}
        intensity={intensity}
      ></directionalLight>
    </group>
  );
};
