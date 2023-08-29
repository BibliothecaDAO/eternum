//Camera.tsx
import { MapControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef, useMemo } from "react";
import { Vector3 } from "three";
import useUIStore from "../hooks/store/useUIStore";
import { useControls, button } from "leva";
import * as THREE from "three";
import { useRoute } from "wouter";
import realmsJson from "../geodata/realms.json";
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

  const setCameraPosition = useUIStore((state) => state.setCameraPosition);
  const setCameraTarget = useUIStore((state) => state.setCameraTarget);

  const [isMapView] = useRoute("/map");

  const maxDistance = useMemo(() => {
    return isMapView ? 500 : 3000;
  }, [isMapView]);

  useControls({
    mapView: button(() => {
      const pos = {
        x: -7.043878696238032,
        y: 166.17021444157382,
        z: 222.6600723287719,
      };
      const target = {
        x: 0.023274850081444903,
        y: -0.5977038789716049,
        z: -0.8013790329276046,
      };
      setCameraPosition(pos);
      setCameraTarget(target);
    }),
    realmView: button(() => {
      const pos = {
        x: 399.79750334746063,
        y: 699.249767349755,
        z: 1163.119859554027,
      };
      const target = {
        x: -0.2596104873702977,
        y: -0.5003629837749848,
        z: -0.8259777716834455,
      };
      setCameraPosition(pos);
      setCameraTarget(target);
    }),
    saveCameraPosition: button(() => {
      console.log(
        camera,
        { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        { ...ref.current.target },
      );
    }),
    goToRealm: button(() => {
      const x = realmsJson.features[2442].xy[0] * -1;
      const y = realmsJson.features[2442].xy[1] * -1;
      const targetPos = new THREE.Vector3(x, 0.7, y);
      const cameraPos = new THREE.Vector3(
        x + 25 * (Math.random() < 0.5 ? 1 : -1),
        25,
        y + 25 * (Math.random() < 0.5 ? 1 : -1),
      );
      setCameraPosition(cameraPos);
      setCameraTarget(targetPos);
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
      maxDistance={maxDistance}
      minDistance={25}
      maxPolarAngle={Math.PI / 3}
      makeDefault
    />
  );
};

export { CameraControls };
