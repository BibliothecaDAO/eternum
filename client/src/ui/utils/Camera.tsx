import { MapControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { Vector3 } from "three";
import { useControls, button } from "leva";
import { useRoute } from "wouter";
import { soundSelector, useUiSounds } from "../../hooks/useUISound";
import * as THREE from "three";
import useUIStore from "@/hooks/store/useUIStore";

interface Props {
  position: {
    x: number;
    y: number;
    z: number;
    transitionDuration?: number;
  };
  target: {
    x: number;
    y: number;
    z: number;
    transitionDuration?: number;
  };
}

const maxMapDistance = 1000;
const maxHexceptionDistance = 150;
const minDistance = 100;
const maxPolarAngle = Math.PI / 3;
const minPolarAngle = 0;
const upVector = new Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const minPan = new THREE.Vector3(0, -Infinity, -1400);
const maxPan = new THREE.Vector3(2700, Infinity, 0);

const CameraControls = ({ position, target }: Props) => {
  const setCameraPosition = useUIStore((state) => state.setCameraPosition);
  const setCameraTarget = useUIStore((state) => state.setCameraTarget);

  const {
    camera,
    gl: { domElement },
  } = useThree();
  const ref = useRef<any>(null);

  const [isMapView] = useRoute("/map");

  useControls({
    saveCameraPosition: button(() => {
      console.log(
        camera,
        { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        { x: ref?.current.target.x, y: ref?.current.target.y, z: ref?.current.target.z },
      );
    }),
  });

  const { play: playFly } = useUiSounds(soundSelector.fly);

  useEffect(() => {
    camera.up = upVector;
  }, [camera]);

  function cameraAnimate(): void {
    if (ref.current) {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(ref.current.target);

      const duration = position.transitionDuration || 2;

      gsap.timeline().to(camera.position, {
        duration,
        repeat: 0,
        x: position.x,
        y: position.y,
        z: position.z,
        ease: "power3.inOut",
      });

      gsap.timeline().to(
        ref.current.target,
        {
          duration,
          repeat: 0,
          x: target.x,
          y: target.y,
          z: target.z,
          ease: "power3.inOut",
        },
        "<",
      );
    }
  }

  useEffect(() => {
    cameraAnimate();
    playFly();
  }, [target, position]);

  const clampPan = useCallback(
    (e: any) => {
      _v.copy(e?.target.target);
      e?.target.target.clamp(minPan, maxPan);
      _v.sub(e?.target.target);
      camera.position.sub(_v);

      // setCameraPosition(camera.position.clone());
      // setCameraTarget(ref.current.target.clone());
    },
    [camera],
  );

  return (
    <MapControls
      ref={ref}
      args={[camera, domElement]}
      panSpeed={1}
      enableRotate={true}
      enablePan={isMapView}
      maxDistance={isMapView ? maxMapDistance : maxHexceptionDistance}
      minDistance={minDistance}
      maxPolarAngle={maxPolarAngle}
      minPolarAngle={minPolarAngle}
      zoomToCursor={isMapView}
      makeDefault
      onChange={clampPan}
    />
  );
};

export { CameraControls };
