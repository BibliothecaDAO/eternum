import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { getIsBlitz } from "@/ui/constants";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ViewOnMapIcon } from "@/ui/design-system/molecules/view-on-map-icon";
import { SecondaryMenuItems } from "@/ui/features/world";
import { NameChangePopup } from "@/ui/shared";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  configManager,
  deleteEntityNameLocalStorage,
  formatTime,
  getEntityInfo,
  getStructureName,
  setEntityNameLocalStorage,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ClientComponents, ContractAddress, ID, TickIds } from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";
import { Crown, EyeIcon, Landmark, Pencil, Pickaxe, Search, ShieldQuestion, Sparkles, Star, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CapacityInfo } from "./capacity-info";

const slideDown = {
  hidden: { y: "-100%" },
  visible: { y: "0%", transition: { duration: 0.3 } },
};

// use a different icon for each structure depending on their category
const structureIcons: Record<string, JSX.Element> = {
  None: <ShieldQuestion />,
  Realm: <Crown />,
  Bank: <Landmark />,
  Hyperstructure: <Sparkles />,
  FragmentMine: <Pickaxe />,
  ReadOnly: <EyeIcon />,
};

export const TopLeftNavigation = memo(() => {
  const {
    setup,
    account: { account },
  } = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const [structureNameChange, setStructureNameChange] = useState<ComponentValue<
    ClientComponents["Structure"]["schema"]
  > | null>(null);
  const structures = useUIStore((state) => state.playerStructures);

  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("favoriteStructures");
    return saved ? JSON.parse(saved) : [];
  });

  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const entityInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), setup.components, getIsBlitz()),
    [structureEntityId, currentDefaultTick, account.address],
  );

  const selectedStructure = useMemo(() => {
    return { ...entityInfo, isFavorite: favorites.includes(entityInfo.entityId) };
  }, [structureEntityId, favorites, entityInfo]);

  const selectedStructurePosition = useMemo(() => {
    return new Position(selectedStructure?.position || { x: 0, y: 0 }).getNormalized();
  }, [selectedStructure]);

  const structuresWithFavorites = useMemo(() => {
    return structures
      .map((structure) => {
        const { name, originalName } = getStructureName(structure.structure, getIsBlitz());
        return {
          ...structure,
          isFavorite: favorites.includes(structure.entityId),
          name,
          originalName,
        };
      })
      .sort((a, b) => {
        // First sort by favorite status
        const favoriteCompare = Number(b.isFavorite) - Number(a.isFavorite);
        if (favoriteCompare !== 0) return favoriteCompare;
        // Then sort by name
        return a.name.localeCompare(b.name);
      });
  }, [favorites, structures, structureNameChange]);

  const filteredStructures = useMemo(() => {
    if (!searchTerm) return structuresWithFavorites;
    return structuresWithFavorites.filter((structure) =>
      structure.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .includes(
          searchTerm
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, ""),
        ),
    );
  }, [structuresWithFavorites, searchTerm]);
  const toggleFavorite = useCallback((entityId: number) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId];
      localStorage.setItem("favoriteStructures", JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const goToStructure = useGoToStructure();

  const onSelectStructure = useCallback(
    (entityId: ID) => {
      const structurePosition = getComponentValue(
        setup.components.Structure,
        getEntityIdFromKeys([BigInt(entityId)]),
      )?.base;

      if (!structurePosition) return;

      goToStructure(entityId, new Position({ x: structurePosition.coord_x, y: structurePosition.coord_y }), isMapView);
      setSearchTerm(""); // Clear search when structure is selected
    },
    [isMapView, setup.components.Structure],
  );

  const handleNameChange = useCallback((structureEntityId: ID, newName: string) => {
    setEntityNameLocalStorage(structureEntityId, newName);
    setStructureNameChange(null);
  }, []);

  const handleNameDelete = useCallback((structureEntityId: ID) => {
    deleteEntityNameLocalStorage(structureEntityId);
    setStructureNameChange(null);
  }, []);

  const [selectOpen, setSelectOpen] = useState(false);

  // Auto-focus search input when select opens
  useEffect(() => {
    if (selectOpen && searchInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [selectOpen]);

  return (
    <div className="pointer-events-auto w-screen flex justify-between">
      <motion.div
        className="top-left-navigation-selector flex flex-wrap bg-dark-wood panel-wood panel-wood-corners w-full"
        variants={slideDown}
        initial="hidden"
        animate="visible"
      >
        <div className="flex max-w-[150px] w-24 md:min-w-72 text-gold justify-center text-center relative">
          <div className="structure-name-selector self-center flex justify-between w-full">
            {selectedStructure.isMine ? (
              <Select
                value={structureEntityId.toString()}
                onValueChange={(a: string) => {
                  onSelectStructure(ID(a));
                }}
                open={selectOpen}
                onOpenChange={(open) => {
                  setSelectOpen(open);
                  if (!open) {
                    setSearchTerm("");
                  }
                }}
              >
                <SelectTrigger className="truncate">
                  <SelectValue placeholder="Select Structure" />
                </SelectTrigger>
                <SelectContent className=" panel-wood bg-dark-wood -ml-2">
                  <div className="sticky top-0 p-2 bg-dark-wood border-b border-gold/20 z-50">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gold/60" />
                      <input
                        type="text"
                        placeholder="Search structures..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          // Maintain focus after state update
                          requestAnimationFrame(() => {
                            if (searchInputRef.current) {
                              searchInputRef.current.focus();
                            }
                          });
                        }}
                        autoFocus={true}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter" && filteredStructures.length > 0) {
                            onSelectStructure(ID(filteredStructures[0].entityId));
                            // close the select
                            setSelectOpen(false);
                          }
                        }}
                        className="w-full pl-8 pr-3 py-1 bg-brown/20 border border-gold/30 rounded text-sm text-gold placeholder-gold/60 focus:outline-none focus:border-gold/60"
                        onClick={(e) => e.stopPropagation()}
                        ref={searchInputRef}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchTerm("");
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gold/60 hover:text-gold"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {filteredStructures.length === 0 ? (
                    <div className="p-4 text-center text-gold/60 text-sm">
                      {searchTerm ? "No structures found" : "No structures available"}
                    </div>
                  ) : (
                    filteredStructures.map((structure, index) => (
                      <div key={structure.entityId} className="flex flex-row items-center">
                        <button className="p-1" type="button" onClick={() => toggleFavorite(structure.entityId)}>
                          {<Star className={structure.isFavorite ? "h-4 w-4 fill-current" : "h-4 w-4"} />}
                        </button>
                        <button
                          className="p-1"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectOpen(false);
                            setStructureNameChange(structure.structure);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <SelectItem
                          className="flex justify-between"
                          key={structure.entityId}
                          value={structure.entityId?.toString() || ""}
                        >
                          <div className="self-center flex gap-4 text-xl">{structure.name}</div>
                        </SelectItem>
                      </div>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-full px-4 py-2">
                <h5 className="flex items-center gap-4 truncate">
                  <>
                    {!account || account.address === "0x0"
                      ? structureIcons.ReadOnly
                      : selectedStructure.structureCategory
                        ? structureIcons[selectedStructure.structureCategory]
                        : structureIcons.None}
                    <span>
                      {selectedStructure.structure
                        ? getStructureName(selectedStructure.structure, getIsBlitz()).name
                        : ""}
                    </span>
                  </>
                </h5>
              </div>
            )}
          </div>
        </div>
        <div className="flex storage-selector  py-1 flex-col md:flex-row gap-1  ">
          <ViewOnMapIcon
            className={`self-center ${!isMapView ? "opacity-50 pointer-events-none" : ""}`}
            position={new Position(selectedStructurePosition)}
          />
          <CoordinateNavigationInput
            position={new Position(selectedStructurePosition)}
            className={!isMapView ? "opacity-50 pointer-events-none" : ""}
          />
        </div>

        <CapacityInfo
          structureEntityId={structureEntityId}
          className="storage-selector flex flex-col md:flex-row gap-1  self-center"
        />
        <div className="world-navigation-selector text-xs md:text-base flex md:flex-row gap-2 md:gap-2 justify-between p-1 md:px-4 relative ">
          <div className="cycle-selector flex justify-center md:justify-start">
            <TickProgress />
          </div>
          <div className="map-button-selector flex items-center justify-center md:justify-start gap-2 panel-wood-small px-4">
            <span
              onClick={() =>
                goToStructure(
                  structureEntityId,
                  new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                  false,
                )
              }
              className={cn("text-xs", !isMapView && "text-gold font-bold")}
            >
              Local
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isMapView}
                onChange={(e) => {
                  const checked = e.target.checked;
                  goToStructure(
                    structureEntityId,
                    new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                    checked,
                  );
                }}
              />
              <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all bg-gold/30"></div>
            </label>
            <span
              onClick={() =>
                goToStructure(
                  structureEntityId,
                  new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                  true,
                )
              }
              className={cn("text-xs", isMapView && "text-gold font-bold")}
            >
              World
            </span>
          </div>
        </div>

        <SecondaryMenuItems />

        {structureNameChange && selectedStructure.structure && (
          <NameChangePopup
            currentName={getStructureName(structureNameChange, getIsBlitz()).name}
            originalName={getStructureName(structureNameChange, getIsBlitz()).originalName}
            onConfirm={(newName) => handleNameChange(structureNameChange.entity_id, newName)}
            onCancel={() => setStructureNameChange(null)}
            onDelete={() => handleNameDelete(structureNameChange.entity_id)}
          />
        )}
      </motion.div>
    </div>
  );
});

TopLeftNavigation.displayName = "TopLeftNavigation";

export const CircularProgress = ({
  progress,
  size = "sm",
  children,
  className,
  color = "red",
}: {
  progress: number;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  className?: string;
  color?: "red" | "green" | "gold";
}) => {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const strokeWidth = size === "sm" ? 2 : size === "md" ? 3 : 4;
  const radius = size === "sm" ? 12 : size === "md" ? 18 : 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const colorClasses = {
    red: "stroke-red",
    green: "stroke-green",
    gold: "stroke-gold",
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg className="w-full h-full -rotate-90">
        {/* Background circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          className="fill-none stroke-gray-700 opacity-25"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          className={cn("fill-none transition-all duration-300 ease-in-out", colorClasses[color])}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center", textSizeClasses[size])}>{children}</div>
    </div>
  );
};

const ProgressBar = memo(({ progress }: { progress: number }) => {
  return (
    <div className="absolute bottom-0 left-0 h-1 bg-gold to-transparent mx-1" style={{ width: `${progress}%` }}></div>
  );
});

ProgressBar.displayName = "ProgressBar";

const TickProgress = memo(() => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { currentBlockTimestamp } = useBlockTimestamp();

  const cycleTime = configManager.getTick(TickIds.Armies);
  const { play } = useUiSounds(soundSelector.gong);

  const lastProgressRef = useRef(0);

  // Calculate progress once and memoize
  const progress = useMemo(() => {
    const elapsedTime = currentBlockTimestamp % cycleTime;
    return (elapsedTime / cycleTime) * 100;
  }, [currentBlockTimestamp, cycleTime]);

  // Play sound when progress resets
  useEffect(() => {
    if (lastProgressRef.current > progress) {
      play();
    }
    lastProgressRef.current = progress;
  }, [progress, play]);

  // Memoize tooltip content
  const tooltipContent = useMemo(
    () => (
      <div className="whitespace-nowrap pointer-events-none flex flex-col mt-3 mb-3 text-sm capitalize">
        <div>
          A day in Eternum is <span className="font-bold">{formatTime(cycleTime)}</span>
        </div>
        <div>
          Time left until next cycle:{" "}
          <span className="font-bold">{formatTime(cycleTime - (currentBlockTimestamp % cycleTime))}</span>
        </div>
      </div>
    ),
    [cycleTime, currentBlockTimestamp],
  );

  // Handle tooltip visibility
  const handleMouseEnter = useCallback(() => {
    setTooltip({
      position: "bottom",
      content: tooltipContent,
    });
  }, [setTooltip, tooltipContent]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, [setTooltip]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="self-center text-center px-1 py-1 flex gap-1 text-xl items-center"
    >
      <CircularProgress progress={progress} size="sm" color="gold">
        <ResourceIcon withTooltip={false} resource="Timeglass" size="xs" className="self-center" />
      </CircularProgress>
      <span className="text-sm">{progress.toFixed()}%</span>
    </div>
  );
});

const CoordinateNavigationInput = memo(({ position, className = "" }: { position: Position; className?: string }) => {
  const setNavigationTarget = useUIStore((state) => state.setNavigationTarget);
  const [showCoordInput, setShowCoordInput] = useState(false);
  const normalizedPosition = position.getNormalized();
  const [coords, setCoords] = useState({
    x: normalizedPosition.x,
    y: normalizedPosition.y,
  });

  const handleInputChange = (field: "x" | "y", value: string) => {
    // Handle empty input, minus sign, and valid numbers
    if (value === "" || value === "-" || !isNaN(Number(value))) {
      setCoords((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleSubmit = () => {
    setNavigationTarget({
      col: Number(coords.x) || 0,
      row: Number(coords.y) || 0,
    });
    setShowCoordInput(false);
  };

  return (
    <div className={`relative ${className}`}>
      <CircleButton
        image="/image-icons/compass.png"
        size="md"
        className={`${!showCoordInput ? "fill-gold hover:fill-gold/50" : "fill-gold/50"} transition-all duration-300`}
        onClick={() => setShowCoordInput(!showCoordInput)}
      />

      {showCoordInput && (
        <div className="absolute z-50 panel-wood bg-dark-wood p-3 right-0 mt-1 w-40 rounded shadow-lg">
          <div className="flex justify-between mb-2">
            <span className="text-gold text-xs">Enter coordinates</span>
            <X className="w-4 h-4 cursor-pointer hover:text-gold" onClick={() => setShowCoordInput(false)} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <label className="text-gold text-xs">Col:</label>
              <input
                type="text"
                value={coords.x}
                onChange={(e) => handleInputChange("x", e.target.value)}
                className="bg-brown/20 border border-gold/30 rounded w-full px-1 py-0.5 text-xs text-gold"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-gold text-xs">Row:</label>
              <input
                type="text"
                value={coords.y}
                onChange={(e) => handleInputChange("y", e.target.value)}
                className="bg-brown/20 border border-gold/30 rounded w-full px-1 py-0.5 text-xs text-gold"
              />
            </div>
            <Button size="xs" variant="gold" onClick={handleSubmit} className="mt-1 w-full">
              Navigate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

CoordinateNavigationInput.displayName = "CoordinateNavigationInput";
