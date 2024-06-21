import { AdaptiveDpr, Bvh, CameraShake, Cloud, Clouds, Stats } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, BrightnessContrast, EffectComposer, Noise, SMAA } from "@react-three/postprocessing";
import { Perf } from "r3f-perf";
import { Suspense, useMemo } from "react";
import { Route, Switch, useLocation } from "wouter";
import useUIStore from "../../../hooks/store/useUIStore";
import { HexceptionViewScene } from "./HexceptionViewScene";
import { WorldMapScene } from "./WorldMapScene";
// @ts-ignore
import { DepthOfField, Vignette } from "@react-three/postprocessing";
import clsx from "clsx";
import { useControls } from "leva";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { CameraControls } from "../../utils/Camera";
import FPSLimiter from "../../utils/FPSLimiter";

export const Camera = () => {
  const cameraPosition = useUIStore((state) => state.cameraPosition);
  const cameraTarget = useUIStore((state) => state.cameraTarget);

  return <CameraControls position={cameraPosition} target={cameraTarget} />;
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
    mapFogNear: { value: 1010, min: 0, max: 3000, step: 1 },
    mapFogFar: { value: 2271, min: 0, max: 3000, step: 1 },
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
    mapCloudsPosition: { value: [1250, 135, -650], label: "Map Clouds Position" },
    mapCloudsOpacity: { value: 0.02, min: 0, max: 1, step: 0.01, label: "Map Clouds Opacity" },
    mapCloudsBounds: { value: [1500, 50, 700], label: "Map Clouds Bounds" },
    mapCloudsVolume: { value: 325, min: 0, max: 1000, step: 1, label: "Map Clouds Volume" },
    hexceptionCloudsPosition: { value: [45, 32, -39], label: "Hexception Clouds Position" },
    hexceptionCloudsOpacity: { value: 0.05, min: 0, max: 1, step: 0.01, label: "Hexception Clouds Opacity" },
    hexceptionCloudsBounds: { value: [30, 6, 45], label: "Hexception Clouds Bounds" },
    hexceptionCloudsVolume: { value: 13, min: 0, max: 1000, step: 1, label: "Hexception Clouds Volume" },
  });

  const { ambientColor, ambientIntensityHexception, ambientIntensityMap } = useControls("Ambient Light", {
    ambientColor: { value: "#7b7c59", label: "Color" },
    ambientIntensityHexception: { value: 1.52, min: 0, max: 10, step: 0.01 },
    ambientIntensityMap: { value: 0.57, min: 0, max: 10, step: 0.01 },
  });

  const ambientIntensity = useMemo(() => {
    return locationType === "map" ? ambientIntensityMap : ambientIntensityHexception;
  }, [ambientIntensityHexception, ambientIntensityMap, locationType]);

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
      frameloop={import.meta.env.VITE_PUBLIC_GRAPHICS_DEV === "true" ? "always" : "demand"} // FPS limiter is enabled in production
      className={clsx("rounded-xl")}
      raycaster={{
        params: {
          Points: { threshold: 0.05 },
          Mesh: { threshold: 0.05 },
          Line: {
            threshold: 0.05,
          },
          LOD: { threshold: 0.05 },
          Sprite: { threshold: 0.05 },
        },
      }}
      camera={{ fov: 15, position: [0, 700, 0], far: 1300, near: 20 }}
      dpr={[0.5, 1]}
      performance={{
        min: 0.1,
        max: 1,
      }}
      shadows={{
        enabled: !localStorage.getItem("LOW_GRAPHICS_FLAG"),
        type: 2,
      }}
      gl={{
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: "high-performance",
        antialias: false,
        stencil: false,
        depth: true,
        logarithmicDepthBuffer: false,
      }}
    >
      {import.meta.env.VITE_PUBLIC_GRAPHICS_DEV === "true" && (
        <>
          <Stats />
          <Perf position="bottom-left" />
        </>
      )}

      <FPSLimiter>
        <ambientLight color={ambientColor} intensity={ambientIntensity} />
        <Camera />

        <Bvh firstHitOnly>
          <Suspense fallback={null}>
            <Switch location={locationType}>
              <Route path="map">
                <WorldMapScene />
                {!localStorage.getItem("LOW_GRAPHICS_FLAG") && (
                  <Clouds position={mapCloudsPosition as any} material={THREE.MeshBasicMaterial}>
                    <Cloud
                      concentrate="random"
                      seed={7331}
                      speed={0.06}
                      segments={100}
                      castShadow={true}
                      opacity={mapCloudsOpacity}
                      bounds={mapCloudsBounds}
                      volume={mapCloudsVolume}
                      color="white"
                    />
                    <Cloud
                      concentrate="random"
                      seed={1337}
                      castShadow={true}
                      speed={0.03}
                      segments={100}
                      opacity={mapCloudsOpacity}
                      bounds={mapCloudsBounds}
                      volume={mapCloudsVolume}
                      color="white"
                    />
                  </Clouds>
                )}
              </Route>
              <Route path="hexception">
                {!localStorage.getItem("LOW_GRAPHICS_FLAG") && (
                  <>
                    <CameraShake {...shakeConfig} />
                    <Clouds position={hexceptionCloudsPosition as any} material={THREE.MeshBasicMaterial}>
                      <Cloud
                        concentrate="random"
                        seed={7331}
                        speed={0.06}
                        segments={100}
                        castShadow={true}
                        opacity={hexceptionCloudsOpacity}
                        bounds={hexceptionCloudsBounds}
                        volume={hexceptionCloudsVolume}
                        color="white"
                      />
                      <Cloud
                        concentrate="random"
                        seed={1337}
                        castShadow={true}
                        speed={0.03}
                        segments={100}
                        opacity={hexceptionCloudsOpacity}
                        bounds={hexceptionCloudsBounds}
                        volume={hexceptionCloudsVolume}
                        color="white"
                      />
                    </Clouds>
                  </>
                )}
                <HexceptionViewScene />
              </Route>
            </Switch>
          </Suspense>
        </Bvh>
        <EffectComposer multisampling={0} renderPriority={1}>
          <Vignette
            offset={0.5} // vignette offset
            darkness={0.6} // vignette darkness
            eskil={false} // Eskil's vignette technique
            blendFunction={BlendFunction.NORMAL} // blend mode
          />
          {!localStorage.getItem("LOW_GRAPHICS_FLAG") ? (
            <>
              <DepthOfField
                focusDistance={0.5} // where to focus
                focalLength={1.5} // focal length
                bokehScale={3} // bokeh size
              />
              <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.1} />
              <SMAA />
              <Bloom luminanceThreshold={2} intensity={0.5} mipmapBlur />
            </>
          ) : (
            <></>
          )}
          {/* <Pixelation granularity={3} /> */}
          {/* <BrightnessContrast brightness={brightness} contrast={contrast} /> */}
        </EffectComposer>
        <fog attach="fog" color={fogColor} near={fogDistance.near} far={fogDistance.far} />
        <AdaptiveDpr pixelated />
      </FPSLimiter>
    </Canvas>
  );
};
