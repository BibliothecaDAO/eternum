//Camera.tsx
import { MapControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef, useMemo } from "react";
import { Vector3 } from "three";
import { useControls, button } from "leva";
import * as THREE from "three";
import { useRoute } from "wouter";
import { soundSelector, useUiSounds } from "../hooks/useUISound";

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

  const maxDistance = useMemo(() => {
    return isMapView ? 1000 : 1800;
  }, [isMapView]);

  const minDistance = useMemo(() => {
    return isMapView ? 40 : 1000;
  }, [isMapView]);

  var minPan = isMapView ? new THREE.Vector3(0, -Infinity, -1300) : new THREE.Vector3(-175, -Infinity, -150);
  var maxPan = isMapView ? new THREE.Vector3(1500, Infinity, -80) : new THREE.Vector3(300, Infinity, 100);
  var _v = new THREE.Vector3();

  useControls({
    saveCameraPosition: button(() => {
      console.log(
        camera,
        { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        { ...ref.current.target },
      );
    }),
  });

  const { play: playFly } = useUiSounds(soundSelector.fly);

  camera.up = new Vector3(0, 1, 0);
  function cameraAnimate(): void {
    if (ref.current) {
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

  return (
    <MapControls
      ref={ref}
      args={[camera, domElement]}
      panSpeed={2}
      // enableRotate={!isMapView} // Disable rotation
      enableRotate={true} // Disable rotation
      // maxDistance={maxDistance}
      // minDistance={minDistance}
      // maxPolarAngle={Math.PI / 3}
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
