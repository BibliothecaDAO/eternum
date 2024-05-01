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
import { throttle } from "lodash";

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
const minDistance = 50;
const maxPolarAngle = Math.PI / 3;
const minPolarAngle = 0;
const upVector = new Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const minPan = new THREE.Vector3(0, -Infinity, -1400);
const maxPan = new THREE.Vector3(2700, Infinity, 0);

const CameraControls = ({ position, target }: Props) => {
  const direction = useUIStore((state) => state.compassDirection);
  const setCompassDirection = useUIStore((state) => state.setCompassDirection);

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

  const updateCompassDirection = useCallback(
    throttle((cameraPosition, cameraTarget) => {
      const { x: posX, z: posZ } = cameraPosition;
      const { x: targetX, z: targetZ } = cameraTarget;

      const dx = targetX - posX;
      const dz = targetZ - posZ;
      const angleRadians = Math.atan2(dz, dx);
      const angleDegrees = angleRadians * (180 / Math.PI);
      const normalizedNewAngle = (angleDegrees + 360) % 360;

      // Determine the shortest path between the old and new angles
      const deltaAngle = normalizedNewAngle - direction;
      const shortestDelta = (deltaAngle + 360) % 360;
      const correctedDelta = shortestDelta > 180 ? shortestDelta - 360 : shortestDelta;
      const correctedDirection = direction + correctedDelta;

      setCompassDirection(correctedDirection);
    }, 32),
    [],
  );

  const handleChange = useCallback((e: any) => {
    clampPan(e);
    updateCompassDirection(camera.position, ref.current.target);
  }, []);

  const clampPan = useCallback(
    (e: any) => {
      _v.copy(e?.target.target);
      e?.target.target.clamp(minPan, maxPan);
      _v.sub(e?.target.target);
      camera.position.sub(_v);
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
      onChange={handleChange}
    />
  );
};

export { CameraControls };
