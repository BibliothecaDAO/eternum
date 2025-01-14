import clsx from "clsx";
import throttle from "lodash/throttle";
import React, { useEffect, useRef } from "react";

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

  useEffect(() => {
    const setTooltipPosition = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.left = `${e.clientX}px`;
        ref.current.style.top = `${e.clientY}px`;
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
      className={clsx("min-w-[215px] ml-3 mt-3 rounded-xl relative p-2 bg-brown/90 text-gold", position, className, {
        hidden: !visible,
      })}
    >
      {children}
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
    </div>
  );
};
