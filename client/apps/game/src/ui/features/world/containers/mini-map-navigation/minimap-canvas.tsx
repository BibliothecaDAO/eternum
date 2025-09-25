import CircleButton from "@/ui/design-system/molecules/circle-button";
import { Map as MapIcon } from "lucide-react";
import type { ForwardedRef } from "react";
import { forwardRef, memo } from "react";

interface MiniMapCanvasProps {
  showMinimap: boolean;
  isMinimized: boolean;
  isExpanded: boolean;
  onRestore: () => void;
  onHover: (content: string) => void;
  onLeave: () => void;
}

const MiniMapCanvasComponent = (
  { showMinimap, isMinimized, isExpanded, onRestore, onHover, onLeave }: MiniMapCanvasProps,
  ref: ForwardedRef<HTMLCanvasElement>,
) => {
  const width = isMinimized ? "40px" : isExpanded ? "100vw" : "350px";
  const height = isMinimized ? "40px" : isExpanded ? "100vh" : "175px";

  return (
    <>
      {isMinimized && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/80 rounded border border-amber-600/50"
          onMouseEnter={() => onHover("Click to restore minimap")}
          onMouseLeave={onLeave}
        >
          <CircleButton onClick={onRestore} size="lg" label="Click to restore minimap" tooltipLocation="top">
            <MapIcon className="h-6 w-6" />
          </CircleButton>
        </div>
      )}
      <canvas
        ref={ref}
        id="minimap"
        className={`${showMinimap ? "block" : "hidden"} ${isMinimized ? "opacity-40 hover:opacity-60" : ""}`}
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          zIndex: 2,
          width,
          height,
        }}
        onClick={isMinimized ? onRestore : undefined}
      />
    </>
  );
};

export const MiniMapCanvas = memo(forwardRef<HTMLCanvasElement, MiniMapCanvasProps>(MiniMapCanvasComponent));

MiniMapCanvas.displayName = "MiniMapCanvas";
