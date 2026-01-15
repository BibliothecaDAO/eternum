import CircleButton from "@/ui/design-system/molecules/circle-button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
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
  mode?: "floating" | "embedded";
}

const MiniMapCanvasComponent = (
  { showMinimap, isMinimized, isExpanded, onRestore, onHover, onLeave, mode = "floating" }: MiniMapCanvasProps,
  ref: ForwardedRef<HTMLCanvasElement>,
) => {
  const isEmbedded = mode === "embedded";
  const size = isMinimized ? "40px" : isExpanded ? "min(100vw, 100vh)" : isEmbedded ? "100%" : "350px";
  const width = size;
  const height = size;

  return (
    <>
      {isMinimized && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded border border-amber-600/50 bg-black/80"
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
        className={cn(
          showMinimap ? "block" : "hidden",
          isMinimized ? "opacity-40 hover:opacity-60" : undefined,
          isEmbedded ? "h-full w-full rounded-xl border border-white/10" : undefined,
          isEmbedded ? "aspect-square" : undefined,
        )}
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          zIndex: 2,
          width,
          height,
          aspectRatio: isEmbedded ? "1 / 1" : undefined,
        }}
        onClick={isMinimized ? onRestore : undefined}
      />
    </>
  );
};

export const MiniMapCanvas = memo(forwardRef<HTMLCanvasElement, MiniMapCanvasProps>(MiniMapCanvasComponent));

MiniMapCanvas.displayName = "MiniMapCanvas";
