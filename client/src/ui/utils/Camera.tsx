import { MapControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { button, useControls } from "leva";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { Vector3 } from "three";
import { useRoute } from "wouter";
import { soundSelector, useUiSounds } from "../../hooks/useUISound";

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
const maxHexceptionDistance = 110;
const minHexceptionDistance = 50;
const minWorldMapDistance = 150;
const maxPolarAngle = Math.PI / 3;
const minPolarAngle = 0;
const upVector = new Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const minPan = new THREE.Vector3(0, -Infinity, -1400);
const maxPan = new THREE.Vector3(2700, Infinity, 0);

const CameraControls = ({ position, target }: Props) => {
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

      gsap
        .timeline()
        .to(
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
        )
        .then(() => {
          if (duration > 0.1 && ref.current.minDistance === 5) {
            ref.current.minDistance = isMapView ? minWorldMapDistance : minHexceptionDistance;
          }
        });
    }
  }

  useEffect(() => {
    ref.current.minDistance = 5;
    setTimeout(() => {
      cameraAnimate();
      // dont play if transition is instant
      if (!position.transitionDuration || position.transitionDuration > 0.1) {
        playFly();
      }
    }, 10);
  }, [target, position]);

  // move compass direction
  // useFrame(
  //   throttle(() => {
  //     const cameraDirection = camera.rotation.y * (180 / Math.PI);
  //     setCompassDirection(cameraDirection >= 0 ? cameraDirection : 360 + cameraDirection);
  //   }, 100),
  // );

  const handleChange = useCallback((e: any) => {
    clampPan(e);
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
      enableRotate={!isMapView}
      enablePan={isMapView}
      maxDistance={isMapView ? maxMapDistance : maxHexceptionDistance}
      minDistance={isMapView ? minWorldMapDistance : minHexceptionDistance}
      maxPolarAngle={isMapView ? Math.PI / 3.65 : maxPolarAngle}
      minPolarAngle={isMapView ? Math.PI / 3.65 : minPolarAngle}
      minAzimuthAngle={isMapView ? Math.PI * 2 : undefined}
      maxAzimuthAngle={isMapView ? Math.PI * 2 : undefined}
      zoomToCursor={isMapView}
      makeDefault
      onChange={handleChange}
    />
  );
};

export { CameraControls };
