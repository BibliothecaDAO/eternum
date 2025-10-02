import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import type { ClientComponents, ID, Structure } from "@bibliothecadao/types";
import {
  BlitzStructureTypeToNameMapping,
  EternumStructureTypeToNameMapping,
  ID as toEntityId,
  StructureType,
} from "@bibliothecadao/types";
import type { ComponentValue } from "@dojoengine/recs";
import {
  Crown,
  EyeIcon,
  Landmark,
  Palette,
  Pencil,
  Pickaxe,
  Search,
  ShieldQuestion,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { useUISound } from "@/audio/hooks/useUISound";
import type { getEntityInfo } from "@bibliothecadao/eternum";
import {
  STRUCTURE_GROUP_COLORS,
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
  onToggleFavorite: (entityId: number) => void;
  onSelectStructure: (entityId: ID) => void;
  onRequestNameChange: (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => void;
  onUpdateStructureGroup: (entityId: number, color: StructureGroupColor | null) => void;
}

const structureIcons: Record<string, JSX.Element> = {
  None: <ShieldQuestion />,
  Realm: <Crown />,
  Bank: <Landmark />,
  Hyperstructure: <Sparkles />,
  FragmentMine: <Pickaxe />,
  ReadOnly: <EyeIcon />,
};

const SORT_OPTIONS = [
  { value: "name" as const, label: "Name (A-Z)" },
  { value: "realmLevel" as const, label: "Realm Level (High-Low)" },
] as const;

type SortOptionValue = (typeof SORT_OPTIONS)[number]["value"];
type CategoryFilterValue = "all" | `${StructureType}`;
type GroupFilterValue = "all" | "none" | StructureGroupColor;

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const getStructureIcon = (selectedStructure: SelectedStructure) => {
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
    onToggleFavorite,
    onSelectStructure,
    onRequestNameChange,
    onUpdateStructureGroup,
  }: StructureSelectPanelProps) => {
    const [selectOpen, setSelectOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState<SortOptionValue>("name");
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
    const [groupFilter, setGroupFilter] = useState<GroupFilterValue>("all");
    const searchInputRef = useRef<HTMLInputElement>(null);

    const playHover = useUISound("ui.hover");
    const playClick = useUISound("ui.click");

    const isBlitz = useMemo(() => getIsBlitz(), []);
    const structureTypeNameMapping = useMemo(
      () => (isBlitz ? BlitzStructureTypeToNameMapping : EternumStructureTypeToNameMapping),
      [isBlitz],
    );

    const selectedGroupColor = structureGroups[Number(structureEntityId)] ?? null;
    const selectedGroupConfig = selectedGroupColor ? STRUCTURE_GROUP_CONFIG[selectedGroupColor] : null;

    const structuresWithMetadata = useMemo(() => {
      return structures.map((structure) => {
        const { name, originalName } = getStructureName(structure.structure, isBlitz);
        const rawLevel = structure.structure.base?.level;
        const realmLevel = Number(rawLevel ?? 0);

        return {
          ...structure,
          isFavorite: favorites.includes(structure.entityId),
          name,
          originalName,
          realmLevel,
          categoryName: structureTypeNameMapping[structure.category] ?? "Unknown",
          groupColor: structureGroups[structure.entityId] ?? null,
        };
      });
    }, [favorites, structures, isBlitz, structureTypeNameMapping, structureGroups]);

    const categoryOptions = useMemo(() => {
      const uniqueCategories = new Set<StructureType>();

      structures.forEach((structure) => {
        if (structure.category) {
          uniqueCategories.add(structure.category);
        }
      });

      return [
        { value: "all" as CategoryFilterValue, label: "All categories" },
        ...Array.from(uniqueCategories)
          .sort((a, b) => {
            const nameA = structureTypeNameMapping[a] ?? "";
            const nameB = structureTypeNameMapping[b] ?? "";
            return nameA.localeCompare(nameB);
          })
          .map((category) => ({
            value: category.toString() as CategoryFilterValue,
            label: structureTypeNameMapping[category] ?? "Unknown",
          })),
      ];
    }, [structureTypeNameMapping, structures]);

    const groupOptions = useMemo(
      () =>
        [
          { value: "all" as GroupFilterValue, label: "All groups", type: "meta" as const },
          { value: "none" as GroupFilterValue, label: "No color", type: "meta" as const },
          ...STRUCTURE_GROUP_COLORS.map((option) => ({
            value: option.value as GroupFilterValue,
            label: option.label,
            type: "color" as const,
            color: option.value,
          })),
        ] satisfies Array<
          | { value: GroupFilterValue; label: string; type: "meta" }
          | { value: GroupFilterValue; label: string; type: "color"; color: StructureGroupColor }
        >,
      [],
    );

    const filteredStructures = useMemo(() => {
      const normalizedSearch = searchTerm ? normalizeSearchValue(searchTerm) : "";

      return structuresWithMetadata.filter((structure) => {
        if (categoryFilter !== "all" && structure.category.toString() !== categoryFilter) {
          return false;
        }

        if (groupFilter !== "all") {
          if (groupFilter === "none" && structure.groupColor !== null) {
            return false;
          }

          if (groupFilter !== "none" && structure.groupColor !== groupFilter) {
            return false;
          }
        }

        if (!normalizedSearch) {
          return true;
        }

        return normalizeSearchValue(structure.name).includes(normalizedSearch);
      });
    }, [structuresWithMetadata, categoryFilter, groupFilter, searchTerm]);

    const sortedStructures = useMemo(() => {
      return [...filteredStructures].sort((a, b) => {
        const favoriteCompare = Number(b.isFavorite) - Number(a.isFavorite);
        if (favoriteCompare !== 0) {
          return favoriteCompare;
        }

        if (sortOption === "realmLevel") {
          const levelDifference = b.realmLevel - a.realmLevel;
          if (levelDifference !== 0) {
            return levelDifference;
          }
        }

        return a.name.localeCompare(b.name);
      });
    }, [filteredStructures, sortOption]);

    useEffect(() => {
      if (categoryFilter === "all") {
        return;
      }

      const categoryStillExists = structuresWithMetadata.some(
        (structure) => structure.category.toString() === categoryFilter,
      );

      if (!categoryStillExists) {
        setCategoryFilter("all");
      }
    }, [categoryFilter, structuresWithMetadata]);

    useEffect(() => {
      if (groupFilter === "all" || groupFilter === "none") {
        return;
      }

      const groupStillExists = structuresWithMetadata.some((structure) => structure.groupColor === groupFilter);

      if (!groupStillExists) {
        setGroupFilter("all");
      }
    }, [groupFilter, structuresWithMetadata]);

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
      return (
        <div className="structure-name-selector self-center flex justify-between w-full">
          <div className="w-full px-4 py-2">
            <h5 className="flex items-center gap-4 truncate">
              <>
                {getStructureIcon(selectedStructure)}
                {selectedGroupConfig && <span className={`h-2 w-2 rounded-full ${selectedGroupConfig.dotClass}`} />}
                <span className={selectedGroupConfig ? selectedGroupConfig.textClass : ""}>
                  {selectedStructure.structure ? getStructureName(selectedStructure.structure, isBlitz).name : ""}
                </span>
                <span className="text-sm text-gold/70">
                  Lvl {Number(selectedStructure.structure?.base?.level ?? 0)}
                </span>
              </>
            </h5>
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
          <SelectTrigger className="truncate" onMouseEnter={() => playHover()}>
            <SelectValue placeholder="Select Structure" />
          </SelectTrigger>
          <SelectContent className="panel-wood bg-dark-wood -ml-2">
            <div className="sticky top-0 p-2 bg-dark-wood border-b border-gold/20 z-50 space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gold/60" />
                <input
                  type="text"
                  placeholder="Search structures..."
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
                    if (event.key === "Enter" && sortedStructures.length > 0) {
                      handleSelectStructure(toEntityId(sortedStructures[0].entityId));
                    }
                  }}
                  className="w-full pl-8 pr-3 py-1 bg-brown/20 border border-gold/30 rounded text-sm text-gold placeholder-gold/60 focus:outline-none focus:border-gold/60"
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
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gold/60 hover:text-gold"
                    onMouseEnter={() => playHover()}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div
                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {/* Prevent nested select interactions from collapsing the main selector */}
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOptionValue)}>
                  <SelectTrigger className="h-8 bg-brown/20 border border-gold/30 rounded text-xs text-gold px-3 py-1">
                    <SelectValue placeholder="Order by" />
                  </SelectTrigger>
                  <SelectContent className="panel-wood bg-dark-wood">
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => setCategoryFilter(value as CategoryFilterValue)}
                >
                  <SelectTrigger className="h-8 bg-brown/20 border border-gold/30 rounded text-xs text-gold px-3 py-1">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="panel-wood bg-dark-wood max-h-60 overflow-y-auto">
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value as GroupFilterValue)}>
                  <SelectTrigger className="h-8 bg-brown/20 border border-gold/30 rounded text-xs text-gold px-3 py-1">
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent className="panel-wood bg-dark-wood max-h-60 overflow-y-auto">
                    {groupOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.type === "color" ? (
                          <div className="flex items-center gap-2">
                            <span className={`h-3 w-3 rounded-full ${STRUCTURE_GROUP_CONFIG[option.color].dotClass}`} />
                            <span className="sr-only">{option.label}</span>
                          </div>
                        ) : (
                          option.label
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {sortedStructures.length === 0 ? (
              <div className="p-4 text-center text-gold/60 text-sm">
                {searchTerm || categoryFilter !== "all" || groupFilter !== "all"
                  ? "No structures found"
                  : "No structures available"}
              </div>
            ) : (
              sortedStructures.map((structure) => (
                <div key={structure.entityId} className="flex flex-row items-center" onMouseEnter={() => playHover()}>
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
                          className={structure.groupColor ? STRUCTURE_GROUP_CONFIG[structure.groupColor].textClass : ""}
                        >
                          {structure.name}
                        </span>
                      </span>
                      <span className="text-sm text-gold/70">Lvl {structure.realmLevel}</span>
                    </div>
                  </SelectItem>
                </div>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    );
  },
);

StructureSelectPanel.displayName = "StructureSelectPanel";
