import { Canvas } from "@react-three/fiber";
import { WorldMapScene } from "./WorldMapScene";
import { RealmCityViewScene } from "./RealmCityViewScene";
import useUIStore from "../../hooks/store/useUIStore";
import { Perf } from "r3f-perf";
import { useLocation, Switch, Route } from "wouter";
import { a } from "@react-spring/three";
import { Sky, CameraShake, AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { EffectComposer, Bloom, Noise, SMAA } from "@react-three/postprocessing";
// @ts-ignore
import { Sobel } from "../../utils/effects.jsx";
import { useControls } from "leva";
import { CameraControls } from "../../utils/Camera";
import { BlendFunction } from "postprocessing";

export const Camera = () => {
  const cameraPosition = useUIStore((state) => state.cameraPosition);
  const cameraTarget = useUIStore((state) => state.cameraTarget);

  return (
    <>
      <CameraControls position={cameraPosition} target={cameraTarget} />
    </>
  );
};
export const MainScene = () => {
  const { lightPosition } = useControls({
    lightPosition: {
      value: { x: 0, y: 10, z: 15 },
      step: 0.01,
    },
  });

  const [location] = useLocation();
  // location type
  const locationType = useMemo(() => {
    if (location === "/map" || location === "/") {
      return "map";
    } else {
      return "realm";
    }
  }, [location]);

  const shakeConfig = useMemo(
    () => ({
      maxYaw: 0.01, // Max amount camera can yaw in either direction
      maxPitch: 0, // Max amount camera can pitch in either direction
      maxRoll: 0, // Max amount camera can roll in either direction
      yawFrequency: 0.04, // Frequency of the the yaw rotation
      pitchFrequency: 0, // Frequency of the pitch rotation
      rollFrequency: 0, // Frequency of the roll rotation
      intensity: 1, // initial intensity of the shake
      controls: undefined, // if using orbit controls, pass a ref here so we can update the rotation
    }),
    [],
  );

  return (
    <Canvas
      raycaster={{ params: { Points: { threshold: 0.2 } } }}
      className="rounded-xl"
      camera={{ fov: 15, position: [0, 700, 0], far: 3500 }}
      dpr={[1, 2]}
      gl={{
        powerPreference: "high-performance",
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
      <directionalLight castShadow position={[lightPosition.x, lightPosition.y, lightPosition.z]} />
      <CameraShake {...shakeConfig} />
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
      <AdaptiveDpr />
      <AdaptiveEvents />
      {/* <fog attach="fog" color="skyblue" near={250} far={350} /> */}
    </Canvas>
  );
};
