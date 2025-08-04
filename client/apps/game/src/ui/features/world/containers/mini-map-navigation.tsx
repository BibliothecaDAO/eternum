import { ReactComponent as CollapseIcon } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as ExpandIcon } from "@/assets/icons/common/expand.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getIsBlitz } from "@/ui/constants";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { getStructureTypeName } from "@bibliothecadao/eternum";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { Map as MapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Define entity types for the toggle controls
const ENTITY_TOGGLES = (isBlitz: boolean) => [
  { id: "realms", label: getStructureTypeName(StructureType.Realm, isBlitz), imagePath: "/images/labels/realm.png" },
  { id: "armies", label: "Armies", imagePath: "/images/labels/army.png" },
  {
    id: "hyperstructures",
    label: getStructureTypeName(StructureType.Hyperstructure, isBlitz),
    imagePath: "/images/labels/hyperstructure.png",
  },
  ...(!isBlitz
    ? [
        {
          id: "banks",
          label: getStructureTypeName(StructureType.Bank, isBlitz),
          imagePath: `images/resources/${ResourcesIds.Lords}.png`,
        },
      ]
    : []),
  {
    id: "fragmentMines",
    label: getStructureTypeName(StructureType.FragmentMine, isBlitz),
    imagePath: isBlitz ? "/images/labels/essence_rift.png" : "/images/labels/fragment_mine.png",
  },
  ...(!isBlitz ? [{ id: "quests", label: "Quests", imagePath: "/images/labels/quest.png" }] : []),
];

export const MiniMapNavigation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<any>(null);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const showMinimap = useUIStore((state) => state.showMinimap);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [visibilityStates, setVisibilityStates] = useState({
    realms: true,
    armies: true,
    hyperstructures: true,
    banks: true,
    fragmentMines: true,
    quests: true,
  });

  const toggleExpand = () => {
    if (isMinimized) {
      setIsMinimized(false);
    }
    setIsExpanded(!isExpanded);
    setTooltip(null);
  };

  const toggleMinimize = () => {
    if (isExpanded) {
      setIsExpanded(false);
    }
    setIsMinimized(!isMinimized);
    setTooltip(null);

    // Notify minimap instance of minimize state change
    const minimap = (window as any).minimapInstance;
    if (minimap) {
      if (!isMinimized) {
        minimap.setMinimized(true);
      } else {
        minimap.setMinimized(false);
      }
    }
  };

  // Handle screenshot
  const handleScreenshot = () => {
    if (!canvasRef.current) return;

    // Get the minimap instance
    const minimap = (window as any).minimapInstance;
    if (!minimap) return;

    // Allow time for the minimap to update
    setTimeout(() => {
      if (!canvasRef.current) return;

      // Create a temporary link for downloading
      const link = document.createElement("a");
      link.download = `eternum-world-map-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }, 200);
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        let width, height;

        if (isMinimized) {
          width = 40;
          height = 40;
        } else if (isExpanded) {
          width = window.innerWidth;
          height = window.innerHeight;
        } else {
          width = 350;
          height = 175;
        }

        canvasRef.current.width = width;
        canvasRef.current.height = height;

        const resizeEvent = new CustomEvent("canvasResized", {
          detail: {
            width: canvasRef.current.width,
            height: canvasRef.current.height,
          },
        });
        canvasRef.current.dispatchEvent(resizeEvent);
      }
    };

    // Initial size setup
    handleResize();

    // Add resize listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded, isMinimized]);

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
        case "quests":
          minimap.toggleQuests(checked);
          break;
      }
    }
  };

  // Handle clicking on minimized minimap to restore
  const handleMinimizedClick = () => {
    if (isMinimized) {
      toggleMinimize();
    }
  };

  return (
    <div
      className={` z-[1001] self-end text-xxs pointer-events-auto flex flex-col panel-wood relative transition-all duration-300 ${
        isExpanded ? "fixed !w-full !h-full !left-0 !top-10 !scale-[0.85]" : ""
      } ${isMinimized ? "cursor-pointer fixed bottom-2 right-2" : ""}`}
      onClick={isMinimized ? handleMinimizedClick : undefined}
    >
      {showMinimap && (
        <>
          {!isMinimized && (
            <div className="flex flex-wrap p-1 justify-between items-center gap-2 bg-black/70 border-b border-amber-900/50">
              <div className="flex flex-wrap justify-start gap-2">
                {ENTITY_TOGGLES(getIsBlitz()).map((entity) => (
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
                        className="sr-only peer"
                      />
                      <label htmlFor={`toggle-${entity.id}`} className="flex items-center cursor-pointer group">
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

              {/* Control Buttons */}
              <div className="flex items-center gap-2">
                {isExpanded && (
                  <div
                    onClick={handleScreenshot}
                    className="cursor-pointer hover:opacity-80"
                    onMouseEnter={() => setTooltip({ content: "Save World Map", position: "top" })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                    >
                      <path
                        d="M12 16L12 8M12 16L8 12M12 16L16 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3 15L3 16C3 18.2091 4.79086 20 7 20L17 20C19.2091 20 21 18.2091 21 16L21 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
                <div
                  onClick={toggleMinimize}
                  className="cursor-pointer hover:opacity-80"
                  onMouseEnter={() => setTooltip({ content: "Minimize Minimap", position: "top" })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                  >
                    <path
                      d="M6 12L18 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div
                  onClick={toggleExpand}
                  className="cursor-pointer hover:opacity-80"
                  onMouseEnter={() =>
                    setTooltip({ content: isExpanded ? "Collapse Minimap" : "Expand Minimap", position: "top" })
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
                </div>
              </div>
            </div>
          )}

          {isMinimized && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/80 rounded border border-amber-600/50"
              onMouseEnter={() => setTooltip({ content: "Click to restore minimap", position: "top" })}
              onMouseLeave={() => setTooltip(null)}
            >
              <CircleButton
                onClick={handleMinimizedClick}
                size="lg"
                label="Click to restore minimap"
                tooltipLocation="top"
              >
                <MapIcon className="h-6 w-6" />
              </CircleButton>
            </div>
          )}
        </>
      )}

      <canvas
        ref={canvasRef}
        id="minimap"
        className={`${showMinimap ? "block" : "hidden"} ${isMinimized ? "opacity-40 hover:opacity-60" : ""}`}
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          zIndex: 2,
          width: isMinimized ? "40px" : isExpanded ? "100vw" : "350px",
          height: isMinimized ? "40px" : isExpanded ? "100vh" : "175px",
        }}
      />
    </div>
  );
};
