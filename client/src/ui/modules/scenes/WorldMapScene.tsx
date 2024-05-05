import { useEffect, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import * as THREE from "three";

import useUIStore from "../../../hooks/store/useUIStore.js";

import HighlightedHexes from "../../components/worldmap/hexagon/HighlightedHexes.js";
import { WorldMap } from "../../components/worldmap/hexagon/WorldHexagon.js";
import { useHelper, useTexture } from "@react-three/drei";
import { useControls } from "leva";
import { getUIPositionFromColRow } from "@/ui/utils/utils.js";

const StarsSky = () => {
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 10000;
  const position = new Float32Array(particlesCount * 3);

  for (let i = 0; i < particlesCount; i += 3) {
    position[i] = Math.random() * 4000 - 750;
    position[i + 1] = Math.random() * 100 - 200;
    position[i + 2] = Math.random() * 2400 - 2200;
  }

  particlesGeometry.setAttribute("position", new THREE.BufferAttribute(position, 3));

  const particlesMaterial = new THREE.PointsMaterial({
    size: 1,
    sizeAttenuation: false,
  });

  const points = new THREE.Points(particlesGeometry, particlesMaterial);
  return <primitive object={points} />;
};

export const WorldMapScene = () => {
  const [isMapView] = useRoute("/map");
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const texture = useTexture({
    map: "/textures/paper/paper-color.jpg",
    displacementMap: "/textures/paper/paper-height.jpg",
    roughnessMap: "/textures/paper/paper-roughness.jpg",
    normalMap: "/textures/paper/paper-normal.jpg",
  });

  Object.keys(texture).forEach((key) => {
    const _texture = texture[key as keyof typeof texture];
    _texture.wrapS = THREE.RepeatWrapping;
    _texture.wrapT = THREE.RepeatWrapping;
    _texture.repeat.set(10, 30);
  });

  useEffect(() => {
    setTimeout(() => {
      setIsLoadingScreenEnabled(false);
    }, 300);
  }, []);

  return (
    <>
      {!showBlankOverlay && isMapView && <WorldMap />}
      <StarsSky />
      <HighlightedHexes />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1334.1, 0.05, -695.175]}>
        <planeGeometry args={[2668, 1390.35]} />
        <meshStandardMaterial displacementScale={0.8} roughness={0.6} metalness={0.4} {...texture} />
      </mesh>
      <WorldMapLight />
    </>
  );
};

const WorldMapLight = () => {
  const dLightRef = useRef<any>();
  // if (import.meta.env.DEV) {
  //   useHelper(dLightRef, THREE.DirectionalLightHelper, 10, "hotpink");
  // }

  const { lightPosition, intensity } = useControls("Worldmap Light", {
    lightPosition: {
      value: {
        x: 1383.6945872489268,
        y: 404.2563729638701,
        z: -1329.476006704701,
      },
      step: 0.01,
    },
    intensity: {
      value: 1.65,
      min: 0,
      max: 10,
      step: 0.01,
    },
  });

  const target = useMemo(() => {
    const pos = getUIPositionFromColRow(2147483908, 2147483772);
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }, []);

  useEffect(() => {
    dLightRef.current.target.position.set(target.x, 0, -target.y);
  }, [target]);

  return (
    <group>
      <directionalLight
        ref={dLightRef}
        position={[lightPosition.x, lightPosition.y, lightPosition.z]}
        color={"#fff"}
        intensity={intensity}
      ></directionalLight>
    </group>
  );
};
