import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { NavigateToPositionIcon } from "@/ui/components/military/army-chip";
import Button from "@/ui/elements/button";
import { cn } from "@/ui/elements/lib/utils";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { SecondaryMenuItems } from "@/ui/modules/navigation/secondary-menu-items";
import { getBlockTimestamp } from "@/utils/timestamp";
import { configManager, formatTime, getEntityInfo } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ContractAddress, ID, PlayerStructure, TickIds } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";
import { Crown, EyeIcon, Landmark, Pickaxe, ShieldQuestion, Sparkles, Star } from "lucide-react";
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

export const TopLeftNavigation = memo(({ structures }: { structures: PlayerStructure[] }) => {
  const {
    setup,
    account: { account },
  } = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("favoriteStructures");
    return saved ? JSON.parse(saved) : [];
  });

  const entityInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), setup.components),
    [structureEntityId, currentDefaultTick, account.address],
  );

  const structure = useMemo(() => {
    return { ...entityInfo, isFavorite: favorites.includes(entityInfo.entityId) };
  }, [structureEntityId, favorites, entityInfo]);

  const structurePosition = useMemo(() => {
    return new Position(structure?.position || { x: 0, y: 0 }).getNormalized();
  }, [structure]);

  const structuresWithFavorites = useMemo(() => {
    return structures
      .map((structure) => ({
        ...structure,
        isFavorite: favorites.includes(structure.entityId),
      }))
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
  }, [favorites, structures.length]);

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
    },
    [isMapView, setup.components.Structure],
  );

  return (
    <div className="pointer-events-auto w-screen flex justify-between">
      <motion.div
        className="top-left-navigation-selector flex flex-wrap dark:bg-dark-wood panel-wood panel-wood-corners"
        variants={slideDown}
        initial="hidden"
        animate="visible"
      >
        <div className="flex max-w-[150px] w-24 md:min-w-72 gap-1 text-gold justify-center  text-center  relative">
          <div className="structure-name-selector self-center flex justify-between w-full">
            {structure.isMine ? (
              <Select
                value={structureEntityId.toString()}
                onValueChange={(a: string) => {
                  onSelectStructure(ID(a));
                }}
              >
                <SelectTrigger className="truncate ">
                  <SelectValue placeholder="Select Structure" />
                </SelectTrigger>
                <SelectContent className=" panel-wood dark:bg-dark-wood">
                  {structuresWithFavorites.map((structure, index) => (
                    <div key={index} className="flex flex-row items-center">
                      <button className="p-1" type="button" onClick={() => toggleFavorite(structure.entityId)}>
                        {<Star className={structure.isFavorite ? "h-4 w-4 fill-current" : "h-4 w-4"} />}
                      </button>
                      <SelectItem
                        className="flex justify-between"
                        key={index}
                        value={structure.entityId?.toString() || ""}
                      >
                        <div className="self-center flex gap-4 text-xl">{structure.name}</div>
                      </SelectItem>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-full px-4 py-2">
                <h5 className="flex items-center gap-4 truncate">
                  <>
                    {!account || account.address === "0x0"
                      ? structureIcons.ReadOnly
                      : structure.structureCategory
                        ? structureIcons[structure.structureCategory]
                        : structureIcons.None}
                    <span>{structure.name}</span>
                  </>
                </h5>
              </div>
            )}
          </div>
        </div>
        <CapacityInfo
          structureEntityId={structureEntityId}
          className="storage-selector  py-1 flex flex-col md:flex-row gap-1  "
        />
        <div className="world-navigation-selector  bg-hex-bg text-xs md:text-base flex md:flex-row gap-2 md:gap-4 justify-between p-1 md:px-4 relative ">
          <div className="cycle-selector flex justify-center md:justify-start">
            <TickProgress />
          </div>
          <div className="map-button-selector flex justify-center md:justify-start">
            <Button
              variant="outline"
              size="xs"
              className="self-center"
              onClick={() => {
                if (!isMapView) {
                  goToStructure(
                    structureEntityId,
                    new Position({ x: structurePosition.x, y: structurePosition.y }),
                    true,
                  );
                } else {
                  goToStructure(
                    structureEntityId,
                    new Position({ x: structurePosition.x, y: structurePosition.y }),
                    false,
                  );
                }
              }}
            >
              {isMapView ? "Local" : "World"}
            </Button>
          </div>
          <div className="flex flex-row">
            <div className="flex justify-center md:justify-start items-center gap-1">
              <NavigateToPositionIcon
                className={`h-6 w-6 md:h-8 md:w-8 ${!isMapView ? "opacity-50 pointer-events-none" : ""}`}
                position={new Position(structurePosition)}
              />
              <ViewOnMapIcon
                className={`h-5 w-5 md:h-7 md:w-7 ${!isMapView ? "opacity-50 pointer-events-none" : ""}`}
                position={new Position(structurePosition)}
              />
            </div>
          </div>
        </div>
      </motion.div>
      <div className="relative">
        <SecondaryMenuItems />
      </div>
    </div>
  );
});

TopLeftNavigation.displayName = "TopLeftNavigation";

const CircularProgress = ({
  progress,
  size = "sm",
  children,
  className,
}: {
  progress: number;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  className?: string;
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
          className="fill-none stroke-gold transition-all duration-300 ease-in-out"
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
      <CircularProgress progress={progress} size="sm" className="text-gold">
        <ResourceIcon withTooltip={false} resource="Timeglass" size="xs" className="self-center" />
      </CircularProgress>
      <span className="text-sm">{progress.toFixed()}%</span>
    </div>
  );
});
