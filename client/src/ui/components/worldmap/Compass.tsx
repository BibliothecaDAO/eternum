import { useEffect, useState } from "react";
import useUIStore from "../../../hooks/store/useUIStore";

export const Compass = () => {
  const cameraPosition = useUIStore((state) => state.cameraPosition);
  const cameraTarget = useUIStore((state) => state.cameraTarget);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
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

    setDirection(correctedDirection);
  }, [cameraPosition, cameraTarget]);

  return (
    <div className="w-full flex items-center">
      <div className="relative h-12 w-12 flex outline-1 outline outline-gold items-center justify-center text-gold rounded-full shadow-md border-2 border-black shadow-black/50"
        style={{
          backgroundImage:
            "radial-gradient(50% 50.00% at 50% 0.00%, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0.00) 100%), linear-gradient(180deg, #4B413C 0%, #24130A 100%)",
          transform: `rotate(${direction}deg)`
        }}
      >

        <div className="absolute h-[15px] border-r-[1px] p-r-[2px] border-gold opacity-50"></div>
        <div className="absolute w-[15px] border-t-[1px] p-t-[2px] border-gold opacity-50"></div>

        <div className="absolute top-[-2px] text-xxs" style={{ transform: `rotate(-${direction}deg)` }}>N</div>
        <div className="absolute right-[2px] text-xxs opacity-80" style={{ transform: `rotate(-${direction}deg)` }}>E</div>
        <div className="absolute bottom-[-3px] text-xxs opacity-80" style={{ transform: `rotate(-${direction}deg)` }}>S</div>
        <div className="absolute left-0 text-xxs opacity-80" style={{ transform: `rotate(-${direction}deg)` }}>W</div>

      </div>
    </div>
  );
};