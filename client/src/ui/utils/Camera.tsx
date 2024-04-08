import { MapControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef, useMemo } from "react";
import { Vector3 } from "three";
import { useControls, button } from "leva";
import { useLocation, useRoute } from "wouter";
import { soundSelector, useUiSounds } from "../../hooks/useUISound";
import * as THREE from "three";
import useUIStore from "../../hooks/store/useUIStore";
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
const CameraControls = ({ position, target }: Props) => {
  const {
    camera,
    gl: { domElement },
  } = useThree();
  const ref = useRef<any>(null);

  const [isMapView] = useRoute("/map");
  const [location]: any = useLocation();
  const moveCameraToRealmView = useUIStore((state) => state.moveCameraToRealmView);

  const maxDistance = 1000;

  const minDistance = 100;

  const maxPolarAngle = Math.PI / 3;

  const minPolarAngle = 0;

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

  camera.up = new Vector3(0, 1, 0);
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

  useEffect(() => {
    console.log(location);
    if (location.includes("/realm")) {
      moveCameraToRealmView();
    }
  }, [location]);

  var minPan = isMapView ? new THREE.Vector3(0, -Infinity, -1400) : new THREE.Vector3(-175, -Infinity, -150);
  var maxPan = isMapView ? new THREE.Vector3(2700, Infinity, 0) : new THREE.Vector3(300, Infinity, 100);
  var _v = new THREE.Vector3();

  return (
    <MapControls
      ref={ref}
      args={[camera, domElement]}
      panSpeed={1}
      enableRotate={true}
      maxDistance={maxDistance}
      minDistance={minDistance}
      maxPolarAngle={maxPolarAngle}
      minPolarAngle={minPolarAngle}
      zoomToCursor
      makeDefault
      onChange={(e) => {
        const controls = e?.target;
        _v.copy(controls.target);
        controls.target.clamp(minPan, maxPan);
        _v.sub(controls.target);
        camera.position.sub(_v);
      }}
    />
  );
};

export { CameraControls };
