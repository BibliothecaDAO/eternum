import { useUIStore } from "@/hooks/store/use-ui-store";
import { getIsBlitz } from "@bibliothecadao/eternum";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INITIAL_VISIBILITY_STATE,
  buildToggleConfig,
  type MiniMapToggleKey,
  type VisibilityState,
} from "./config";
import { MiniMapControlPanel } from "./control-panel";
import { MiniMapCanvas } from "./minimap-canvas";
import { MiniMapToggleList } from "./toggle-list";

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

export const MiniMapNavigation = () => {
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
  }, [isExpanded, isMinimized]);

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
      className={` z-[1001] self-end text-xxs pointer-events-auto flex flex-col panel-wood relative transition-all duration-300 ${
        isExpanded ? "fixed !w-full !h-full !left-0 !top-10 !scale-[0.85]" : ""
      } ${isMinimized ? "cursor-pointer fixed bottom-2 right-2" : ""}`}
    >
      {showMinimap && !isMinimized && (
        <div className="flex flex-wrap p-1 justify-between items-center gap-2 bg-black/70 border-b border-amber-900/50">
          <MiniMapToggleList
            toggles={toggleConfigs}
            visibility={visibilityStates}
            isExpanded={isExpanded}
            onToggle={handleToggle}
            onHover={showTooltip}
            onLeave={hideTooltip}
          />
          <MiniMapControlPanel
            isExpanded={isExpanded}
            onMinimize={toggleMinimize}
            onToggleExpand={toggleExpand}
            onScreenshot={handleScreenshot}
            onHover={showTooltip}
            onLeave={hideTooltip}
          />
        </div>
      )}

      <MiniMapCanvas
        ref={canvasRef}
        showMinimap={showMinimap}
        isMinimized={isMinimized}
        isExpanded={isExpanded}
        onRestore={toggleMinimize}
        onHover={showTooltip}
        onLeave={hideTooltip}
      />
    </div>
  );
};
