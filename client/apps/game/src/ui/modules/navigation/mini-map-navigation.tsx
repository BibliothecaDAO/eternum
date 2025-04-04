import { ReactComponent as CollapseIcon } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as ExpandIcon } from "@/assets/icons/common/expand.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useEffect, useRef, useState } from "react";

// Define entity types for the toggle controls
const ENTITY_TOGGLES = [
  { id: "realms", label: "Realms", imagePath: "/images/labels/realm.png" },
  { id: "armies", label: "Armies", imagePath: "/images/labels/army.png" },
  { id: "hyperstructures", label: "Hyperstructures", imagePath: "/images/labels/hyperstructure.png" },
  { id: "banks", label: "Banks", imagePath: `images/resources/${ResourcesIds.Lords}.png` },
  { id: "fragmentMines", label: "Fragment Mines", imagePath: "/images/labels/fragment_mine.png" },
];

export const MiniMapNavigation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<any>(null);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const showMinimap = useUIStore((state) => state.showMinimap);
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibilityStates, setVisibilityStates] = useState({
    realms: true,
    armies: true,
    hyperstructures: true,
    banks: true,
    fragmentMines: true,
  });

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = isExpanded ? window.innerWidth * 0.6 : 350;
      canvasRef.current.height = isExpanded ? window.innerHeight * 0.6 : 175;

      const resizeEvent = new CustomEvent("canvasResized", {
        detail: {
          width: canvasRef.current.width,
          height: canvasRef.current.height,
        },
      });
      canvasRef.current.dispatchEvent(resizeEvent);
    }
  }, [isExpanded]);

  // Sync with minimap on component mount
  useEffect(() => {
    // Check if minimap is available and sync initial states
    const syncWithMinimap = () => {
      const minimap = (window as any).minimapInstance;
      if (minimap) {
        // Get current visibility states from minimap
        const currentStates = minimap.getVisibilityStates();
        if (currentStates) {
          setVisibilityStates(currentStates);
        }

        // Initial sync of minimap with our component state
        minimap.syncVisibilityStates(visibilityStates);
        return true;
      }
      return false;
    };

    // Try to sync immediately
    let synced = syncWithMinimap();

    // If not immediately available, try again after a short delay
    if (!synced) {
      const interval = setInterval(() => {
        synced = syncWithMinimap();
        if (synced) clearInterval(interval);
      }, 500);

      return () => clearInterval(interval);
    }
  }, []);

  // Handle toggle changes
  const handleToggle = (type: string, checked: boolean) => {
    setVisibilityStates((prev) => ({
      ...prev,
      [type]: checked,
    }));

    // Update minimap visibility if the minimap instance is available
    const minimap = (window as any).minimapInstance;
    if (minimap) {
      switch (type) {
        case "realms":
          minimap.toggleRealms(checked);
          break;
        case "armies":
          minimap.toggleArmies(checked);
          break;
        case "hyperstructures":
          minimap.toggleHyperstructures(checked);
          break;
        case "banks":
          minimap.toggleBanks(checked);
          break;
        case "fragmentMines":
          minimap.toggleFragmentMines(checked);
          break;
      }
    }
  };

  return (
    <div
      className={` z-[1001] text-xxs pointer-events-auto flex flex-col self-end panel-wood panel-wood-corners relative ${
        isExpanded ? "fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !bottom-[unset]" : ""
      }`}
    >
      {/* <EventStream hideChat={false} /> */}
      {showMinimap && (
        <>
          <div className="flex flex-wrap p-1 justify-center gap-2 bg-black/70 border-b border-amber-900/50">
            {ENTITY_TOGGLES.map((entity) => (
              <div
                key={entity.id}
                className="flex items-center gap-1"
                onMouseEnter={() =>
                  setTooltip({
                    content: `Toggle ${entity.label}`,
                    position: "top",
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              >
                <div className="relative inline-block">
                  <input
                    type="checkbox"
                    id={`toggle-${entity.id}`}
                    checked={visibilityStates[entity.id as keyof typeof visibilityStates]}
                    onChange={(e) => handleToggle(entity.id, e.target.checked)}
                    className="sr-only peer" // Hidden but accessible
                  />
                  <label htmlFor={`toggle-${entity.id}`} className="flex items-center cursor-pointer group">
                    {/* Custom checkbox */}
                    <div className="relative w-4 h-4 mr-1.5 bg-gray-900/90 border border-amber-800/90 hover:border-amber-600 rounded-sm overflow-hidden shadow-inner shadow-black/50">
                      {visibilityStates[entity.id as keyof typeof visibilityStates] && (
                        <div className="absolute inset-0 bg-gradient-to-b from-amber-600/80 to-amber-800/90 flex items-center justify-center shadow-md">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#FFF"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3 h-3 drop-shadow-md"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <img
                      src={entity.imagePath}
                      alt={entity.label}
                      className={`w-4 h-4 mr-1 ${visibilityStates[entity.id as keyof typeof visibilityStates] ? "brightness-100" : "brightness-50"}`}
                    />
                    {isExpanded && (
                      <span
                        className={`text-white text-opacity-90 ${visibilityStates[entity.id as keyof typeof visibilityStates] ? "brightness-100" : "brightness-50"}`}
                      >
                        {entity.label}
                      </span>
                    )}
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div onClick={toggleExpand} className="cursor-pointer absolute right-2 top-2 hover:opacity-80 z-10">
            {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
          </div>
        </>
      )}

      <canvas
        ref={canvasRef}
        id="minimap"
        width="350"
        height="175"
        className={`${showMinimap ? "block" : "hidden"}  ${isExpanded ? "" : ""}`}
        style={{
          backgroundColor: isExpanded ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.7)",
          zIndex: 2,
        }}
      />
    </div>
  );
};
