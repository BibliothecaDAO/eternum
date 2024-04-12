import { useEffect, useMemo, useRef } from "react";
import useUIStore from "../../../hooks/store/useUIStore";
import { BakeShadows, useHelper, useTexture } from "@react-three/drei";
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

const mainPosition = getUIPositionFromColRow(0, 0, true);
const pos = getUIPositionFromColRow(7, 4, true);
const pos2 = getUIPositionFromColRow(-7, 5, true);
const pos3 = getUIPositionFromColRow(-7, -4, true);
const pos4 = getUIPositionFromColRow(7, -5, true);
const pos5 = getUIPositionFromColRow(0, 9, true);
const pos6 = getUIPositionFromColRow(0, -9, true);

export const HexceptionViewScene = () => {
  const { setIsLoadingScreenEnabled, hexData, moveCameraToRealmView } = useUIStore((state) => state);
  const { setRealmId, setRealmEntityId } = useRealmStore();

  const realms = useGetRealms();
  const searchString = useSearch();

  const { gl } = useThree();

  const hexPosition = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const x = params.get("col");
    const y = params.get("row");
    return { col: Number(x), row: Number(y) };
  }, [searchString]);

  const realm = useMemo(() => {
    const _tmp = realms.find((realm) => realm.position.x === hexPosition.col && realm.position.y === hexPosition.row);
    if (!_tmp) return undefined;
    return _tmp;
  }, [hexPosition, realms]);

  useEffect(() => {
    if (realm) {
      setRealmId(realm.realmId);
      setRealmEntityId(realm.entity_id);
      setTimeout(() => {
        gl.shadowMap.needsUpdate = true;
      }, 0);
    }
  }, [realm]);

  const { neighborHexes, mainHex } = useMemo(() => {
    const mainHex = hexData?.find((hex) => hex.col === hexPosition.col && hex.row === hexPosition.row);

    const neighborOffsets = hexPosition.row % 2 !== 0 ? neighborOffsetsEven : neighborOffsetsOdd;
    const neighborHexes = neighborOffsets.map((neighbor: { i: number; j: number; direction: number }) => {
      const tmpCol = hexPosition.col + neighbor.i;
      const tmpRow = hexPosition.row + neighbor.j;
      return { col: tmpCol, row: tmpRow };
    });
    return { neighborHexes, mainHex };
  }, [hexPosition]);

  const neighborHexesInsideView = useMemo(() => {
    return hexData?.filter((hex) =>
      neighborHexes?.some((neighborHex: any) => neighborHex.col === hex.col && neighborHex.row === hex.row),
    );
  }, [hexData, neighborHexes]);

  useEffect(() => {
    moveCameraToRealmView();
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
      <group position={[mainPosition.x, 0, -mainPosition.y]} rotation={[0, 0, 0]}>
        {realm ? <BuildArea /> : <BigHexBiome biome={mainHex?.biome as any} />}
      </group>
      {neighborHexesInsideView && neighborHexesInsideView.length > 0 && (
        <group>
          <group position={[pos.x, 0, -pos.y]} rotation={[0, 0, 0]}>
            <BigHexBiome biome={neighborHexesInsideView[0].biome as any} />
          </group>
          <group position={[pos2.x, 0, -pos2.y]}>
            <BigHexBiome biome={neighborHexesInsideView[1].biome as any} />
          </group>
          <group position={[pos3.x, 0, -pos3.y]}>
            <BigHexBiome biome={neighborHexesInsideView[2].biome as any} />
          </group>
          <group position={[pos4.x, 0, -pos4.y]}>
            <BigHexBiome biome={neighborHexesInsideView[3].biome as any} />
          </group>
          <group position={[pos5.x, 0, -pos5.y]}>
            <BigHexBiome biome={neighborHexesInsideView[4].biome as any} />
          </group>
          <group position={[pos6.x, 0, -pos6.y]}>
            <BigHexBiome biome={neighborHexesInsideView[5].biome as any} />
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
  const sLightRef = useRef<any>();
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

  const { sLightPosition, sLightIntensity, power } = useControls("Spot Light", {
    sLightPosition: { value: { x: 21, y: 12, z: -18 }, label: "Position" },
    sLightIntensity: { value: 75, min: 0, max: 100, step: 0.01 },
    power: { value: 2000, min: 0, max: 10000, step: 1 },
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
      <pointLight
        ref={sLightRef}
        position={[sLightPosition.x, sLightPosition.y, sLightPosition.z]}
        color="#fff"
        intensity={sLightIntensity}
        power={power}
      />
    </group>
  );
};
