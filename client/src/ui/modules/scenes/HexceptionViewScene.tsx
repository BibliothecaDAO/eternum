import { HexType, useHexPosition } from "@/hooks/helpers/useHexPosition";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { MiddleBuilding } from "@/ui/components/construction/ExistingBuildings";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useControls } from "leva";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import BigHexBiome from "../../components/construction/BigHexBiome";
import BuildArea from "../../components/construction/BuildArea";
import { getUIPositionFromColRow } from "../../utils/utils";

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
  const { hexPosition } = useQuery();
  const { gl } = useThree();

  const moveCameraToRealmView = useUIStore((state) => state.moveCameraToRealmView);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);

  const texture = useTexture({
    map: "/textures/paper/paper-color.jpg",
    displacementMap: "/textures/paper/paper-height.jpg",
    roughnessMap: "/textures/paper/paper-roughness.jpg",
    normalMap: "/textures/paper/paper-normal.jpg",
  });

  // only realm can build
  const canConstruct = hexType === HexType.REALM;
  const hasStructure = hexType !== HexType.EMPTY;

  // BUG HERE
  useEffect(() => {
    if (hexPosition.col && hexPosition.row) {
      moveCameraToRealmView();
      setTimeout(() => {
        setIsLoadingScreenEnabled(false);
      }, 300);
    }
  }, [hexPosition]);

  useEffect(() => {
    const handleRightClick = (e: MouseEvent) => {
      e.preventDefault();

      setPreviewBuilding(null);
    };

    const canvas = gl.domElement;
    canvas.addEventListener("contextmenu", handleRightClick);

    return () => {
      canvas.removeEventListener("contextmenu", handleRightClick);
    };
  }, []);

  return (
    <>
      <group position={[positions.main.x, 0, -positions.main.y]} rotation={[0, 0, 0]}>
        {canConstruct && <BuildArea />}
        {hasStructure && <MiddleBuilding hexType={hexType} />}
        {!canConstruct && mainHex && <BigHexBiome biome={mainHex.biome as any} flat={hexType !== HexType.EMPTY} />}
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
  //   // useHelper(sLightRef, THREE.PointLightHelper, 10, "green");
  // }
  const targetRef = useRef<any>();
  const { lightPosition, bias, intensity } = useControls("Hexception Light", {
    lightPosition: {
      // value: { x: 37, y: 17, z: 2 },
      // value: { x: 22, y: 9, z: -5 },
      value: { x: 55, y: 18, z: -18 },
      step: 0.01,
    },
    intensity: {
      value: 8,
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
    const pos = getUIPositionFromColRow(10, 10, true);
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }, []);

  const targetObject = useMemo(() => {
    return new THREE.Object3D();
  }, []);

  // useEffect(() => {
  //   targetObject.position.set(target.x, 2, -target.y);
  //   //dLightRef.current.target.position.set(target.x, 2, -target.y);
  //   // sLightRef.current.target.position.set(target.x, 2, -target.y);
  // }, [target, targetObject]);

  return (
    <group>
      <primitive ref={targetRef} object={targetObject} position={[target.x, 0, -target.y]} />
      <directionalLight
        ref={dLightRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={150}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={bias}
        position={[lightPosition.x, lightPosition.y, lightPosition.z]}
        color={"#fff"}
        intensity={intensity}
        target={targetObject}
      ></directionalLight>
    </group>
  );
};
