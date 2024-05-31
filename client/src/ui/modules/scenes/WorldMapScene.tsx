import { useEffect, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import * as THREE from "three";
import useUIStore from "../../../hooks/store/useUIStore.js";

import HighlightedHexes from "../../components/worldmap/hexagon/HighlightedHexes.js";
import { WorldMap } from "../../components/worldmap/hexagon/WorldHexagon.js";
import { useHelper, useTexture } from "@react-three/drei";
import { button, useControls } from "leva";
import { getUIPositionFromColRow } from "@/ui/utils/utils.js";
import { ActionInfo } from "@/ui/components/worldmap/hexagon/ActionInfo.js";
import { StructurePreview } from "@/ui/components/structures/construction/StructurePreview.js";
import { useFrame, useThree } from "@react-three/fiber";

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

const scale = 20;
export const WorldMapScene = () => {
  const [isMapView] = useRoute("/map");
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { gl } = useThree();

  const texture = useTexture({
    map: "/textures/paper/worldmap-bg.png",
    displacementMap: "/textures/paper/paper-height.jpg",
  });

  useMemo(() => {
    Object.keys(texture).forEach((key) => {
      const _texture = texture[key as keyof typeof texture];
      _texture.wrapS = THREE.RepeatWrapping;
      _texture.wrapT = THREE.RepeatWrapping;
      _texture.repeat.set(scale, scale / 2.5);
      // _texture.magFilter
    });
  }, [texture]);

  useEffect(() => {
    setTimeout(() => {
      setIsLoadingScreenEnabled(false);
    }, 300);

    const handleRightClick = (e: any) => {
      e.preventDefault();
      clearSelection();
    };

    gl.domElement.addEventListener("contextmenu", handleRightClick);

    return () => {
      gl.domElement.removeEventListener("contextmenu", handleRightClick);
    };
  }, []);

  const { metalness, roughness } = useControls("map material", {
    metalness: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Metalness",
    },
    roughness: {
      value: 0.7,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Roughness",
    },
  });

  return (
    <>
      {!showBlankOverlay && isMapView && <WorldMap />}
      <HighlightedHexes />
      <ActionInfo />
      <StructurePreview />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1334.1, 0.05, -695.175]} receiveShadow>
        <planeGeometry args={[2668, 1390.35]} />
        <meshStandardMaterial {...texture} metalness={metalness} roughness={roughness} />
      </mesh>
      <WorldMapLight />
    </>
  );
};

const WorldMapLight = () => {
  const dLightRef = useRef<any>();
  if (import.meta.env.DEV) {
    useHelper(dLightRef, THREE.DirectionalLightHelper, 10, "hotpink");
  }
  const { camera } = useThree(); // Import useThree to access the camera

  const { lightPosition, intensity, bias } = useControls("Worldmap Light", {
    lightPosition: {
      value: {
        x: 1227.7357824149108,
        y: 22.87194105743851,
        z: -670.8113762465337,
      },
      step: 0.01,
    },
    intensity: {
      value: 1.65,
      min: 0,
      max: 2,
      step: 0.01,
    },
    bias: {
      value: 0.0,
      min: 0,
      max: 1,
      step: 0.01,
    },
  });

  const target = useMemo(() => {
    const pos = getUIPositionFromColRow(2147483889, 2147483807);
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }, []);

  useEffect(() => {
    dLightRef.current.target.position.set(target.x, 0, -target.y);
  }, [target]);

  useControls({
    moveLight: button(() => {
      dLightRef.current.position.x = camera.position.x;
      dLightRef.current.position.z = camera.position.z;
      dLightRef.current.target.position.x = camera.position.x + 30;
      dLightRef.current.target.position.z = camera.position.z - 50;
    }),
  });

  useFrame(({ camera, gl, get }) => {
    // @ts-ignore
    const target = get()?.controls?.target;
    const distanceMultiplier = camera.position.y / 500;
    const offsetX = 30 + 170 * distanceMultiplier;
    const offsetY = -50 - 180 * distanceMultiplier;
    dLightRef.current.position.x = target.x - offsetX;
    dLightRef.current.position.z = target.z - offsetY;
    dLightRef.current.target.position.x = target.x + 30 - offsetX;
    dLightRef.current.target.position.z = target.z - 50 - offsetY;
    dLightRef.current.shadow.camera.left = -75 - 300 * distanceMultiplier;
    dLightRef.current.shadow.camera.right = 75 + 300 * distanceMultiplier;
    dLightRef.current.shadow.camera.top = 75 + 300 * distanceMultiplier;
    dLightRef.current.shadow.camera.far = 150 + 300 * distanceMultiplier;
    dLightRef.current.shadow.camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
  });

  return (
    <group>
      <directionalLight
        ref={dLightRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={150}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-bias={bias}
        position={[lightPosition.x, lightPosition.y, lightPosition.z]}
        color={"#fff"}
        intensity={intensity}
      />
    </group>
  );
};
