import { useEffect, useState } from "react";
import useUIStore from "../../../hooks/store/useUIStore";

export const Compass = () => {
  const direction = useUIStore((state) => state.compassDirection);

  return (
    <div className="w-full flex items-center">
      <div
        className="relative h-12 w-12 flex outline-1 outline outline-gold items-center justify-center text-gold rounded-full shadow-md border-2 border-black shadow-black/50"
        style={{
          backgroundImage:
            "radial-gradient(50% 50.00% at 50% 0.00%, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0.00) 100%), linear-gradient(180deg, #4B413C 0%, #24130A 100%)",
          transform: `rotate(${direction}deg)`,
        }}
      >
        <div className="absolute h-[15px] border-r-[1px] p-r-[2px] border-gold opacity-50"></div>
        <div className="absolute w-[15px] border-t-[1px] p-t-[2px] border-gold opacity-50"></div>

        <div className="absolute top-[-2px] text-xxs" style={{ transform: `rotate(${direction * -1}deg)` }}>
          N
        </div>
        <div className="absolute right-[2px] text-xxs opacity-80" style={{ transform: `rotate(${direction * -1}deg)` }}>
          E
        </div>
        <div
          className="absolute bottom-[-3px] text-xxs opacity-80"
          style={{ transform: `rotate(${direction * -1}deg)` }}
        >
          S
        </div>
        <div className="absolute left-0 text-xxs opacity-80" style={{ transform: `rotate(${direction * -1}deg)` }}>
          W
        </div>
      </div>
    </div>
  );
};
