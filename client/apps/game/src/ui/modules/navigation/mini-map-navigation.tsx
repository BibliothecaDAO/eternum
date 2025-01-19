import { ReactComponent as CollapseIcon } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as ExpandIcon } from "@/assets/icons/common/expand.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

export const MiniMapNavigation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const showMinimap = useUIStore((state) => state.showMinimap);
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = isExpanded ? window.innerWidth * 0.6 : 300;
      canvasRef.current.height = isExpanded ? window.innerHeight * 0.6 : 152;

      const resizeEvent = new CustomEvent("canvasResized", {
        detail: {
          width: canvasRef.current.width,
          height: canvasRef.current.height,
        },
      });
      canvasRef.current.dispatchEvent(resizeEvent);
    }
  }, [isExpanded]);

  return (
    <div
      className={`bottom-[10px] left-[10px] z-[1001] text-xxs pointer-events-auto flex flex-col self-end ${
        isExpanded ? "fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !bottom-[unset]" : ""
      }`}
    >
      <div className={clsx("flex justify-between ml-auto w-full", isExpanded ? "bg-black/90 p-2 rounded-lg mb-1" : "")}>
        {showMinimap && (
          <>
            <div>Minimap</div>
            <div onClick={toggleExpand}>
              {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
            </div>
          </>
        )}
      </div>

      <canvas
        ref={canvasRef}
        id="minimap"
        width="300"
        height="152"
        className={`${showMinimap ? "block" : "hidden"} border border-gold/30 bg-hex-bg ${
          isExpanded ? "rounded-xl" : "rounded-tr-xl "
        }`}
        style={{
          backgroundColor: isExpanded ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.3)",
          zIndex: 2,
        }}
      />
    </div>
  );
};
