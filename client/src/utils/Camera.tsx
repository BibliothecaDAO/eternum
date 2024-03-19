import { MapControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef, useMemo } from "react";
import { Vector3 } from "three";
import { useControls, button } from "leva";
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
    return isMapView ? 100 : 1000;
  }, [isMapView]);

  const maxPolarAngle = useMemo(() => {
    return isMapView ? Math.PI / 3 : Math.PI / 4;
  }, [isMapView]);

  const minPolarAngle = useMemo(() => {
    return isMapView ? Math.PI / 3 : Math.PI / 4;
  }, [isMapView]);

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
      panSpeed={1}
      enableRotate={true}
      maxDistance={maxDistance}
      minDistance={minDistance}
      maxPolarAngle={maxPolarAngle}
      minPolarAngle={minPolarAngle}
      zoomToCursor
      makeDefault
    />
  );
};

export { CameraControls };
