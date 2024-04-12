import { Canvas } from "@react-three/fiber";
import { WorldMapScene } from "./WorldMapScene";
import { HexceptionViewScene } from "./HexceptionViewScene";
import useUIStore from "../../../hooks/store/useUIStore";
import { Perf } from "r3f-perf";
import { useLocation, Switch, Route } from "wouter";
import { AdaptiveDpr, useHelper, Clouds, Cloud, Bvh, BakeShadows, CameraShake } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { EffectComposer, Bloom, Noise, SMAA, BrightnessContrast } from "@react-three/postprocessing";
// @ts-ignore
import { useControls } from "leva";
import { CameraControls } from "../../utils/Camera";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import FPSLimiter from "../../utils/FPSLimiter";
import { getUIPositionFromColRow } from "@/ui/utils/utils";

export const Camera = () => {
  const cameraPosition = useUIStore((state) => state.cameraPosition);

  const cameraTarget = useUIStore((state) => state.cameraTarget);

  return (
    <>
      <CameraControls position={cameraPosition} target={cameraTarget} />
    </>
  );
};

export const DirectionalLightAndHelper = ({ locationType }: { locationType: string }) => {
  const dLightRef = useRef<any>();
  const sLightRef = useRef<any>();
  if (import.meta.env.DEV) {
    //useHelper(dLightRef, THREE.DirectionalLightHelper, 10, "hotpink");
    // useHelper(sLightRef, THREE.PointLightHelper, 10, "green");
  }

  const { lightPosition, bias, intensity } = useControls({
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

export const MainScene = () => {
  const [location] = useLocation();
  // location type
  const locationType = useMemo(() => {
    if (location === "/map" || location === "/") {
      return "map";
    } else {
      return "hexception";
    }
  }, [location]);

  const { mapFogNear, mapFogFar, realmFogNear, realmFogFar, fogColor } = useControls("Fog", {
    mapFogNear: { value: 1195, min: 0, max: 3000, step: 1 },
    mapFogFar: { value: 1426, min: 0, max: 3000, step: 1 },
    realmFogNear: { value: 1885, min: 0, max: 1000, step: 1 },
    realmFogFar: { value: 2300, min: 0, max: 1000, step: 1 },
    fogColor: { value: "#fff", label: "Color" },
  });

  const fogDistance = useMemo(
    () =>
      locationType === "map"
        ? {
            near: mapFogNear,
            far: mapFogFar,
          }
        : {
            near: realmFogNear,
            far: realmFogFar,
          },
    [locationType, mapFogFar, mapFogNear, realmFogFar, realmFogNear],
  );

  const {
    mapCloudsPosition,
    mapCloudsOpacity,
    mapCloudsBounds,
    mapCloudsVolume,
    hexceptionCloudsPosition,
    hexceptionCloudsOpacity,
    hexceptionCloudsBounds,
    hexceptionCloudsVolume,
  } = useControls("Clouds", {
    mapCloudsPosition: { value: [1250, 400, -650], label: "Map Clouds Position" },
    mapCloudsOpacity: { value: 0.05, min: 0, max: 1, step: 0.01, label: "Map Clouds Opacity" },
    mapCloudsBounds: { value: [1500, 1, 700], label: "Map Clouds Bounds" },
    mapCloudsVolume: { value: 700, min: 0, max: 1000, step: 1, label: "Map Clouds Volume" },
    hexceptionCloudsPosition: { value: [0, 255, -250], label: "Hexception Clouds Position" },
    hexceptionCloudsOpacity: { value: 0.1, min: 0, max: 1, step: 0.01, label: "Hexception Clouds Opacity" },
    hexceptionCloudsBounds: { value: [700, 10, 300], label: "Hexception Clouds Bounds" },
    hexceptionCloudsVolume: { value: 200, min: 0, max: 1000, step: 1, label: "Hexception Clouds Volume" },
  });

  const { ambientColor, ambientIntensity } = useControls("Ambient Light", {
    ambientColor: { value: "#fff", label: "Color" },
    ambientIntensity: { value: 0.23, min: 0, max: 1, step: 0.01 },
  });

  const { brightness, contrast } = useControls("BrightnessContrast", {
    brightness: { value: 0.22, min: 0, max: 1, step: 0.01 },
    contrast: { value: 0.48, min: 0, max: 1, step: 0.01 },
  });

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
      frameloop="demand" // for fps limiter
      className="rounded-xl"
      raycaster={{
        params: {
          Points: { threshold: 0.2 },
          Mesh: { threshold: 0.2 },
          Line: {
            threshold: 0.2,
          },
          LOD: { threshold: 0.2 },
          Sprite: { threshold: 0.2 },
        },
      }}
      camera={{ fov: 15, position: [0, 700, 0], far: 1300, near: 75 }}
      dpr={[0.5, 1]}
      performance={{
        min: 0.1,
        max: 1,
      }}
      shadows={{
        enabled: true,
        type: 2,
      }}
      gl={{
        powerPreference: "high-performance",
        antialias: false,
        stencil: false,
        depth: false,
        logarithmicDepthBuffer: true,
      }}
    >
      {import.meta.env.DEV && <Perf position="bottom-left" />}
      <FPSLimiter>
        <ambientLight color={ambientColor} intensity={ambientIntensity} />
        <Camera />
        <DirectionalLightAndHelper locationType={locationType} />
        <Bvh firstHitOnly>
          <Suspense fallback={null}>
            <Switch location={locationType}>
              <Route path="map">
                <BakeShadows />
                <WorldMapScene />
              </Route>
              <Route path="hexception">
                <CameraShake {...shakeConfig} />
                <HexceptionViewScene />
              </Route>
            </Switch>
          </Suspense>
        </Bvh>
        <EffectComposer multisampling={0}>
          <BrightnessContrast brightness={brightness} contrast={contrast} />
          <Bloom luminanceThreshold={0.9} intensity={0.1} mipmapBlur />
          <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.3} />
          <SMAA />
        </EffectComposer>
        <fog attach="fog" color={fogColor} near={fogDistance.near} far={fogDistance.far} />
        <AdaptiveDpr pixelated />
      </FPSLimiter>
    </Canvas>
  );
};
