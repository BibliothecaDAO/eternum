import { useEffect } from "react";
import { useRoute } from "wouter";
import * as THREE from "three";

import useUIStore from "../../hooks/store/useUIStore.js";

import HighlightedHexes from "../../components/worldmap/hexagon/HighlightedHexes.js";
import { WorldMap } from "../../components/worldmap/hexagon/WorldHexagon";

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
    size: 3,
    sizeAttenuation: false,
  });

  const points = new THREE.Points(particlesGeometry, particlesMaterial);
  return <primitive object={points} />;
};

export const WorldMapScene = () => {
  const [isMapView] = useRoute("/map");
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  useEffect(() => {
    setTimeout(() => {
      setIsLoadingScreenEnabled(false);
    }, 300);
  }, []);

  return (
    <>
      {!showBlankOverlay && isMapView && <WorldMap />}
      {/* <StarsSky /> */}
      <HighlightedHexes />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1334.1, 0.1, -695.175]}>
        <planeGeometry args={[2668, 1390.35]} />
        <meshBasicMaterial color="#fff" transparent opacity={1} />
      </mesh>
    </>
  );
};
