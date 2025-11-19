import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Tabs } from "@/ui/design-system/atoms";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import type { ClientComponents, ID, Structure } from "@bibliothecadao/types";
import {
  BlitzStructureTypeToNameMapping,
  EternumStructureTypeToNameMapping,
  RealmLevels,
  StructureType,
  ID as toEntityId,
} from "@bibliothecadao/types";
import type { ComponentValue } from "@dojoengine/recs";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Crown,
  Home,
  Landmark,
  Palette,
  Pencil,
  Pickaxe,
  RotateCcw,
  Search,
  ShieldQuestion,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { useUISound } from "@/audio/hooks/useUISound";
import type { getEntityInfo } from "@bibliothecadao/eternum";
import {
  STRUCTURE_GROUP_CONFIG,
  StructureGroupColor,
  StructureGroupsMap,
  getNextStructureGroupColor,
} from "./structure-groups";

export type SelectedStructure = ReturnType<typeof getEntityInfo> & { isFavorite: boolean };

interface StructureSelectPanelProps {
  structureEntityId: ID;
  selectedStructure: SelectedStructure;
  structures: Structure[];
  favorites: number[];
  structureGroups: StructureGroupsMap;
  nameUpdateVersion: number;
  onToggleFavorite: (entityId: number) => void;
  onSelectStructure: (entityId: ID) => void;
  onRequestNameChange: (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => void;
  onUpdateStructureGroup: (entityId: number, color: StructureGroupColor | null) => void;
}

const structureIcons: Record<string, JSX.Element> = {
  [0]: <ShieldQuestion />,
  [StructureType.Realm]: <Crown />,
  [StructureType.Bank]: <Landmark />,
  [StructureType.Hyperstructure]: <Sparkles />,
  [StructureType.FragmentMine]: <Pickaxe />,
  [StructureType.Village]: <Home />,
};

type SortMode = "name" | "population" | "realmLevel";
type SortDirection = "asc" | "desc";

type StructureTab = {
  key: string;
  label: string;
  categories: StructureType[];
  emptyMessage: string;
};

type StructureTabWithItems = StructureTab & {
  structures: StructureWithMetadata[];
  count: number;
};

type StructureWithMetadata = Structure & {
  isFavorite: boolean;
  name: string;
  originalName: string;
  realmLevel: number;
  realmLevelLabel: string;
  population: number;
  populationCapacity: number;
  categoryName: string;
  groupColor: StructureGroupColor | null;
};

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const getRealmLevelLabel = (level: number): string => {
  const labels = RealmLevels as unknown as Record<number, string>;
  return labels[level] ?? labels[RealmLevels.Settlement];
};

const getStructureIcon = (selectedStructure: SelectedStructure) => {
  console.log("selectedStructure", selectedStructure);
  if (!selectedStructure || !selectedStructure.structure) {
    return null;
  }

  if (!selectedStructure.isMine) {
    return structureIcons.ReadOnly;
  }

  if (selectedStructure.structureCategory && structureIcons[selectedStructure.structureCategory]) {
    return structureIcons[selectedStructure.structureCategory];
  }

  return structureIcons.None;
};

export const StructureSelectPanel = memo(
  ({
    structureEntityId,
    selectedStructure,
    structures,
    favorites,
    structureGroups,
    nameUpdateVersion,
    onToggleFavorite,
    onSelectStructure,
    onRequestNameChange,
    onUpdateStructureGroup,
  }: StructureSelectPanelProps) => {
    const [selectOpen, setSelectOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortMode, setSortMode] = useState<SortMode>("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [activeTab, setActiveTab] = useState(0);
    const [metadataRefreshCounter, setMetadataRefreshCounter] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const playHover = useUISound("ui.hover");
    const playClick = useUISound("ui.click");
    const {
      setup: { components },
    } = useDojo();

    const isBlitz = useMemo(() => getIsBlitz(), []);
    const structureTypeNameMapping = useMemo(
      () => (isBlitz ? BlitzStructureTypeToNameMapping : EternumStructureTypeToNameMapping),
      [isBlitz],
    );
    const structureTabs = useMemo<StructureTab[]>(
      () => [
        {
          key: "realms",
          label: "Realms",
          categories: [StructureType.Realm],
          emptyMessage: "No realms available",
        },
        {
          key: "camps",
          label: isBlitz ? "Camps" : "Villages",
          categories: [StructureType.Village],
          emptyMessage: isBlitz ? "No camps available" : "No villages available",
        },
        {
          key: "rifts",
          label: isBlitz ? "Rifts" : "Fragment Mines",
          categories: [StructureType.FragmentMine],
          emptyMessage: isBlitz ? "No rifts available" : "No fragment mines available",
        },
        {
          key: "hyperstructures",
          label: "Hyperstructures",
          categories: [StructureType.Hyperstructure],
          emptyMessage: "No hyperstructures available",
        },
      ],
      [isBlitz],
    );

    const structuresWithMetadata = useMemo<StructureWithMetadata[]>(() => {
      return structures.map((structure) => {
        const { name, originalName } = getStructureName(structure.structure, isBlitz);
        const rawLevel = structure.structure.base?.level;
        const realmLevel = Number(rawLevel ?? 0);
        const structureEntity = getEntityIdFromKeys([BigInt(structure.entityId)]);
        const structureBuildings = getComponentValue(components.StructureBuildings, structureEntity);
        const population = Number(structureBuildings?.population.current ?? 0);
        const populationCapacity = Number(structureBuildings?.population.max ?? 0);

        return {
          ...structure,
          isFavorite: favorites.includes(structure.entityId),
          name,
          originalName,
          realmLevel,
          realmLevelLabel: getRealmLevelLabel(realmLevel),
          population,
          populationCapacity,
          categoryName: structureTypeNameMapping[structure.category] ?? "Unknown",
          groupColor: structureGroups[structure.entityId] ?? null,
        };
      });
    }, [
      favorites,
      structures,
      isBlitz,
      structureTypeNameMapping,
      structureGroups,
      nameUpdateVersion,
      metadataRefreshCounter,
      components.StructureBuildings,
    ]);
    const selectedGroupColor = structureGroups[Number(structureEntityId)] ?? null;
    const selectedGroupConfig = selectedGroupColor ? STRUCTURE_GROUP_CONFIG[selectedGroupColor] : null;
    const selectedStructureMetadata = useMemo(
      () => structuresWithMetadata.find((structure) => structure.entityId === Number(structureEntityId)),
      [structuresWithMetadata, structureEntityId],
    );
    const filteredStructures = useMemo(() => {
      const normalizedSearch = searchTerm ? normalizeSearchValue(searchTerm) : "";

      if (!normalizedSearch) {
        return structuresWithMetadata;
      }

      return structuresWithMetadata.filter((structure) => {
        const normalizedName = normalizeSearchValue(structure.name);
        const normalizedPopulation = normalizeSearchValue(structure.population.toString());
        return normalizedName.includes(normalizedSearch) || normalizedPopulation.includes(normalizedSearch);
      });
    }, [structuresWithMetadata, searchTerm]);

    const sortStructures = useCallback(
      (structuresList: StructureWithMetadata[]) => {
        return [...structuresList].sort((a, b) => {
          const favoriteCompare = Number(b.isFavorite) - Number(a.isFavorite);
          if (favoriteCompare !== 0) {
            return favoriteCompare;
          }

          if (sortMode === "name") {
            const nameComparison = a.name.localeCompare(b.name, undefined, { sensitivity: "accent" });
            if (nameComparison !== 0) {
              return sortDirection === "asc" ? nameComparison : -nameComparison;
            }
          } else if (sortMode === "population") {
            const populationDifference = a.population - b.population;
            if (populationDifference !== 0) {
              return sortDirection === "asc" ? populationDifference : -populationDifference;
            }
          } else if (sortMode === "realmLevel") {
            const realmLevelDifference = a.realmLevel - b.realmLevel;
            if (realmLevelDifference !== 0) {
              return sortDirection === "asc" ? realmLevelDifference : -realmLevelDifference;
            }
          }

          const idFallback = Number(a.entityId) - Number(b.entityId);
          return sortDirection === "asc" ? idFallback : -idFallback;
        });
      },
      [sortMode, sortDirection],
    );

    const tabbedStructures = useMemo<StructureTabWithItems[]>(() => {
      const allTabs = structureTabs.map((tab) => {
        const tabStructures = filteredStructures.filter((structure) => tab.categories.includes(structure.category));
        const sorted = sortStructures(tabStructures);
        return {
          ...tab,
          structures: sorted,
          count: sorted.length,
        };
      });

      const populatedTabs = allTabs.filter((tab) => tab.count > 0);
      if (populatedTabs.length > 0) {
        return populatedTabs;
      }

      return allTabs.filter((tab) => tab.key === "realms");
    }, [filteredStructures, structureTabs, sortStructures]);

    const shouldHideTabs = tabbedStructures.length <= 1 && tabbedStructures[0]?.key === "realms";

    const activeTabStructures = useMemo(
      () => tabbedStructures[activeTab]?.structures ?? [],
      [activeTab, tabbedStructures],
    );

    useEffect(() => {
      if (activeTab >= tabbedStructures.length) {
        setActiveTab(0);
        return;
      }

      const currentTab = tabbedStructures[activeTab];
      if (currentTab && currentTab.structures.length > 0) {
        return;
      }

      const nextAvailableIndex = tabbedStructures.findIndex((tab) => tab.structures.length > 0);
      if (nextAvailableIndex !== -1 && nextAvailableIndex !== activeTab) {
        setActiveTab(nextAvailableIndex);
      }
    }, [activeTab, tabbedStructures]);

    const handleSelectStructure = useCallback(
      (entityId: ID) => {
        playClick();
        onSelectStructure(entityId);
        setSelectOpen(false);
        setSearchTerm("");
      },
      [onSelectStructure, playClick],
    );

    // Auto-focus search input when select opens (after content renders)
    useEffect(() => {
      if (!selectOpen) {
        return;
      }

      const focusTimer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);

      return () => window.clearTimeout(focusTimer);
    }, [selectOpen]);

    if (!selectedStructure.isMine) {
      const spectatorName = selectedStructure.structure
        ? getStructureName(selectedStructure.structure, isBlitz).name
        : "";

      return (
        <div className="structure-name-selector self-center flex justify-between w-full">
          <div className="w-full px-4 py-2 flex flex-col gap-2">
            <div className="flex items-center gap-3 truncate">
              <>
                {getStructureIcon(selectedStructure)}
                {selectedGroupConfig && <span className={`h-2 w-2 rounded-full ${selectedGroupConfig.dotClass}`} />}
                <span className={`truncate ${selectedGroupConfig ? selectedGroupConfig.textClass : ""}`}>
                  {spectatorName}
                </span>
              </>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="structure-name-selector self-center flex justify-between w-full">
        <Select
          value={structureEntityId.toString()}
          onValueChange={(value) => {
            handleSelectStructure(toEntityId(value));
          }}
          open={selectOpen}
          onOpenChange={(open) => {
            playClick();
            setSelectOpen(open);
            if (!open) {
              setSearchTerm("");
            }
          }}
        >
          <SelectTrigger
            className="truncate text-base font-semibold text-gold sm:text-lg"
            onMouseEnter={() => playHover()}
          >
            <span className="sr-only">
              <SelectValue placeholder="Select Structure" />
            </span>
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                {getStructureIcon(selectedStructure)}
                {selectedGroupConfig && <span className={`h-2 w-2 rounded-full ${selectedGroupConfig.dotClass}`} />}
                <span className={`truncate ${selectedGroupConfig ? selectedGroupConfig.textClass : ""}`}>
                  {selectedStructureMetadata?.name ??
                    (selectedStructure.structure ? getStructureName(selectedStructure.structure, isBlitz).name : "")}
                </span>
              </div>
            </div>
          </SelectTrigger>
          <SelectContent className="panel-wood bg-dark-wood -ml-2">
            <Tabs selectedIndex={activeTab} onChange={(index: number) => setActiveTab(index)} className="w-full">
              <div className="sticky top-0 z-50 space-y-3 border-b border-gold/20 bg-dark-wood p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/60" />
                  <input
                    type="text"
                    placeholder="Search by name or population..."
                    value={searchTerm}
                    onChange={(event) => {
                      const { value } = event.target;
                      setSearchTerm(value);
                      window.requestAnimationFrame(() => {
                        searchInputRef.current?.focus();
                      });
                    }}
                    autoFocus
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter" && activeTabStructures.length > 0) {
                        handleSelectStructure(toEntityId(activeTabStructures[0].entityId));
                      }
                    }}
                    className="w-full rounded border border-gold/30 bg-brown/20 py-1 pl-8 pr-3 text-sm text-gold placeholder-gold/60 focus:border-gold/60 focus:outline-none"
                    onClick={(event) => event.stopPropagation()}
                    ref={searchInputRef}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        playClick();
                        setSearchTerm("");
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gold/60 hover:text-gold"
                      onMouseEnter={() => playHover()}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div
                  className="flex flex-col gap-2"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={`h-8 rounded border px-3 py-1 text-xs transition-colors ${
                        sortMode === "name"
                          ? "border-gold/60 bg-gold/20 text-gold"
                          : "border-gold/30 bg-brown/20 text-gold/70 hover:border-gold/50"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        playClick();
                        if (sortMode !== "name") {
                          setSortMode("name");
                          setSortDirection("asc");
                        } else {
                          setSortDirection("asc");
                        }
                      }}
                      onMouseEnter={() => playHover()}
                    >
                      Name
                    </button>
                    <button
                      type="button"
                      className={`h-8 rounded border px-3 py-1 text-xs transition-colors ${
                        sortMode === "realmLevel"
                          ? "border-gold/60 bg-gold/20 text-gold"
                          : "border-gold/30 bg-brown/20 text-gold/70 hover:border-gold/50"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        playClick();
                        if (sortMode !== "realmLevel") {
                          setSortMode("realmLevel");
                          setSortDirection("asc");
                        } else {
                          setSortDirection("asc");
                        }
                      }}
                      onMouseEnter={() => playHover()}
                    >
                      Realm Level
                    </button>
                    <button
                      type="button"
                      className={`h-8 rounded border px-3 py-1 text-xs transition-colors ${
                        sortMode === "population"
                          ? "border-gold/60 bg-gold/20 text-gold"
                          : "border-gold/30 bg-brown/20 text-gold/70 hover:border-gold/50"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        playClick();
                        if (sortMode !== "population") {
                          setSortMode("population");
                          setSortDirection("asc");
                        } else {
                          setSortDirection("asc");
                        }
                      }}
                      onMouseEnter={() => playHover()}
                    >
                      Population
                    </button>
                    <button
                      type="button"
                      className="flex h-8 items-center justify-center rounded border border-gold/40 bg-brown/20 px-2 text-gold hover:border-gold/60"
                      onClick={(event) => {
                        event.stopPropagation();
                        playClick();
                        setSortDirection((direction) => (direction === "desc" ? "asc" : "desc"));
                      }}
                      onMouseEnter={() => playHover()}
                      aria-label="Toggle sort direction"
                      title={sortDirection === "desc" ? "Sort descending" : "Sort ascending"}
                    >
                      {sortDirection === "desc" ? (
                        <ArrowDownWideNarrow className="h-4 w-4" />
                      ) : (
                        <ArrowUpWideNarrow className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      className="flex h-8 items-center justify-center rounded border border-gold/40 bg-brown/20 px-2 text-gold hover:border-gold/60"
                      onClick={(event) => {
                        event.stopPropagation();
                        playClick();
                        setMetadataRefreshCounter((counter) => counter + 1);
                      }}
                      onMouseEnter={() => playHover()}
                      aria-label="Refresh structures"
                      title="Refresh structures"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                  <Tabs.List className={`flex flex-wrap gap-2 ${shouldHideTabs ? "hidden" : ""}`}>
                    {tabbedStructures.map((tab) => (
                      <Tabs.Tab key={tab.key}>
                        <div className="flex items-center gap-2">
                          <span>{tab.label}</span>
                          <span className="text-xs text-gold/60">{tab.count}</span>
                        </div>
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </div>
              </div>
              <Tabs.Panels className="max-h-72 overflow-y-auto">
                {tabbedStructures.map((tab) => (
                  <Tabs.Panel key={tab.key} className="space-y-0">
                    {tab.structures.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gold/60">
                        {searchTerm ? "No structures match your search." : tab.emptyMessage}
                      </div>
                    ) : (
                      tab.structures.map((structure) => {
                        const showRealmLevelLabel =
                          structure.category === StructureType.Realm || structure.category === StructureType.Village;
                        const hideStructureStats =
                          structure.category === StructureType.FragmentMine ||
                          structure.category === StructureType.Hyperstructure;
                        const levelLabel = showRealmLevelLabel
                          ? structure.realmLevelLabel
                          : `Lvl ${structure.realmLevel}`;

                        return (
                          <div
                            key={structure.entityId}
                            className="flex flex-row items-center"
                            onMouseEnter={() => playHover()}
                          >
                            <button
                              className="p-1"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                playClick();
                                onToggleFavorite(structure.entityId);
                              }}
                              onMouseEnter={() => playHover()}
                            >
                              <Star className={structure.isFavorite ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                            </button>
                            <button
                              className="p-1"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                playClick();
                                const nextColor = getNextStructureGroupColor(structure.groupColor ?? null);
                                onUpdateStructureGroup(structure.entityId, nextColor);
                              }}
                              onMouseEnter={() => playHover()}
                              title={
                                structure.groupColor
                                  ? `Group: ${STRUCTURE_GROUP_CONFIG[structure.groupColor].label}`
                                  : "Assign group color"
                              }
                            >
                              <Palette
                                className={`h-4 w-4 ${
                                  structure.groupColor ? STRUCTURE_GROUP_CONFIG[structure.groupColor].textClass : ""
                                }`}
                              />
                            </button>
                            <button
                              className="p-1"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                playClick();
                                setSelectOpen(false);
                                onRequestNameChange(structure.structure);
                              }}
                              onMouseEnter={() => playHover()}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <SelectItem className="flex justify-between" value={structure.entityId?.toString() || ""}>
                              <div className="self-center flex items-baseline gap-2 text-xl">
                                <span className="flex items-center gap-2">
                                  {structure.groupColor && (
                                    <span
                                      className={`h-2 w-2 rounded-full ${STRUCTURE_GROUP_CONFIG[structure.groupColor].dotClass}`}
                                    />
                                  )}
                                  <span
                                    className={
                                      structure.groupColor ? STRUCTURE_GROUP_CONFIG[structure.groupColor].textClass : ""
                                    }
                                  >
                                    {structure.name}
                                  </span>
                                </span>
                                {!hideStructureStats && (
                                  <span className="text-xs text-gold/70">
                                    {levelLabel}
                                    {" · "}
                                    Pop {structure.population}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          </div>
                        );
                      })
                    )}
                  </Tabs.Panel>
                ))}
              </Tabs.Panels>
            </Tabs>
          </SelectContent>
        </Select>
      </div>
    );
  },
);

StructureSelectPanel.displayName = "StructureSelectPanel";
