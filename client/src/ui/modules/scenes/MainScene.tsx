import { Canvas } from "@react-three/fiber";
import { WorldMapScene } from "./WorldMapScene";
import { HexceptionViewScene } from "./HexceptionViewScene";
import useUIStore from "../../../hooks/store/useUIStore";
import { Perf } from "r3f-perf";
import { useLocation, Switch, Route } from "wouter";
import { a } from "@react-spring/three";
import { Sky, AdaptiveDpr, useHelper, Clouds, Cloud, CameraShake, Bvh } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { EffectComposer, Bloom, Noise, SMAA, ToneMapping, BrightnessContrast } from "@react-three/postprocessing";
// @ts-ignore

import { useControls } from "leva";
import { CameraControls } from "../../utils/Camera";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import FPSLimiter from "../../utils/FPSLimiter";
import { Hexagon } from "../../../types";

export const Camera = () => {
  // const [isMapView] = useRoute("/map");

  const cameraPosition = useUIStore((state) => state.cameraPosition);
  // const camera1 = { x: 0, y: 50, z: -500 };
  // const camera2 = { x: 100, y: 30, z: -500 }
  const cameraTarget = useUIStore((state) => state.cameraTarget);

  return (
    <>
      <CameraControls position={cameraPosition} target={cameraTarget} />
    </>
  );
};

export const DirectionalLightAndHelper = ({ locationType }: { locationType: string }) => {
  const dLightRef = useRef<any>();
  if (import.meta.env.DEV) {
    useHelper(dLightRef, THREE.DirectionalLightHelper, 50, "hotpink");
  }

  const { lightPosition, bias } = useControls({
    lightPosition: {
      value: { x: 0, y: 15, z: 50 }, // Adjust y value to position the light above
      step: 0.01,
    },
    bias: {
      value: -0.002,
      min: -0.05,
      max: 0.05,
      step: 0.001,
    },
  });

  const yPos = useMemo(() => {
    return locationType === "map" ? 100 : 300;
  }, [locationType]);

  return (
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
      intensity={2}
    ></directionalLight>
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
    mapFogNear: { value: 831, min: 0, max: 3000, step: 1 },
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

  const cloudsConfig = useMemo(
    () =>
      locationType === "map"
        ? {
            position: mapCloudsPosition,
            opacity: mapCloudsOpacity,
            bounds: mapCloudsBounds,
            volume: mapCloudsVolume,
          }
        : {
            position: hexceptionCloudsPosition,
            opacity: hexceptionCloudsOpacity,
            bounds: hexceptionCloudsBounds,
            volume: hexceptionCloudsVolume,
          },
    [
      locationType,
      mapCloudsPosition,
      mapCloudsOpacity,
      mapCloudsBounds,
      mapCloudsVolume,
      hexceptionCloudsPosition,
      hexceptionCloudsOpacity,
      hexceptionCloudsBounds,
      hexceptionCloudsVolume,
    ],
  );

  const { ambientColor, ambientIntensity } = useControls("Ambient Light", {
    ambientColor: { value: "#fff", label: "Color" },
    ambientIntensity: { value: 0.36, min: 0, max: 1, step: 0.01 },
  });

  const { brightness, contrast } = useControls("BrightnessContrast", {
    brightness: { value: 0.18, min: 0, max: 1, step: 0.01 },
    contrast: { value: 0.41, min: 0, max: 1, step: 0.01 },
  });
  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  return (
    <Canvas
      frameloop="demand" // for fps limiter
      raycaster={{
        params: {
          Points: { threshold: 0.2 },
          Mesh: {},
          Line: {
            threshold: 0.2,
          },
          LOD: {},
          Sprite: {},
        },
      }}
      className="rounded-xl"
      camera={{ fov: 15, position: [0, 700, 0], far: 10000 }}
      dpr={[0.5, 1]}
      performance={{
        min: 0.1,
        max: 1,
      }}
      shadows={{
        enabled: true, // Always Enabled, but in Lights.tsx control render mode
        type: THREE.PCFSoftShadowMap,
      }}
      gl={{
        powerPreference: "high-performance",
        antialias: false,
        stencil: false,
        depth: false,
        logarithmicDepthBuffer: true,
        // useLegacyLights: data.legacyLights,
        // outputEncoding: data.encoding,
      }}
    >
      {import.meta.env.DEV && <Perf position="bottom-left" />}
      <FPSLimiter>
        {/* <Sky azimuth={azimuth} inclination={inclination} distance={distance} /> */}
        <ambientLight color={ambientColor} intensity={ambientIntensity} />
        <Camera />
        <DirectionalLightAndHelper locationType={locationType} />
        <Suspense fallback={null}>
          <a.group>
            <Switch location={locationType}>
              <Route path="map">
                <WorldMapScene />
              </Route>
              <Route path="hexception">
                {/* <CameraShake {...shakeConfig} /> */}
                <HexceptionViewScene />
                <Clouds position={cloudsConfig.position as any} material={THREE.MeshBasicMaterial}>
                  <Cloud
                    concentrate="random"
                    seed={7331}
                    speed={0.06}
                    segments={100}
                    castShadow={true}
                    opacity={cloudsConfig.opacity}
                    bounds={cloudsConfig.bounds as any}
                    volume={cloudsConfig.volume}
                    color="white"
                  />
                  <Cloud
                    concentrate="random"
                    seed={1337}
                    castShadow={true}
                    speed={0.03}
                    segments={100}
                    opacity={cloudsConfig.opacity}
                    bounds={cloudsConfig.bounds as any}
                    volume={cloudsConfig.volume}
                    color="white"
                  />
                </Clouds>
              </Route>
            </Switch>
          </a.group>
        </Suspense>
        <EffectComposer multisampling={0}>
          <BrightnessContrast brightness={brightness} contrast={contrast} />
          <Bloom luminanceThreshold={0} intensity={0.1} mipmapBlur />
          <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.3} />
          <SMAA />
        </EffectComposer>
        <fog attach="fog" color={fogColor} near={fogDistance.near} far={fogDistance.far} />
        <AdaptiveDpr pixelated />
      </FPSLimiter>
    </Canvas>
  );
};
