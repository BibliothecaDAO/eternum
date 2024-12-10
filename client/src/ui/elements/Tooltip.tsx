import clsx from "clsx";
import throttle from "lodash/throttle";
import { useEffect, useRef } from "react";
import useUIStore from "../../hooks/store/useUIStore";

type TooltipProps = {
  className?: string;
};

export const Tooltip = ({ className }: TooltipProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const tooltip = useUIStore((state) => state.tooltip);
  const position = tooltip?.position ? tooltip.position : "top";

  useEffect(() => {
    if (tooltip?.fixed) return;

    const mouseMoveHandler = throttle((e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.left = `${e.clientX}px`;
        ref.current.style.top = `${e.clientY}px`;
      }
    }, 10); // Throttling the event handler to execute once every 10ms
    document.getElementById("world")?.addEventListener("mousemove", mouseMoveHandler);
    document.body.addEventListener("mousemove", mouseMoveHandler);
    return () => {
      document.getElementById("world")?.removeEventListener("mousemove", mouseMoveHandler);
      document.body.removeEventListener("mousemove", mouseMoveHandler);
      mouseMoveHandler.cancel(); // Cancel any trailing invocation of the throttled function
    };
  }, [tooltip?.fixed]);

  return (
    <>
      {tooltip && tooltip.content && (
        <div
          ref={ref}
          style={tooltip.fixed ? { left: tooltip.fixed.x, top: tooltip.fixed.y } : undefined}
          className={clsx(
            "fixed z-[250] inline-flex border-gradient border text-xxs px-4 py-1 bg-brown/90 flex-col justify-start items-center text-gold leading-loose shadow-3xl",
            !tooltip.fixed && "-translate-x-1/2",
            position == "top" && !tooltip.fixed && "-translate-y-[110%]",
            position == "bottom" && !tooltip.fixed && "translate-y-[70%]",
            position == "left" && !tooltip.fixed && "-translate-x-[110%] -translate-y-1/2",
            position == "right" && !tooltip.fixed && "translate-x-[30%] -translate-y-1/2",
            className,
          )}
        >
          {tooltip.content}
          <svg
            className={clsx(
              "absolute z-0",
              position == "top" && "bottom-0 translate-y-1/2 -translate-x-1/2 left-1/2",
              position == "bottom" && "top-0 -translate-y-1/2 rotate-180 -translate-x-1/2 left-1/2 bottom-0",
              position == "left" && "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 -rotate-90",
              position == "right" && "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rotate-90",
            )}
            width="26"
            height="18"
            viewBox="0 0 26 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.6931 16.2253C11.8927 17.6681 14.1074 17.6681 15.3069 16.2253L24.4998 5.1679C26.1248 3.21329 24.7348 0.25 22.1929 0.25H3.80708C1.26518 0.25 -0.124826 3.21329 1.50021 5.1679L10.6931 16.2253Z"
              fill="fill-brown"
            />
          </svg>
        </div>
      )}
    </>
  );
};
