import clsx from "clsx";
import throttle from "lodash/throttle";
import React, { useEffect, useRef, useState } from "react";

type BaseThreeTooltipProps = {
  children?: React.ReactNode;
  position?: Position;
  className?: string;
  visible?: boolean;
};

export enum Position {
  CLEAN = "",
  CENTER = "-left-1/2 -mt-[150px]",
}

export const BaseThreeTooltip = ({
  children,
  position = Position.CENTER,
  className,
  visible = true,
}: BaseThreeTooltipProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isAboveMouse, setIsAboveMouse] = useState(false);

  useEffect(() => {
    const setTooltipPosition = (e: MouseEvent) => {
      if (ref.current) {
        const isInTopHalf = e.clientY < window.innerHeight / 2;
        const tooltipHeight = ref.current.offsetHeight || 100; // fallback height
        const offsetDistance = 15; // distance from cursor

        if (isInTopHalf) {
          // Show tooltip below the mouse (cursor in top half)
          ref.current.style.left = `${e.clientX}px`;
          ref.current.style.top = `${e.clientY + offsetDistance}px`;
          setIsAboveMouse(false);
        } else {
          // Show tooltip above the mouse (cursor in bottom half)
          ref.current.style.left = `${e.clientX}px`;
          ref.current.style.top = `${e.clientY - tooltipHeight - offsetDistance}px`;
          setIsAboveMouse(true);
        }
      }
    };

    const throttledSetTooltipPosition = throttle(setTooltipPosition, 10);

    const initializeTooltipPosition = () => {
      // todo: refactor when we have initial mouse position when componenent is rendered
      const initialMousePosition = {
        clientX: -10000,
        clientY: -10000,
      };
      setTooltipPosition(initialMousePosition as MouseEvent);
      document.addEventListener("mousemove", throttledSetTooltipPosition);
    };

    initializeTooltipPosition();

    return () => {
      document.removeEventListener("mousemove", throttledSetTooltipPosition);
      throttledSetTooltipPosition.cancel();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={clsx(
        "min-w-[215px] z-50 isolate ml-3 mt-3 p-1 rounded-xl relative bg-brown/90 panel-wood",
        position,
        className,
        {
          hidden: !visible,
        },
      )}
    >
      {children}
      {/* Arrow pointing down (when tooltip is above mouse) */}
      {isAboveMouse && (
        <svg
          className="absolute top-[1px] -translate-y-full left-1/2 -translate-x-1/2"
          width="30"
          height="13"
          viewBox="0 0 30 13"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M15.0003 0.25L29.249 13L0.751603 13L15.0003 0.25Z" fill="fill-dark-brown" />
        </svg>
      )}
      {/* Arrow pointing up (when tooltip is below mouse) */}
      {!isAboveMouse && (
        <svg
          className="absolute bottom-[1px] translate-y-full left-1/2 -translate-x-1/2"
          width="30"
          height="13"
          viewBox="0 0 30 13"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M15.0003 12.75L0.751603 -3.445e-06L29.249 9.53674e-07L15.0003 12.75Z" fill="fill-dark-brown" />
        </svg>
      )}
    </div>
  );
};
