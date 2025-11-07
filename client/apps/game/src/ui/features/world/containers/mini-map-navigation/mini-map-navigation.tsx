import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { getIsBlitz } from "@bibliothecadao/eternum";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INITIAL_VISIBILITY_STATE, buildToggleConfig, type MiniMapToggleKey, type VisibilityState } from "./config";
import { MiniMapControlPanel } from "./control-panel";
import { MiniMapCanvas } from "./minimap-canvas";
import { MiniMapToggleList } from "./toggle-list";

interface MiniMapNavigationProps {
  variant?: "floating" | "embedded";
  className?: string;
}

interface MiniMapInstance {
  setMinimized?: (minimized: boolean) => void;
  getVisibilityStates?: () => Partial<VisibilityState>;
  syncVisibilityStates?: (state: VisibilityState) => void;
  toggleRealms?: (checked: boolean) => void;
  toggleArmies?: (checked: boolean) => void;
  toggleHyperstructures?: (checked: boolean) => void;
  toggleBanks?: (checked: boolean) => void;
  toggleFragmentMines?: (checked: boolean) => void;
  toggleQuests?: (checked: boolean) => void;
  resetToCameraCenter?: () => void;
}

const getMinimap = (): MiniMapInstance | undefined => (window as { minimapInstance?: MiniMapInstance }).minimapInstance;

const MINIMAP_ACTIONS: Record<MiniMapToggleKey, (minimap: MiniMapInstance, checked: boolean) => void> = {
  realms: (minimap, checked) => minimap.toggleRealms?.(checked),
  armies: (minimap, checked) => minimap.toggleArmies?.(checked),
  hyperstructures: (minimap, checked) => minimap.toggleHyperstructures?.(checked),
  banks: (minimap, checked) => minimap.toggleBanks?.(checked),
  fragmentMines: (minimap, checked) => minimap.toggleFragmentMines?.(checked),
  quests: (minimap, checked) => minimap.toggleQuests?.(checked),
};

export const MiniMapNavigation = ({ variant = "floating", className }: MiniMapNavigationProps = {}) => {
  const isEmbedded = variant === "embedded";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setTooltip = useUIStore((state) => state.setTooltip);
  const showMinimap = useUIStore((state) => state.showMinimap);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [visibilityStates, setVisibilityStates] = useState<VisibilityState>({ ...INITIAL_VISIBILITY_STATE });

  const isBlitz = getIsBlitz();
  const toggleConfigs = useMemo(() => buildToggleConfig(isBlitz), [isBlitz]);

  const showTooltip = useCallback(
    (content: string) => {
      setTooltip({ content, position: "top" });
    },
    [setTooltip],
  );

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, [setTooltip]);

  const handleScreenshot = useCallback(() => {
    const minimap = getMinimap();
    if (!canvasRef.current || !minimap) return;

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const link = document.createElement("a");
      link.download = `eternum-world-map-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }, 200);
  }, []);

  const toggleExpand = useCallback(() => {
    if (isMinimized) {
      setIsMinimized(false);
    }
    setIsExpanded((prev) => !prev);
    hideTooltip();
  }, [isMinimized, hideTooltip]);

  const toggleMinimize = useCallback(() => {
    if (isExpanded) {
      setIsExpanded(false);
    }

    setIsMinimized((prev) => {
      const next = !prev;
      const minimap = getMinimap();
      minimap?.setMinimized?.(next);
      return next;
    });
    hideTooltip();
  }, [isExpanded, hideTooltip]);

  const handleCenter = useCallback(() => {
    const minimap = getMinimap();
    minimap?.resetToCameraCenter?.();
    hideTooltip();
  }, [hideTooltip]);

  const handleToggle = useCallback((type: MiniMapToggleKey, checked: boolean) => {
    setVisibilityStates((prev) => ({
      ...prev,
      [type]: checked,
    }));

    const minimap = getMinimap();
    if (minimap) {
      MINIMAP_ACTIONS[type]?.(minimap, checked);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (isMinimized) {
        canvas.width = 40;
        canvas.height = 40;
      } else if (isExpanded) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } else if (isEmbedded) {
        const parent = canvas.parentElement;
        const width = parent?.clientWidth ?? 350;
        const height = parent?.clientHeight ?? 200;
        canvas.width = width;
        canvas.height = height;
      } else {
        canvas.width = 350;
        canvas.height = 175;
      }

      const resizeEvent = new CustomEvent("canvasResized", {
        detail: {
          width: canvas.width,
          height: canvas.height,
        },
      });

      canvas.dispatchEvent(resizeEvent);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [isEmbedded, isExpanded, isMinimized]);

  useEffect(() => {
    const syncWithMinimap = () => {
      const minimap = getMinimap();
      if (!minimap) return false;

      const currentStates = minimap.getVisibilityStates?.();
      const mergedStates: VisibilityState = currentStates
        ? { ...INITIAL_VISIBILITY_STATE, ...currentStates }
        : INITIAL_VISIBILITY_STATE;

      setVisibilityStates(mergedStates);
      minimap.syncVisibilityStates?.(mergedStates);
      return true;
    };

    let synced = syncWithMinimap();

    if (!synced) {
      const interval = setInterval(() => {
        synced = syncWithMinimap();
        if (synced) {
          clearInterval(interval);
        }
      }, 500);

      return () => clearInterval(interval);
    }

    return undefined;
  }, []);

  return (
    <div
      className={cn(
        isEmbedded
          ? "flex h-full min-h-0 flex-col gap-2 text-xxs pointer-events-auto"
          : "z-[1001] self-start text-xxs pointer-events-auto flex flex-col panel-wood relative transition-all duration-300",
        isExpanded ? "fixed !w-full !h-full !left-0 !top-10 !scale-[0.85]" : undefined,
        isMinimized ? (isEmbedded ? "cursor-pointer" : "cursor-pointer fixed bottom-2 left-2") : undefined,
        className,
      )}
    >
      {showMinimap && !isMinimized && (
        <div
          className={cn(
            "flex items-center justify-between gap-2",
            isEmbedded ? "pb-2" : "rounded-xl border border-white/10 bg-black/50 px-2 py-2",
          )}
        >
          <div className="flex w-1/2 min-w-0 max-w-full justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide">
            <MiniMapToggleList
              toggles={toggleConfigs}
              visibility={visibilityStates}
              isExpanded={isExpanded}
              onToggle={handleToggle}
              onHover={showTooltip}
              onLeave={hideTooltip}
            />
          </div>
          <div className="flex w-1/2 justify-end">
            <MiniMapControlPanel
              isExpanded={isExpanded}
              onCenter={handleCenter}
              onMinimize={toggleMinimize}
              onToggleExpand={toggleExpand}
              onScreenshot={handleScreenshot}
              onHover={showTooltip}
              onLeave={hideTooltip}
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <MiniMapCanvas
          ref={canvasRef}
          showMinimap={showMinimap}
          isMinimized={isMinimized}
          isExpanded={isExpanded}
          onRestore={toggleMinimize}
          onHover={showTooltip}
          onLeave={hideTooltip}
          mode={variant}
        />
      </div>
    </div>
  );
};
