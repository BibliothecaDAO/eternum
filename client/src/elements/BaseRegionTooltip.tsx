import React from "react";
import { Html } from "@react-three/drei";

type BaseRegionTooltipProps = {
  children?: React.ReactNode;
  position: [number, number, number];
  distanceFactor: number;
};

export const BaseRegionTooltip = ({ position, distanceFactor, children }: BaseRegionTooltipProps) => {
  return (
    <Html position={position} distanceFactor={distanceFactor}>
      <div className="border min-w-[215px] relative border-gold p-2 rounded-xl bg-gray text-white">
        {children}
        <svg
          className="absolute bottom-[1px] translate-y-full left-1/2 -translate-x-1/2"
          width="30"
          height="13"
          viewBox="0 0 30 13"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M15.0003 12.75L0.751603 -3.445e-06L29.249 9.53674e-07L15.0003 12.75Z" fill="#1B1B1B" />
        </svg>
      </div>
    </Html>
  );
};
