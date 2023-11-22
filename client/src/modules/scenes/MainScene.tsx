import { Canvas } from "@react-three/fiber";
import { WorldMapScene } from "./WorldMapScene";
import { RealmCityViewScene } from "./RealmCityViewScene";
import useUIStore from "../../hooks/store/useUIStore";
import { Perf } from "r3f-perf";
import { useLocation, Switch, Route } from "wouter";
import { a } from "@react-spring/three";
import { Sky, AdaptiveDpr, useHelper } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import { EffectComposer, Bloom, Noise, SMAA } from "@react-three/postprocessing";
// @ts-ignore
import { Sobel } from "../../utils/effects.jsx";
import { useControls } from "leva";
import { CameraControls } from "../../utils/Camera";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";

export const Camera = () => {
  const cameraPosition = useUIStore((state) => state.cameraPosition);
  const cameraTarget = useUIStore((state) => state.cameraTarget);

  const dLightRef = useRef<any>();
  if (import.meta.env.DEV) {
    useHelper(dLightRef, THREE.DirectionalLightHelper, 50, "hotpink");
  }

  const { lightPosition, bias } = useControls({
    lightPosition: {
      value: { x: 0, y: 100, z: 200 },
      step: 0.01,
    },
    bias: {
      value: -0.003,
      min: -0.05,
      max: 0.05,
      step: 0.001,
    },
  });

  return (
    <>
      <CameraControls position={cameraPosition} target={cameraTarget} />
      <directionalLight
        ref={dLightRef}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-far={3000}
        shadow-camera-left={-3000}
        shadow-camera-right={3000}
        shadow-camera-top={3000}
        shadow-camera-bottom={-3000}
        shadow-bias={bias}
        position={[lightPosition.x, lightPosition.y, lightPosition.z]}
        intensity={1}
      ></directionalLight>
    </>
  );
};
export const MainScene = () => {
  const [location] = useLocation();
  // location type
  const locationType = useMemo(() => {
    if (location === "/map" || location === "/") {
      return "map";
    } else {
      return "realm";
    }
  }, [location]);

  return (
    <Canvas
      raycaster={{ params: { Points: { threshold: 0.2 } } }}
      className="rounded-xl"
      camera={{ fov: 15, position: [0, 700, 0], far: 3500 }}
      dpr={[0.5, 1]}
      performance={{
        min: 0.5,
        max: 1,
      }}
      shadows
      gl={{
        powerPreference: "low-power",
        antialias: false,
        stencil: false,
        depth: false,
        logarithmicDepthBuffer: true,
      }}
    >
      {import.meta.env.DEV && <Perf position="bottom-left" />}
      <Sky azimuth={0.1} inclination={0.6} distance={1000} />
      <ambientLight />
      <Camera />
      {/* <CameraShake {...shakeConfig} /> */}
      <Suspense fallback={null}>
        <a.group>
          <Switch location={locationType}>
            <Route path="map">
              <WorldMapScene />
            </Route>
            <Route path="realm">
              <RealmCityViewScene />
            </Route>
          </Switch>
        </a.group>
      </Suspense>
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0} intensity={0.1} mipmapBlur />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.3} />
        <SMAA />
      </EffectComposer>
      <AdaptiveDpr pixelated />
      {/* <fog attach="fog" color="skyblue" near={250} far={350} /> */}
    </Canvas>
  );
};
