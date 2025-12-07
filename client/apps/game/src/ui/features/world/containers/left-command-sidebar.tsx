import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView, RightView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import { Tabs } from "@/ui/design-system/atoms";
import {
  configManager,
  getEntityInfo,
  getIsBlitz,
  getStructureName,
  Position,
  setEntityNameLocalStorage,
} from "@bibliothecadao/eternum";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { ResourceArrivals as AllResourceArrivals, MarketModal } from "@/ui/features/economy/trading";
import { TRANSFER_POPUP_NAME } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { Bridge } from "@/ui/features/infrastructure";
import {
  RealtimeChatShell,
  useRealtimeChatActions,
  useRealtimeChatInitializer,
  useRealtimeConnection,
  useRealtimeChatSelector,
  useRealtimeTotals,
  type InitializeRealtimeClientParams,
} from "@/ui/features/social";
import { StoryEventsChronicles } from "@/ui/features/story-events";
import { construction, military, trade } from "@/ui/features/world";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import {
  STRUCTURE_GROUP_COLORS,
  STRUCTURE_GROUP_CONFIG,
  StructureGroupColor,
  StructureGroupsMap,
  useStructureGroups,
} from "@/ui/features/world/containers/top-header/structure-groups";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import { BaseContainer } from "@/ui/shared/containers/base-container";
import { useComponentValue } from "@dojoengine/react";
import { useDojo, useQuery } from "@bibliothecadao/react";
import {
  ClientComponents,
  ContractAddress,
  ID,
  RealmLevels,
  Structure,
  StructureType,
  getLevelName,
} from "@bibliothecadao/types";
import type { ComponentProps, ReactNode, MouseEvent, KeyboardEvent } from "react";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import {
  Castle,
  Crown,
  Loader2,
  Pencil,
  Pickaxe,
  Sparkles,
  Star,
  Tent,
  ChevronsUp,
  ChevronUp,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import clsx from "clsx";
import { StructureEditPopup } from "@/ui/features/world/components/structure-edit-popup";

type CircleButtonProps = ComponentProps<typeof CircleButton>;

type NavigationItem = {
  id: MenuEnum;
  children?: ReactNode;
} & Pick<
  CircleButtonProps,
  | "active"
  | "className"
  | "disabled"
  | "image"
  | "label"
  | "onClick"
  | "primaryNotification"
  | "secondaryNotification"
  | "size"
  | "tooltipLocation"
>;

type StructureWithMetadata = Structure & {
  displayName: string;
  originalName: string;
  realmLevel: number;
  realmLevelLabel: string | null;
  population: number;
  populationCapacity: number;
  groupColor: StructureGroupColor | null;
  isFavorite: boolean;
  canUpgrade: boolean;
};

type RealmNavigationContext = {
  view: LeftView;
  setView: (view: LeftView) => void;
  setRightView: (view: RightView) => void;
  disableButtons: boolean;
  isRealmOrVillage: boolean;
  arrivedArrivalsNumber: number;
  pendingArrivalsNumber: number;
  toggleModal: (content: ReactNode | null) => void;
  isTradeOpen: boolean;
  isBlitz: boolean;
};

type EconomyNavigationContext = {
  view: LeftView;
  rightView: RightView;
  setRightView: (view: RightView) => void;
  setLeftView: (view: LeftView) => void;
  disableButtons: boolean;
  isBlitz: boolean;
  onOpenTransfer: () => void;
  isTransferOpen: boolean;
};

type LeftPanelHeaderProps = {
  structureEntityId: ID;
  structures: Structure[];
  structureInfo: ReturnType<typeof getEntityInfo> | null;
  onSelectStructure: (entityId: ID) => void;
  isBlitz: boolean;
  components: ClientComponents;
  structureGroups: StructureGroupsMap;
  onRequestNameChange: (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => void;
  nameUpdateVersion: number;
  favorites: number[];
  onToggleFavorite: (entityId: number) => void;
};

const connectionTone = {
  connected: "bg-emerald-400 animate-pulse",
  error: "bg-red-400",
  default: "bg-neutral-500",
} as const;

const getConnectionToneClass = (status: string | undefined) => {
  if (status === "connected") {
    return connectionTone.connected;
  }
  if (status === "error") {
    return connectionTone.error;
  }
  return connectionTone.default;
};

const useRealtimeChatConfig = () => {
  const ConnectedAccount = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);

  const defaultZoneId = "global";
  const zoneIds = useMemo(() => [defaultZoneId], [defaultZoneId]);
  const realtimeBaseUrl = (import.meta.env.VITE_PUBLIC_REALTIME_URL as string | undefined) ?? "";

  const initializer = useMemo<InitializeRealtimeClientParams | null>(() => {
    if (!realtimeBaseUrl) return null;

    const walletAddress = ConnectedAccount?.address ?? undefined;
    const normalizedAccountName = accountName?.trim() ?? "";
    const hasUsername = normalizedAccountName.length > 0;
    const playerId = hasUsername ? normalizedAccountName : (walletAddress ?? "demo-player");
    const displayName = hasUsername ? normalizedAccountName : undefined;

    return {
      baseUrl: realtimeBaseUrl,
      identity: {
        playerId,
        walletAddress,
        displayName,
      },
      queryParams: {
        walletAddress,
        playerName: displayName,
      },
      joinZones: zoneIds,
    };
  }, [ConnectedAccount?.address, accountName, realtimeBaseUrl, zoneIds]);

  return { initializer, defaultZoneId, zoneIds };
};

const DEFAULT_BUTTON_SIZE: CircleButtonProps["size"] = "lg";

const HEADER_HEIGHT = 64;
const PANEL_WIDTH = 420;
const HANDLE_WIDTH = 14;

const LeftPanelHeader = ({
  structureEntityId,
  structures,
  structureInfo,
  onSelectStructure,
  isBlitz,
  components,
  structureGroups,
  onRequestNameChange,
  nameUpdateVersion,
  favorites,
  onToggleFavorite,
}: LeftPanelHeaderProps) => {
  const [activeTab, setActiveTab] = useState(0);

  const structureEntityKey = useMemo(() => {
    try {
      return getEntityIdFromKeys([BigInt(structureEntityId)]);
    } catch {
      return null;
    }
  }, [structureEntityId]);

  const liveStructure = useComponentValue(components.Structure, structureEntityKey as any);
  const liveStructureBuildings = useComponentValue(components.StructureBuildings, structureEntityKey as any);

  const structureTabs = useMemo<Array<{ key: string; label: string; categories: StructureType[]; icon: LucideIcon }>>(
    () => [
      { key: "realms", label: "Realms", categories: [StructureType.Realm], icon: Crown },
      {
        key: "villages",
        label: isBlitz ? "Camps" : "Villages",
        categories: [StructureType.Village],
        icon: isBlitz ? Tent : Castle,
      },
      {
        key: "rifts",
        label: isBlitz ? "Rifts" : "Essence Rifts",
        categories: [StructureType.FragmentMine],
        icon: Pickaxe,
      },
      {
        key: "hyperstructures",
        label: "Hyperstructures",
        categories: [StructureType.Hyperstructure],
        icon: Sparkles,
      },
    ],
    [isBlitz],
  );

  const structuresWithMetadata = useMemo<StructureWithMetadata[]>(() => {
    // Force recomputation when a local rename occurs.
    void nameUpdateVersion;
    return structures.map((structure) => {
      const { name, originalName } = getStructureName(structure.structure, isBlitz);
      const baseLevel = structure.structure.base?.level;
      const normalizedLevel =
        typeof baseLevel === "number" ? baseLevel : typeof baseLevel === "bigint" ? Number(baseLevel) : 0;
      const realmLevelLabel =
        structure.category === StructureType.Realm || structure.category === StructureType.Village
          ? getLevelName(Math.min(Math.max(normalizedLevel, RealmLevels.Settlement), RealmLevels.Empire) as RealmLevels)
          : null;
      const structureEntity = getEntityIdFromKeys([BigInt(structure.entityId)]);
      const structureBuildings = components.StructureBuildings
        ? getComponentValue(components.StructureBuildings, structureEntity)
        : null;
      const population = Number(structureBuildings?.population.current ?? 0);
      const hasBasePopulation =
        structure.category === StructureType.Realm || structure.category === StructureType.Village;
      const basePopulationCapacity = hasBasePopulation ? configManager.getBasePopulationCapacity() : 0;
      const normalizedBasePopulationCapacity = hasBasePopulation ? Math.max(Number(basePopulationCapacity ?? 0), 6) : 0;
      const populationCapacity = Number(structureBuildings?.population.max ?? 0) + normalizedBasePopulationCapacity;
      const groupColor = structureGroups[structure.entityId] ?? null;

      const isFavorite = favorites.includes(structure.entityId);

      return {
        ...structure,
        displayName: name,
        originalName,
        realmLevel: normalizedLevel,
        realmLevelLabel,
        population,
        populationCapacity,
        groupColor,
        isFavorite,
        canUpgrade:
          structure.category === StructureType.Realm &&
          normalizedLevel < configManager.getMaxLevel(structure.category as StructureType),
      };
    });
  }, [structures, isBlitz, components.StructureBuildings, structureGroups, nameUpdateVersion, favorites]);

  const currentTab = structureTabs[activeTab] ?? structureTabs[0];
  const filteredStructures =
    currentTab?.categories?.length === 0
      ? structuresWithMetadata
      : structuresWithMetadata.filter((structure) => currentTab.categories.includes(structure.category));

  const selectedStructureMetadata = structuresWithMetadata.find(
    (structure) => structure.entityId === structureEntityId,
  );
  const selectedGroupColor = selectedStructureMetadata?.groupColor ?? null;
  const selectedGroupConfig = selectedGroupColor ? STRUCTURE_GROUP_CONFIG[selectedGroupColor] : null;
  const normalizedLevelRaw =
    liveStructure?.base?.level ??
    selectedStructureMetadata?.realmLevel ??
    selectedStructureMetadata?.structure.base?.level ??
    0;
  const normalizedLevel =
    typeof normalizedLevelRaw === "bigint" ? Number(normalizedLevelRaw) : Number(normalizedLevelRaw ?? 0);
  const levelLabel =
    selectedStructureMetadata?.category === StructureType.Realm ||
    selectedStructureMetadata?.category === StructureType.Village
      ? getLevelName(Math.min(Math.max(normalizedLevel, RealmLevels.Settlement), RealmLevels.Empire) as RealmLevels)
      : selectedStructureMetadata
        ? `Level ${normalizedLevel}`
        : "Level —";
  const hasBasePopulation =
    selectedStructureMetadata?.category === StructureType.Realm ||
    selectedStructureMetadata?.category === StructureType.Village;
  const basePopulationCapacity = hasBasePopulation ? configManager.getBasePopulationCapacity() : 0;
  const normalizedBasePopulationCapacity = hasBasePopulation ? Math.max(Number(basePopulationCapacity ?? 0), 6) : 0;
  const livePopulation = Number(
    liveStructureBuildings?.population.current ?? selectedStructureMetadata?.population ?? 0,
  );
  const livePopulationCapacity =
    Number(liveStructureBuildings?.population.max ?? selectedStructureMetadata?.populationCapacity ?? 0) +
    normalizedBasePopulationCapacity;
  const populationCapacityLabel = selectedStructureMetadata ? `${livePopulation}/${livePopulationCapacity}` : null;
  const showDetailedStats = Boolean(
    selectedStructureMetadata &&
      (selectedStructureMetadata.category === StructureType.Realm ||
        selectedStructureMetadata.category === StructureType.Village),
  );
  const headerTitle =
    selectedStructureMetadata?.displayName ??
    structureInfo?.name?.name ??
    (structuresWithMetadata.length > 0 ? "Select a structure" : "No structures");
  const ActiveStructureIcon = useMemo<LucideIcon | null>(() => {
    if (!selectedStructureMetadata) {
      return null;
    }
    for (const tab of structureTabs) {
      if (tab.categories.includes(selectedStructureMetadata.category)) {
        return tab.icon;
      }
    }
    return null;
  }, [selectedStructureMetadata, structureTabs]);

  return (
    <div className="border-b border-gold/20 bg-black/60 px-4 py-4 space-y-4">
      <div className="border-b border-gold/20 pb-3">
        <div className="flex items-center gap-2 text-sm text-gold min-w-0">
          {ActiveStructureIcon && (
            <span className={selectedGroupConfig ? selectedGroupConfig.textClass : "text-gold"}>
              <ActiveStructureIcon className="h-5 w-5" />
            </span>
          )}
          {selectedGroupColor && <span className={`h-2 w-2 rounded-full ${selectedGroupConfig?.dotClass ?? ""}`} />}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p
              className={`truncate min-w-0 font-[Cinzel] text-xl sm:text-2xl font-semibold ${
                selectedGroupConfig ? selectedGroupConfig.textClass : "text-gold"
              }`}
              title={headerTitle}
            >
              {headerTitle}
            </p>
            {showDetailedStats && populationCapacityLabel && (
              <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gold/70">
                <span className="text-gold/40">•</span>
                <span>{levelLabel}</span>
                <span className="text-gold/40">•</span>
                <span>{populationCapacityLabel}</span>
              </div>
            )}
          </div>
          {selectedStructureMetadata && (
            <button
              type="button"
              onClick={() => onRequestNameChange(selectedStructureMetadata.structure)}
              className="flex-shrink-0 rounded border border-gold/30 p-1 text-gold/70 hover:bg-gold/10"
              title="Rename structure"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Tabs
          selectedIndex={activeTab}
          onChange={setActiveTab}
          variant="selection"
          size="small"
          className="text-xs text-gold"
        >
          <Tabs.List>
            {structureTabs.map((tab, index) => {
              const Icon = tab.icon;
              const count = structuresWithMetadata.filter((structure) =>
                tab.categories.includes(structure.category),
              ).length;
              const isActiveTab = activeTab === index;
              const isDisabledTab = count === 0 && tab.key !== "realms";
              return (
                <Tabs.Tab
                  key={tab.key}
                  aria-label={tab.label}
                  title={tab.label}
                  disabled={isDisabledTab}
                  className={clsx(
                    "!mx-0 border",
                    isActiveTab
                      ? "border-gold/60 bg-black/40 text-[#f4c24d]"
                      : "border-gold/25 bg-black/20 text-gold/70 hover:border-gold/40 hover:text-gold/90",
                    isDisabledTab && "opacity-60 hover:border-gold/25 hover:text-gold/60",
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className={clsx(
                        "text-[12px] font-semibold transition-none",
                        isActiveTab ? "text-[#f4c24d]" : "text-gold/60",
                        isDisabledTab && "text-gold/40",
                      )}
                    >
                      {count}
                    </span>
                    <Icon
                      className={clsx(
                        "h-4 w-4",
                        isActiveTab ? "text-[#f4c24d]" : "text-gold/60",
                        isDisabledTab && "text-gold/40",
                      )}
                    />
                  </span>
                  <span className="sr-only">{tab.label}</span>
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>

        {filteredStructures.length > 0 ? (
          <div className="max-h-[9.5rem] space-y-2 overflow-y-auto pr-1">
            {[...filteredStructures]
              .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite))
              .map((structure) => (
                <StructureListItem
                  key={structure.entityId}
                  structure={structure}
                  isSelected={structure.entityId === structureEntityId}
                  onSelectStructure={onSelectStructure}
                  onToggleFavorite={onToggleFavorite}
                  onRequestNameChange={onRequestNameChange}
                  structureGroups={structureGroups}
                  components={components}
                />
              ))}
          </div>
        ) : (
          <div className="rounded border border-gold/20 bg-black/30 px-3 py-2 text-xs text-gold/70">
            No structures available for this category.
          </div>
        )}
      </div>
    </div>
  );
};

type StructureListItemProps = {
  structure: StructureWithMetadata;
  isSelected: boolean;
  onSelectStructure: (entityId: ID) => void;
  onToggleFavorite: (entityId: ID) => void;
  onRequestNameChange: (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => void;
  structureGroups: StructureGroupsMap;
  components: ClientComponents;
};

const StructureListItem = ({
  structure,
  isSelected,
  onSelectStructure,
  onToggleFavorite,
  onRequestNameChange,
  structureGroups,
  components,
}: StructureListItemProps) => {
  const entityKey = useMemo(() => {
    try {
      return getEntityIdFromKeys([BigInt(structure.entityId)]);
    } catch {
      return null;
    }
  }, [structure.entityId]);

  const liveStructure = useComponentValue(components.Structure, entityKey as any);
  const liveStructureBuildings = useComponentValue(components.StructureBuildings, entityKey as any);

  const rawLevel = liveStructure?.base?.level ?? structure.structure.base?.level ?? 0;
  const normalizedLevel = typeof rawLevel === "bigint" ? Number(rawLevel) : Number(rawLevel ?? 0);
  const levelLabel =
    structure.category === StructureType.Realm || structure.category === StructureType.Village
      ? getLevelName(Math.min(Math.max(normalizedLevel, RealmLevels.Settlement), RealmLevels.Empire) as RealmLevels)
      : null;

  const hasBasePopulation = structure.category === StructureType.Realm || structure.category === StructureType.Village;
  const basePopulationCapacity = hasBasePopulation ? configManager.getBasePopulationCapacity() : 0;
  const normalizedBasePopulationCapacity = hasBasePopulation ? Math.max(Number(basePopulationCapacity ?? 0), 6) : 0;

  const population = Number(liveStructureBuildings?.population.current ?? structure.population ?? 0);
  const populationCapacity =
    Number(liveStructureBuildings?.population.max ?? structure.populationCapacity ?? 0) +
    normalizedBasePopulationCapacity;

  const showInfoLine = hasBasePopulation;
  const capacityDisplay = `${population}/${populationCapacity}`;
  const infoLineLabel = levelLabel ?? `Level ${normalizedLevel}`;

  const handleSelectStructure = () => onSelectStructure(structure.entityId);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectStructure();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleSelectStructure}
      onKeyDown={handleKeyDown}
      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
        isSelected ? "border-gold bg-black/60" : "border-gold/20 bg-black/20 hover:border-gold/40 hover:bg-black/30"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(structure.entityId);
          }}
          className="rounded border border-transparent p-1 text-gold/60 hover:text-gold"
          title={structure.isFavorite ? "Remove from favorites" : "Favorite structure"}
        >
          <Star className={`h-4 w-4 ${structure.isFavorite ? "fill-current text-gold" : "text-gold/60"}`} />
        </button>
        <div className="flex flex-1 items-center gap-2">
          {structure.groupColor && (
            <span className={`h-2 w-2 rounded-full ${STRUCTURE_GROUP_CONFIG[structure.groupColor]?.dotClass ?? ""}`} />
          )}
          <span
            className={`text-sm font-semibold ${
              structure.groupColor
                ? (STRUCTURE_GROUP_CONFIG[structure.groupColor]?.textClass ?? "text-gold")
                : "text-gold"
            }`}
          >
            {structure.displayName}
          </span>
          {showInfoLine && (
            <span className="text-xxs text-gold/70">
              {infoLineLabel} • {capacityDisplay}
            </span>
          )}
        </div>
        {structure.category === StructureType.Realm && (
          <StructureLevelUpButton structureEntityId={structure.entityId} className="ml-auto" />
        )}
      </div>
    </div>
  );
};

type StructureLevelUpButtonProps = {
  structureEntityId: ID | null;
  className?: string;
};

const StructureLevelUpButton = ({ structureEntityId, className }: StructureLevelUpButtonProps) => {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [hasUpgraded, setHasUpgraded] = useState(false);
  const upgradeInfo = useStructureUpgrade(typeof structureEntityId === "number" ? structureEntityId : null);

  if (!upgradeInfo) {
    return null;
  }

  const currentLevel = upgradeInfo.currentLevel ?? 0;
  const maxLevel = configManager.getMaxLevel(StructureType.Realm);
  const isAtMaxLevel = upgradeInfo.isMaxLevel || currentLevel >= maxLevel;
  const meetsRequirements = (upgradeInfo.missingRequirements?.length ?? 0) === 0;
  const canUpgrade = upgradeInfo.isOwner && !isAtMaxLevel && meetsRequirements;
  const isDisabled = !canUpgrade || isUpgrading || hasUpgraded || isAtMaxLevel;
  const shouldGlow = canUpgrade && !isDisabled;
  const nextLevel = upgradeInfo.nextLevel ?? 0;

  const renderIcon = () => {
    if (isAtMaxLevel) {
      return <ShieldCheck className="h-3.5 w-3.5" />;
    }
    if (nextLevel >= 3) {
      return (
        <span className="relative flex h-4 w-4 items-center justify-center">
          <ChevronUp className="absolute h-3 w-3 -translate-y-[6px]" />
          <ChevronUp className="absolute h-3 w-3" />
          <ChevronUp className="absolute h-3 w-3 translate-y-[6px]" />
        </span>
      );
    }
    if (nextLevel === 2) {
      return <ChevronsUp className="h-3.5 w-3.5" />;
    }
    return <ChevronUp className="h-3.5 w-3.5" />;
  };

  const handleUpgrade = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isDisabled) return;

    setIsUpgrading(true);
    try {
      await upgradeInfo.handleUpgrade();
      setHasUpgraded(true);
    } catch (error) {
      console.error("Failed to upgrade structure", error);
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleUpgrade}
      disabled={isDisabled}
      className={clsx(
        "inline-flex items-center justify-center rounded-md border px-2 py-1 text-xxs font-semibold uppercase tracking-wide transition",
        shouldGlow
          ? "border-gold/60 bg-gold/10 text-gold hover:bg-gold/25 shadow-[0_0_12px_rgba(255,204,102,0.55)] animate-pulse"
          : "border-gold/20 bg-black/30 text-gold/50 cursor-not-allowed",
        className,
      )}
      aria-label="Level up realm"
    >
      {isUpgrading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : renderIcon()}
    </button>
  );
};

const buildRealmNavigationItems = ({
  view,
  setView,
  setRightView,
  disableButtons,
  isRealmOrVillage,
  arrivedArrivalsNumber,
  pendingArrivalsNumber,
  toggleModal,
  isTradeOpen,
  isBlitz,
}: RealmNavigationContext): NavigationItem[] => {
  const toggleView = (targetView: LeftView) => () => {
    setRightView(RightView.None);
    setView(view === targetView ? LeftView.None : targetView);
  };

  const items: NavigationItem[] = [
    {
      id: MenuEnum.entityDetails,
      className: "entity-details-selector",
      image: BuildingThumbs.house,
      tooltipLocation: "top",
      label: "Realm Info",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.EntityView || view === LeftView.None,
      onClick: toggleView(LeftView.EntityView),
    },
    {
      id: MenuEnum.construction,
      className: "construction-selector",
      image: BuildingThumbs.construction,
      tooltipLocation: "top",
      label: construction,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons || !isRealmOrVillage,
      active: view === LeftView.ConstructionView,
      onClick: toggleView(LeftView.ConstructionView),
    },
    {
      id: MenuEnum.military,
      className: "military-selector",
      image: BuildingThumbs.military,
      tooltipLocation: "top",
      label: military,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.MilitaryView,
      onClick: toggleView(LeftView.MilitaryView),
    },
    {
      id: MenuEnum.resourceArrivals,
      image: BuildingThumbs.trade,
      tooltipLocation: "top",
      label: "Resource Arrivals",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.ResourceArrivals,
      onClick: toggleView(LeftView.ResourceArrivals),

      primaryNotification:
        arrivedArrivalsNumber > 0
          ? { value: arrivedArrivalsNumber, color: "green", location: "topright" as const }
          : undefined,
      secondaryNotification:
        pendingArrivalsNumber > 0
          ? { value: pendingArrivalsNumber, color: "orange", location: "bottomright" as const }
          : undefined,
    },
    // {
    //   id: MenuEnum.hyperstructures,
    //   image: BuildingThumbs.hyperstructures,
    //   tooltipLocation: "top",
    //   label: hyperstructures,
    //   size: DEFAULT_BUTTON_SIZE,
    //   disabled: disableButtons,
    //   active: view === LeftView.HyperstructuresView,
    //   onClick: toggleView(LeftView.HyperstructuresView),
    // },
    {
      id: MenuEnum.trade,
      className: "trade-selector",
      image: BuildingThumbs.scale,
      tooltipLocation: "top",
      label: trade,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: isTradeOpen,
      onClick: () => toggleModal(isTradeOpen ? null : <MarketModal />),
    },
    // {
    //   id: MenuEnum.relics,
    //   image: BuildingThumbs.relics,
    //   tooltipLocation: "top",
    //   label: "Relics",
    //   size: DEFAULT_BUTTON_SIZE,
    //   disabled: disableButtons,
    //   active: view === LeftView.RelicsView,
    //   onClick: toggleView(LeftView.RelicsView),
    //   primaryNotification:
    //     availableRelicsNumber > 0
    //       ? { value: availableRelicsNumber, color: "gold", location: "topright" as const }
    //       : undefined,
    // },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.entityDetails,
    MenuEnum.military,
    MenuEnum.construction,
    MenuEnum.hyperstructures,
    MenuEnum.resourceArrivals,
    MenuEnum.relics,
    ...(isBlitz ? [] : [MenuEnum.trade]),
  ];

  return items.filter((item) => allowedMenus.includes(item.id));
};

const buildEconomyNavigationItems = ({
  rightView,
  view,
  setRightView,
  setLeftView,
  disableButtons,
  isBlitz,
  onOpenTransfer,
  isTransferOpen,
}: EconomyNavigationContext): NavigationItem[] => {
  const toggleView = (targetView: RightView) => () => {
    setLeftView(LeftView.None);
    setRightView(rightView === targetView ? RightView.None : targetView);
  };

  const items: NavigationItem[] = [
    {
      id: MenuEnum.transfer,
      className: "transfer-selector",
      image: BuildingThumbs.transfer,
      tooltipLocation: "top",
      label: "Transfers",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: isTransferOpen,
      onClick: () => {
        onOpenTransfer();
      },
    },
    {
      id: MenuEnum.storyEvents,
      className: "story-events-selector",
      image: BuildingThumbs.storyEvents,
      tooltipLocation: "top",
      label: "Activity Chronicles",
      size: DEFAULT_BUTTON_SIZE,
      disabled: false,
      active: view === LeftView.StoryEvents,
      onClick: () => {
        setRightView(RightView.None);
        setLeftView(view === LeftView.StoryEvents ? LeftView.None : LeftView.StoryEvents);
      },
    },
  ];

  const allowedMenus: MenuEnum[] = [MenuEnum.transfer, MenuEnum.storyEvents];

  return items.filter((item) => allowedMenus.includes(item.id));
};

type LeftPanelChatProps = {
  initializer: InitializeRealtimeClientParams | null;
  zoneIds: string[];
  defaultZoneId: string;
};

const LeftPanelChat = ({ initializer, zoneIds, defaultZoneId }: LeftPanelChatProps) => {
  if (!initializer) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-gold/70">
        Chat is unavailable. Check your realtime configuration.
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <RealtimeChatShell
        initializer={initializer}
        zoneIds={zoneIds}
        defaultZoneId={defaultZoneId}
        autoInitializeClient={false}
        displayMode="embedded"
        showInlineToggle={false}
        className="h-full"
      />
    </div>
  );
};

const EntityDetails = lazy(() =>
  import("@/ui/modules/entity-details/entity-details").then((module) => ({ default: module.EntityDetails })),
);
const Military = lazy(() => import("@/ui/features/military").then((module) => ({ default: module.Military })));
const SelectPreviewBuildingMenu = lazy(() =>
  import("@/ui/features/settlement").then((module) => ({
    default: module.SelectPreviewBuildingMenu,
  })),
);
const BlitzHyperstructuresMenu = lazy(() =>
  import("@/ui/features/world").then((module) => ({
    default: module.BlitzHyperstructuresMenu,
  })),
);
const EternumHyperstructuresMenu = lazy(() =>
  import("@/ui/features/world").then((module) => ({
    default: module.EternumHyperstructuresMenu,
  })),
);
// const RelicsModule = lazy(() =>
//   import("@/ui/features/relics").then((module) => ({
//     default: module.RelicsModule,
//   })),
// );
export const LeftCommandSidebar = memo(() => {
  const {
    account: { account },
    setup,
  } = useDojo();
  const components = setup.components;
  const { isMapView } = useQuery();

  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const rightView = useUIStore((state) => state.rightNavigationView);
  const setRightView = useUIStore((state) => state.setRightNavigationView);
  const disableButtons = useUIStore((state) => state.disableButtons);
  const isTradeOpen = useUIStore((state) => state.openedPopups.includes(trade));
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isTransferPopupOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const structures = useUIStore((state) => state.playerStructures);
  const { structureGroups, updateStructureGroup } = useStructureGroups();
  const { favorites, toggleFavorite } = useFavoriteStructures();
  const goToStructure = useGoToStructure(setup);

  const [structureNameChange, setStructureNameChange] = useState<ComponentValue<
    ClientComponents["Structure"]["schema"]
  > | null>(null);
  const [structureNameVersion, setStructureNameVersion] = useState(0);

  const bumpStructureNameVersion = useCallback(() => {
    setStructureNameVersion((version) => version + 1);
  }, []);

  const handleNameChange = useCallback(
    (entityId: ID, newName: string) => {
      setEntityNameLocalStorage(entityId, newName);
      setStructureNameChange(null);
      bumpStructureNameVersion();
    },
    [bumpStructureNameVersion],
  );

  const handleRequestNameChange = useCallback((structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => {
    setStructureNameChange(structure);
  }, []);

  const handleOpenTransferPopup = useCallback(() => {
    setTransferPanelSourceId(null);
    togglePopup(TRANSFER_POPUP_NAME);
  }, [setTransferPanelSourceId, togglePopup]);

  const toggleModal = useUIStore((state) => state.toggleModal);

  const {
    initializer: realtimeInitializer,
    defaultZoneId: chatDefaultZoneId,
    zoneIds: chatZoneIds,
  } = useRealtimeChatConfig();
  useRealtimeChatInitializer(realtimeInitializer);
  const chatActions = useRealtimeChatActions();
  const { connectionStatus } = useRealtimeConnection();
  const { unreadDirectTotal, unreadWorldTotal } = useRealtimeTotals();
  const unreadChatTotal = unreadDirectTotal + unreadWorldTotal;
  const isChatOpen = useRealtimeChatSelector((state) => state.isShellOpen);

  const isBlitz = getIsBlitz();

  const navHeight = `calc(100vh - ${HEADER_HEIGHT}px)`;

  useEffect(() => {
    if (view === LeftView.ChatView) {
      chatActions.setShellOpen(true);
    } else {
      chatActions.setShellOpen(false);
    }
  }, [chatActions, view]);

  const prevChatOpen = useRef(isChatOpen);
  useEffect(() => {
    if (prevChatOpen.current && !isChatOpen && view === LeftView.ChatView) {
      setView(LeftView.None);
    }
    prevChatOpen.current = isChatOpen;
  }, [isChatOpen, setView, view]);

  const structureInfo = useMemo(() => {
    // Include structureNameVersion to refresh cached info when renames happen locally.
    void structureNameVersion;
    return getEntityInfo(structureEntityId, ContractAddress(account.address), components, isBlitz);
  }, [structureEntityId, account.address, components, isBlitz, structureNameVersion]);

  const isRealmOrVillage = useMemo(
    () =>
      Boolean(structureInfo) &&
      (structureInfo?.structureCategory === StructureType.Realm ||
        structureInfo?.structureCategory === StructureType.Village),
    [structureInfo],
  );

  const realmNavigationItems = useMemo(
    () =>
      buildRealmNavigationItems({
        view,
        setView,
        setRightView,
        disableButtons,
        isRealmOrVillage,
        arrivedArrivalsNumber,
        pendingArrivalsNumber,
        toggleModal,
        isTradeOpen,
        isBlitz,
      }),
    [
      view,
      setView,
      setRightView,
      disableButtons,
      isRealmOrVillage,
      arrivedArrivalsNumber,
      pendingArrivalsNumber,
      toggleModal,
      isTradeOpen,
      isBlitz,
    ],
  );

  const economyNavigationItems = useMemo(
    () =>
      buildEconomyNavigationItems({
        rightView,
        view,
        setRightView,
        setLeftView: setView,
        disableButtons,
        isBlitz,
        onOpenTransfer: handleOpenTransferPopup,
        isTransferOpen: isTransferPopupOpen,
      }),
    [rightView, view, setRightView, setView, disableButtons, isBlitz, handleOpenTransferPopup, isTransferPopupOpen],
  );

  const chatNavigationItem = useMemo<NavigationItem>(() => {
    const isActive = view === LeftView.ChatView;
    return {
      id: MenuEnum.chat,
      className: "chat-selector",
      label: "Chat",
      size: DEFAULT_BUTTON_SIZE,
      tooltipLocation: "top",
      disabled: !realtimeInitializer,
      active: isActive,
      onClick: () => {
        setRightView(RightView.None);
        setView(isActive ? LeftView.None : LeftView.ChatView);
      },
      primaryNotification:
        unreadChatTotal > 0
          ? {
              value: unreadChatTotal,
              color: "red",
              location: "topright" as const,
            }
          : undefined,
      children: (
        <div className="relative flex h-full w-full items-center justify-center">
          <MessageCircle className="h-4 w-4 md:h-5 md:w-5" style={{ color: "#996929" }} />
          <span
            className={clsx("absolute bottom-1 right-1 h-2 w-2 rounded-full", getConnectionToneClass(connectionStatus))}
          />
        </div>
      ),
    };
  }, [connectionStatus, realtimeInitializer, setRightView, setView, unreadChatTotal, view]);

  const ConnectedAccount = useAccountStore((state) => state.account);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const computedWidth = isCollapsed ? HANDLE_WIDTH : PANEL_WIDTH + HANDLE_WIDTH;
  const panelHeightStyle = { height: navHeight, maxHeight: navHeight };
  const showEmptyState = false;
  const contentScrollClass = view === LeftView.ChatView ? "overflow-hidden" : "overflow-y-auto";

  const orderedIds: MenuEnum[] = [
    MenuEnum.entityDetails, // Realm Info
    MenuEnum.construction, // Buildings
    MenuEnum.military, // Army
    MenuEnum.resourceArrivals, // Donkey arrivals
    MenuEnum.transfer, // Transfers
    MenuEnum.chat, // Chat
    MenuEnum.storyEvents, // Chronicles
  ];
  const navigationItems = [...realmNavigationItems, chatNavigationItem, ...economyNavigationItems];
  const combinedNavigationItems = orderedIds
    .map((id) => navigationItems.find((item) => item.id === id))
    .filter((item): item is NavigationItem => Boolean(item));
  const structureNameMetadata = structureNameChange ? getStructureName(structureNameChange, isBlitz) : null;
  const editingStructureId = structureNameChange?.entity_id ? Number(structureNameChange.entity_id) : null;

  const handleSelectStructure = useCallback(
    (entityId: ID) => {
      const target = structures.find((structure) => structure.entityId === entityId);
      const coords = target?.structure?.base;

      if (coords && coords.coord_x !== undefined && coords.coord_y !== undefined) {
        const col = Number(coords.coord_x);
        const row = Number(coords.coord_y);

        if (Number.isFinite(col) && Number.isFinite(row)) {
          setSelectedHex({ col, row });
        }

        void goToStructure(entityId, new Position({ x: coords.coord_x, y: coords.coord_y }), isMapView);
        return;
      }

      setStructureEntityId(entityId);
    },
    [structures, goToStructure, isMapView, setStructureEntityId, setSelectedHex],
  );

  return (
    <>
      <div className="pointer-events-none h-full" style={{ ...panelHeightStyle, marginTop: `${HEADER_HEIGHT}px` }}>
        <div className="flex h-full pointer-events-auto" style={{ width: `${computedWidth}px` }}>
          {!isCollapsed && (
            <BaseContainer
              className="pointer-events-auto flex h-full w-full flex-col panel-wood panel-wood-corners overflow-hidden shadow-2xl"
              style={{ ...panelHeightStyle, width: `${PANEL_WIDTH}px` }}
            >
              <LeftPanelHeader
                structureEntityId={structureEntityId}
                structures={structures}
                structureInfo={structureInfo}
                onSelectStructure={handleSelectStructure}
                isBlitz={isBlitz}
                components={components}
                structureGroups={structureGroups}
                onRequestNameChange={handleRequestNameChange}
                nameUpdateVersion={structureNameVersion}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
              <div className="flex-1 overflow-hidden">
                <div className={clsx("h-full pr-1", contentScrollClass)}>
                  <Suspense fallback={<div className="p-8">Loading...</div>}>
                    {view === LeftView.StoryEvents && (
                      <div className="story-events-selector flex h-full flex-col flex-1 overflow-y-auto">
                        <StoryEventsChronicles />
                      </div>
                    )}
                    {view === LeftView.ChatView && (
                      <div className="h-full">
                        <LeftPanelChat
                          initializer={realtimeInitializer}
                          zoneIds={chatZoneIds}
                          defaultZoneId={chatDefaultZoneId}
                        />
                      </div>
                    )}
                    {view !== LeftView.StoryEvents && (view === LeftView.EntityView || view === LeftView.None) && (
                      <EntityDetails />
                    )}
                    {view !== LeftView.StoryEvents && view === LeftView.MilitaryView && (
                      <Military entityId={structureEntityId} />
                    )}
                    {view !== LeftView.StoryEvents && view === LeftView.ConstructionView && (
                      <SelectPreviewBuildingMenu entityId={structureEntityId} />
                    )}
                    {view !== LeftView.StoryEvents &&
                      view === LeftView.HyperstructuresView &&
                      (isBlitz ? <BlitzHyperstructuresMenu /> : <EternumHyperstructuresMenu />)}
                    {view !== LeftView.StoryEvents && view === LeftView.ResourceArrivals && (
                      <AllResourceArrivals hasArrivals={arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0} />
                    )}
                    {rightView === RightView.Bridge && (
                      <div className="bridge-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                        <Bridge structures={structures} />
                      </div>
                    )}
                    {showEmptyState && (
                      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gold/70">
                        Select a module to view details.
                      </div>
                    )}
                    {/* {view === LeftView.RelicsView && <RelicsModule />} */}
                  </Suspense>
                </div>
              </div>
              {ConnectedAccount && combinedNavigationItems.length > 0 && (
                <div className="border-t border-gold/20 bg-black/40 px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {combinedNavigationItems.map((item) => (
                      <CircleButton key={item.id} {...item} />
                    ))}
                  </div>
                </div>
              )}
            </BaseContainer>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="relative flex h-full w-[14px] items-center justify-center bg-black/20 text-gold/60 transition pointer-events-auto hover:bg-gold/20"
            aria-label={isCollapsed ? "Open navigation panel" : "Collapse navigation panel"}
            style={{ width: `${HANDLE_WIDTH}px` }}
          >
            <span className="sr-only">Toggle navigation panel</span>
            <div className="pointer-events-none flex flex-col items-center gap-1">
              <span className="h-12 w-px bg-gold/40" />
              <span className="text-[10px] leading-none">{isCollapsed ? "⟩" : "⟨"}</span>
            </div>
          </button>
        </div>
      </div>
      {structureNameChange && structureNameMetadata && editingStructureId && (
        <StructureEditPopup
          currentName={structureNameMetadata.name}
          originalName={structureNameMetadata.originalName ?? structureNameMetadata.name}
          groupColor={structureGroups[editingStructureId] ?? null}
          onConfirm={(newName) => handleNameChange(editingStructureId, newName)}
          onCancel={() => setStructureNameChange(null)}
          onUpdateColor={(color) => updateStructureGroup(editingStructureId, color)}
        />
      )}
    </>
  );
});

LeftCommandSidebar.displayName = "LeftCommandSidebar";
