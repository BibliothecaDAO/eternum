import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView, RightView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import Button from "@/ui/design-system/atoms/button";
import { Tabs } from "@/ui/design-system/atoms";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { configManager, getEntityInfo, getIsBlitz, getStructureName, setEntityNameLocalStorage } from "@bibliothecadao/eternum";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { ResourceArrivals as AllResourceArrivals, MarketModal } from "@/ui/features/economy/trading";
import { TransferAutomationPanel } from "@/ui/features/economy/transfers/transfer-automation-panel";
import { Bridge } from "@/ui/features/infrastructure";
import { ProductionOverviewPanel } from "@/ui/features/settlement/production/production-overview-panel";
import { StoryEventsChronicles } from "@/ui/features/story-events";
import { construction, military, trade } from "@/ui/features/world";
import {
  STRUCTURE_GROUP_COLORS,
  STRUCTURE_GROUP_CONFIG,
  StructureGroupColor,
  StructureGroupsMap,
  useStructureGroups,
} from "@/ui/features/world/containers/top-left-navigation/structure-groups";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-left-navigation/favorites";
import { BaseContainer } from "@/ui/shared/containers/base-container";
import { useDojo } from "@bibliothecadao/react";
import { ClientComponents, ContractAddress, ID, RealmLevels, Structure, StructureType, getLevelName } from "@bibliothecadao/types";
import type { ComponentProps, ReactNode } from "react";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Castle, Crown, Pencil, Pickaxe, Sparkles, Star, Tent } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";

type CircleButtonProps = ComponentProps<typeof CircleButton>;

type NavigationItem = {
  id: MenuEnum;
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
  rightView: RightView;
  setRightView: (view: RightView) => void;
  setLeftView: (view: LeftView) => void;
  disableButtons: boolean;
  isBlitz: boolean;
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

  const structureTabs = useMemo(
    () =>
      [
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
      ] satisfies { key: string; label: string; categories: StructureType[]; icon: LucideIcon }[],
    [isBlitz],
  );

  const structuresWithMetadata = useMemo(() => {
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
      const normalizedBasePopulationCapacity = hasBasePopulation
        ? Math.max(Number(basePopulationCapacity ?? 0), 6)
        : 0;
      const populationCapacity =
        Number(structureBuildings?.population.max ?? 0) + normalizedBasePopulationCapacity;
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
  const selectOptions = filteredStructures.length > 0 ? filteredStructures : structuresWithMetadata;

  const selectedStructureMetadata = structuresWithMetadata.find((structure) => structure.entityId === structureEntityId);
  const selectedGroupColor = selectedStructureMetadata?.groupColor ?? null;
  const selectedGroupConfig = selectedGroupColor ? STRUCTURE_GROUP_CONFIG[selectedGroupColor] : null;
  const levelLabel =
    selectedStructureMetadata?.realmLevelLabel ??
    (selectedStructureMetadata ? `Level ${selectedStructureMetadata.realmLevel}` : "Level —");
  const populationCapacityLabel = selectedStructureMetadata
    ? `${selectedStructureMetadata.population}/${selectedStructureMetadata.populationCapacity}`
    : null;
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
        <div className="flex flex-wrap items-center gap-2 text-sm text-gold">
          {ActiveStructureIcon && (
            <span className={selectedGroupConfig ? selectedGroupConfig.textClass : "text-gold"}>
              <ActiveStructureIcon className="h-5 w-5" />
            </span>
          )}
          {selectedGroupColor && (
            <span className={`h-2 w-2 rounded-full ${selectedGroupConfig?.dotClass ?? ""}`} />
          )}
          <p
            className={`truncate text-base font-semibold sm:text-lg ${
              selectedGroupConfig ? selectedGroupConfig.textClass : "text-gold"
            }`}
          >
            {headerTitle}
          </p>
          {showDetailedStats && populationCapacityLabel && (
            <>
              <span className="text-gold/40">•</span>
              <span className="text-xs text-gold/70">{levelLabel}</span>
              <span className="text-gold/40">•</span>
              <span className="text-xs text-gold/70">Pop {populationCapacityLabel}</span>
            </>
          )}
          {showDetailedStats && selectedStructureMetadata?.canUpgrade && (
            <>
              <span className="text-gold/40">•</span>
              <span className="text-[10px] uppercase tracking-wide text-emerald-300">Upgradeable</span>
            </>
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
              const count = structuresWithMetadata.filter((structure) => tab.categories.includes(structure.category)).length;
              const isActiveTab = activeTab === index;
              return (
                <Tabs.Tab
                  key={tab.key}
                  aria-label={tab.label}
                  title={tab.label}
                  className="!mx-0"
                >
                  <span className="flex items-center gap-1">
                    <span className={`text-[12px] font-semibold transition-none ${isActiveTab ? "text-[#f4c24d]" : "text-gold/60"}`}>
                      {count}
                    </span>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="sr-only">{tab.label}</span>
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>

        {selectOptions.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {selectOptions.map((structure) => {
              const isSelected = structure.entityId === structureEntityId;
              const isRealm = structure.category === StructureType.Realm;
              const isVillage = structure.category === StructureType.Village;
              const levelLabel = structure.realmLevelLabel ?? `Level ${structure.realmLevel}`;
              const showInfoLine = isRealm || isVillage;
              const capacityDisplay = `${structure.population}/${structure.populationCapacity}`;
              const infoLine = showInfoLine ? `${levelLabel} • Pop ${capacityDisplay}` : "";
              const canUpgrade = isRealm && structure.canUpgrade;

              return (
                <button
                  type="button"
                  key={structure.entityId}
                  onClick={() => onSelectStructure(structure.entityId)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    isSelected
                      ? "border-gold bg-black/60"
                      : "border-gold/20 bg-black/20 hover:border-gold/40 hover:bg-black/30"
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
                        <span className={`h-2 w-2 rounded-full ${STRUCTURE_GROUP_CONFIG[structure.groupColor].dotClass}`} />
                      )}
                      <span
                        className={`text-sm font-semibold ${
                          structure.groupColor ? STRUCTURE_GROUP_CONFIG[structure.groupColor].textClass : "text-gold"
                        }`}
                      >
                        {structure.displayName}
                      </span>
                      {canUpgrade && (
                        <span className="text-[10px] uppercase tracking-wide text-emerald-300">Upgradeable</span>
                      )}
                      {showInfoLine && <span className="text-xxs text-gold/70">• {infoLine}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRequestNameChange(structure.structure);
                      }}
                      className="rounded border border-gold/30 p-1 text-gold/70 hover:bg-gold/10"
                      title="Rename structure"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </button>
              );
            })}
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

type StructureEditPopupProps = {
  currentName: string;
  originalName: string;
  groupColor: StructureGroupColor | null;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  onUpdateColor?: (color: StructureGroupColor | null) => void;
};

const StructureEditPopup = ({
  currentName,
  originalName,
  groupColor,
  onConfirm,
  onCancel,
  onUpdateColor,
}: StructureEditPopupProps) => {
  const [newName, setNewName] = useState(currentName);

  useEffect(() => {
    setNewName(currentName);
  }, [currentName]);

  const trimmedName = newName.trim();
  const isNameUnchanged = trimmedName === currentName.trim();
  const isNameEmpty = trimmedName === "";

  return (
    <SecondaryPopup width="420" name="structure-edit-popup" containerClassName="pointer-events-auto">
      <SecondaryPopup.Head onClose={onCancel}>Edit Structure</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height="320px">
        <div className="flex h-full flex-col gap-4 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold/60">Structure Name</p>
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="mt-2 w-full rounded border border-gold/30 bg-black/60 px-3 py-2 text-sm text-gold placeholder-gold/50 focus:border-gold/60 focus:outline-none"
              placeholder="Enter new name"
            />
            {originalName && originalName !== currentName && (
              <p className="mt-1 text-xxs text-gold/60">Original name: {originalName}</p>
            )}
            <p className="mt-2 text-xxs text-gold/50">
              This change is only visible locally and does not sync with other players.
            </p>
          </div>

          {onUpdateColor && (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gold/60">Structure Color</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateColor(null)}
                  className={`flex items-center gap-2 rounded border px-2 py-1 text-xs transition ${
                    groupColor === null ? "border-gold text-gold" : "border-gold/30 text-gold/70 hover:border-gold/50"
                  }`}
                >
                  <span className="text-gold">—</span>
                  <span>No Color</span>
                </button>
                {STRUCTURE_GROUP_COLORS.map((color) => {
                  const isSelected = groupColor === color.value;
                  return (
                    <button
                      type="button"
                      key={color.value}
                      onClick={() => onUpdateColor(color.value)}
                      className={`flex items-center gap-2 rounded border px-2 py-1 text-xs transition ${
                        isSelected ? "border-gold text-gold" : "border-gold/30 text-gold/70 hover:border-gold/50"
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-full ${color.dotClass}`} />
                      <span>{color.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-auto flex items-center justify-end gap-2 border-t border-gold/20 pt-4">
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="gold" disabled={isNameUnchanged || isNameEmpty} onClick={() => onConfirm(trimmedName)}>
              Save Changes
            </Button>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
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
      active: view === LeftView.EntityView,
      onClick: toggleView(LeftView.EntityView),
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
  setRightView,
  setLeftView,
  disableButtons,
  isBlitz,
}: EconomyNavigationContext): NavigationItem[] => {
  const toggleView = (targetView: RightView) => () => {
    setLeftView(LeftView.None);
    setRightView(rightView === targetView ? RightView.None : targetView);
  };

  const items: NavigationItem[] = [
    {
      id: MenuEnum.resourceTable,
      className: "resource-table-selector",
      image: BuildingThumbs.resources,
      tooltipLocation: "top",
      label: "Balance",
      size: DEFAULT_BUTTON_SIZE,
      disabled: false,
      active: rightView === RightView.ResourceTable,
      onClick: toggleView(RightView.ResourceTable),
    },
    {
      id: MenuEnum.production,
      className: "production-selector",
      image: BuildingThumbs.production,
      tooltipLocation: "top",
      label: "Production",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: rightView === RightView.Production,
      onClick: toggleView(RightView.Production),
    },
    {
      id: MenuEnum.transfer,
      className: "transfer-selector",
      image: BuildingThumbs.transfer,
      tooltipLocation: "top",
      label: "Transfers",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: rightView === RightView.Transfer,
      onClick: toggleView(RightView.Transfer),
    },
    {
      id: MenuEnum.bridge,
      className: "bridge-selector",
      image: BuildingThumbs.bridge,
      tooltipLocation: "top",
      label: "Bridge",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: rightView === RightView.Bridge,
      onClick: toggleView(RightView.Bridge),
    },
    {
      id: MenuEnum.storyEvents,
      className: "story-events-selector",
      image: BuildingThumbs.storyEvents,
      tooltipLocation: "top",
      label: "Activity Chronicles",
      size: DEFAULT_BUTTON_SIZE,
      disabled: false,
      active: rightView === RightView.StoryEvents,
      onClick: toggleView(RightView.StoryEvents),
    },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.resourceTable,
    MenuEnum.production,
    MenuEnum.transfer,
    MenuEnum.storyEvents,
    ...(isBlitz ? [] : [MenuEnum.bridge]),
  ];

  return items.filter((item) => allowedMenus.includes(item.id));
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
const EntityResourceTable = lazy(() =>
  import("@/ui/features/economy/resources").then((module) => ({
    default: module.EntityResourceTable,
  })),
);

export const LeftNavigationModule = memo(() => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const rightView = useUIStore((state) => state.rightNavigationView);
  const setRightView = useUIStore((state) => state.setRightNavigationView);
  const disableButtons = useUIStore((state) => state.disableButtons);
  const isTradeOpen = useUIStore((state) => state.openedPopups.includes(trade));

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const structures = useUIStore((state) => state.playerStructures);
  const { structureGroups, updateStructureGroup } = useStructureGroups();
  const { favorites, toggleFavorite } = useFavoriteStructures();

  const [structureNameChange, setStructureNameChange] = useState<ComponentValue<ClientComponents["Structure"]["schema"]> | null>(null);
  const [structureNameVersion, setStructureNameVersion] = useState(0);

  const bumpStructureNameVersion = useCallback(() => {
    setStructureNameVersion((version) => version + 1);
  }, []);

  const handleNameChange = useCallback((entityId: ID, newName: string) => {
    setEntityNameLocalStorage(entityId, newName);
    setStructureNameChange(null);
    bumpStructureNameVersion();
  }, [bumpStructureNameVersion]);

  const handleRequestNameChange = useCallback((structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => {
    setStructureNameChange(structure);
  }, []);

  const toggleModal = useUIStore((state) => state.toggleModal);

  const isBlitz = getIsBlitz();

  const navHeight = `calc(100vh - ${HEADER_HEIGHT}px)`;

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
        setRightView,
        setLeftView: setView,
        disableButtons,
        isBlitz,
      }),
    [rightView, setRightView, setView, disableButtons, isBlitz],
  );

  const ConnectedAccount = useAccountStore((state) => state.account);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const computedWidth = isCollapsed ? HANDLE_WIDTH : PANEL_WIDTH + HANDLE_WIDTH;
  const panelHeightStyle = { height: navHeight, maxHeight: navHeight };
  const showEmptyState = view === LeftView.None && rightView === RightView.None;

  const combinedNavigationItems = [...realmNavigationItems, ...economyNavigationItems];
  const structureNameMetadata = structureNameChange ? getStructureName(structureNameChange, isBlitz) : null;
  const editingStructureId = structureNameChange?.entity_id ? Number(structureNameChange.entity_id) : null;

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
                onSelectStructure={setStructureEntityId}
                isBlitz={isBlitz}
                components={components}
                structureGroups={structureGroups}
                onRequestNameChange={handleRequestNameChange}
                nameUpdateVersion={structureNameVersion}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto pr-1">
                  <Suspense fallback={<div className="p-8">Loading...</div>}>
                    {view === LeftView.EntityView && <EntityDetails />}
                    {view === LeftView.MilitaryView && <Military entityId={structureEntityId} />}
                    {view === LeftView.ConstructionView && <SelectPreviewBuildingMenu entityId={structureEntityId} />}
                    {view === LeftView.HyperstructuresView &&
                      (isBlitz ? <BlitzHyperstructuresMenu /> : <EternumHyperstructuresMenu />)}
                    {view === LeftView.ResourceArrivals && (
                      <AllResourceArrivals hasArrivals={arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0} />
                    )}
                    {rightView === RightView.ResourceTable && !!structureEntityId && (
                      <div className="entity-resource-table-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                        <EntityResourceTable entityId={structureEntityId} />
                      </div>
                    )}
                    {rightView === RightView.Production && (
                      <div className="production-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                        <ProductionOverviewPanel />
                      </div>
                    )}
                    {rightView === RightView.Bridge && (
                      <div className="bridge-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                        <Bridge structures={structures} />
                      </div>
                    )}
                    {rightView === RightView.Transfer && (
                      <div className="transfer-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                        <TransferAutomationPanel />
                      </div>
                    )}
                    {rightView === RightView.StoryEvents && (
                      <div className="story-events-selector flex h-full flex-col flex-1 overflow-y-auto">
                        <StoryEventsChronicles />
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

LeftNavigationModule.displayName = "LeftNavigationModule";
