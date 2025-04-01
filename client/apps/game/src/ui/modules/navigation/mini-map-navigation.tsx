import { ReactComponent as CollapseIcon } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as ExpandIcon } from "@/assets/icons/common/expand.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
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
      className={` z-[1001] text-xxs pointer-events-auto flex flex-col self-end panel-wood relative ${
        isExpanded ? "fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !bottom-[unset]" : ""
      }`}
    >
      {/* <EventStream hideChat={false} /> */}
      {showMinimap && (
        <div onClick={toggleExpand} className="cursor-pointer absolute right-2 top-2 hover:opacity-80 z-10">
          {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
        </div>
      )}

      <canvas
        ref={canvasRef}
        id="minimap"
        width="300"
        height="152"
        className={`${showMinimap ? "block" : "hidden"}  ${isExpanded ? "" : ""}`}
        style={{
          backgroundColor: isExpanded ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.3)",
          zIndex: 2,
        }}
      />
    </div>
  );
};
