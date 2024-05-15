import { useEffect, useMemo, useRef } from "react";
import useUIStore from "../../../hooks/store/useUIStore";
import { useTexture } from "@react-three/drei";
import BuildArea from "../../components/construction/BuildArea";
import { getUIPositionFromColRow } from "../../utils/utils";
import BigHexBiome from "../../components/construction/BigHexBiome";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useGetRealms } from "../../../hooks/helpers/useRealm";
import { neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { useSearch } from "wouter/use-location";
import { useThree } from "@react-three/fiber";
import { useControls } from "leva";
import * as THREE from "three";
import { HexType, useHexPosition } from "@/hooks/helpers/useHexPosition";

const mainPosition = getUIPositionFromColRow(0, 0, true);
const posEast = getUIPositionFromColRow(7, 5, true);
const posNorthWest = getUIPositionFromColRow(-7, 4, true);
const posWest = getUIPositionFromColRow(-7, -5, true);
const posSouthEast = getUIPositionFromColRow(7, -4, true);
const posNorthEast = getUIPositionFromColRow(0, 9, true);
const posSouthWest = getUIPositionFromColRow(0, -9, true);

export const HexceptionViewScene = () => {
  const { realm, mainHex, neighborHexesInsideView, hexType } = useHexPosition();

  const texture = useTexture({
    map: "/textures/paper/paper-color.jpg",
    displacementMap: "/textures/paper/paper-height.jpg",
    roughnessMap: "/textures/paper/paper-roughness.jpg",
    normalMap: "/textures/paper/paper-normal.jpg",
  });

  return (
    <>
      <group position={[mainPosition.x, 0, -mainPosition.y]} rotation={[0, 0, 0]}>
        <group visible={hexType === HexType.REALM || hexType === HexType.BANK}>
          <BuildArea />
        </group>
        <group visible={hexType === HexType.EMPTY}>
          <BigHexBiome biome={mainHex?.biome as any} />
        </group>
      </group>
      {neighborHexesInsideView && neighborHexesInsideView.length > 0 && (
        <group>
          <group position={[posEast.x, 0, -posEast.y]} rotation={[0, 0, 0]}>
            <BigHexBiome biome={neighborHexesInsideView[0]!.biome as any} />
          </group>
          <group position={[posNorthEast.x, 0, -posNorthEast.y]}>
            <BigHexBiome biome={neighborHexesInsideView[1]!.biome as any} />
          </group>
          <group position={[posNorthWest.x, 0, -posNorthWest.y]}>
            <BigHexBiome biome={neighborHexesInsideView[2]!.biome as any} />
          </group>
          <group position={[posWest.x, 0, -posWest.y]}>
            <BigHexBiome biome={neighborHexesInsideView[3]!.biome as any} />
          </group>
          <group position={[posSouthWest.x, 0, -posSouthWest.y]}>
            <BigHexBiome biome={neighborHexesInsideView[4]!.biome as any} />
          </group>
          <group position={[posSouthEast.x, 0, -posSouthEast.y]}>
            <BigHexBiome biome={neighborHexesInsideView[5]!.biome as any} />
          </group>
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
