import clsx from "clsx";
import useUIStore from "../hooks/store/useUIStore";

type TooltipProps = {
  className?: string;
};

export const Tooltip = ({ className }: TooltipProps) => {
  const mouseCoords = useUIStore((state) => state.mouseCoords);
  const tooltip = useUIStore((state) => state.tooltip);
  const position = tooltip?.position ? tooltip.position : "top";

  return (
    <>
      {tooltip && tooltip.content && (
        <div
          className={clsx(
            "fixed z-[100] inline-flex opacity-90 text-xxs -translate-x-1/2 p-2 bg-black rounded-md flex-col justify-start items-center text-white",
            position == "top" && "-translate-y-[150%]",
            position == "bottom" && "translate-y-1/2",
            position == "left" && "-translate-x-[110%] -translate-y-1/2",
            className,
          )}
          style={{
            left: `${mouseCoords.x || -500}px`,
            top: `${mouseCoords.y || -500}px`,
          }}
        >
          {tooltip.content}
          <svg
            className={clsx(
              "absolute z-0",
              position == "top" && "bottom-0 translate-y-1/2 -translate-x-1/2 left-1/2 bottom-0",
              position == "bottom" && "top-0 -translate-y-1/2 rotate-180 -translate-x-1/2 left-1/2 bottom-0",
              position == "left" && "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 -rotate-90",
            )}
            width="26"
            height="18"
            viewBox="0 0 26 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.6931 16.2253C11.8927 17.6681 14.1074 17.6681 15.3069 16.2253L24.4998 5.1679C26.1248 3.21329 24.7348 0.25 22.1929 0.25H3.80708C1.26518 0.25 -0.124826 3.21329 1.50021 5.1679L10.6931 16.2253Z"
              fill="#000"
            />
          </svg>
        </div>
      )}
    </>
  );
};
