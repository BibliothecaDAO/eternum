import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";

const FPSLimiter = ({ children }: { children: any }) => {
  const invalidate = useThree((state) => state.invalidate);
  const clock = useMemo(() => new THREE.Clock(), []);
  const [fps, setFps] = useState(60);

  useEffect(() => {
    navigator?.getBattery().then(function (battery) {
      if (battery.charging && battery.chargingTime === 0) {
        setFps(60);
      } else {
        setFps(30);
      }
    });
  }, []);

  useEffect(() => {
    let rq: any = null;
    let delta = 0;
    const interval = 1 / fps;
    const update = () => {
      rq = requestAnimationFrame(update);
      delta += clock.getDelta();

      if (delta > interval) {
        invalidate();
        delta = delta % interval;
      }
    };

    update();
    return () => cancelAnimationFrame(rq);
  }, [fps]);

  return <>{children}</>;
};

export default FPSLimiter;
