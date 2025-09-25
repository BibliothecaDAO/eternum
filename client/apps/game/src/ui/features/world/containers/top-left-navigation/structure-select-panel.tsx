import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { Search, Star, Pencil, X, ShieldQuestion, Crown, Landmark, Sparkles, Pickaxe, EyeIcon } from "lucide-react";
import type { ComponentValue } from "@dojoengine/recs";
import type { ClientComponents, ID, Structure } from "@bibliothecadao/types";
import { ID as toEntityId } from "@bibliothecadao/types";

import type { getEntityInfo } from "@bibliothecadao/eternum";

export type SelectedStructure = ReturnType<typeof getEntityInfo> & { isFavorite: boolean };

interface StructureSelectPanelProps {
  structureEntityId: ID;
  selectedStructure: SelectedStructure;
  structures: Structure[];
  favorites: number[];
  onToggleFavorite: (entityId: number) => void;
  onSelectStructure: (entityId: ID) => void;
  onRequestNameChange: (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => void;
}

const structureIcons: Record<string, JSX.Element> = {
  None: <ShieldQuestion />,
  Realm: <Crown />,
  Bank: <Landmark />,
  Hyperstructure: <Sparkles />,
  FragmentMine: <Pickaxe />,
  ReadOnly: <EyeIcon />,
};

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
    onToggleFavorite,
    onSelectStructure,
    onRequestNameChange,
  }: StructureSelectPanelProps) => {
    const [selectOpen, setSelectOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

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
          const favoriteCompare = Number(b.isFavorite) - Number(a.isFavorite);
          if (favoriteCompare !== 0) return favoriteCompare;
          return a.name.localeCompare(b.name);
        });
    }, [favorites, structures]);

    const filteredStructures = useMemo(() => {
      if (!searchTerm) {
        return structuresWithFavorites;
      }

      const normalizedSearch = normalizeSearchValue(searchTerm);

      return structuresWithFavorites.filter((structure) =>
        normalizeSearchValue(structure.name).includes(normalizedSearch),
      );
    }, [structuresWithFavorites, searchTerm]);

    const handleSelectStructure = useCallback(
      (entityId: ID) => {
        onSelectStructure(entityId);
        setSelectOpen(false);
        setSearchTerm("");
      },
      [onSelectStructure],
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
                <span>
                  {selectedStructure.structure ? getStructureName(selectedStructure.structure, getIsBlitz()).name : ""}
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
            setSelectOpen(open);
            if (!open) {
              setSearchTerm("");
            }
          }}
        >
          <SelectTrigger className="truncate">
            <SelectValue placeholder="Select Structure" />
          </SelectTrigger>
          <SelectContent className="panel-wood bg-dark-wood -ml-2">
            <div className="sticky top-0 p-2 bg-dark-wood border-b border-gold/20 z-50">
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
                    if (event.key === "Enter" && filteredStructures.length > 0) {
                      handleSelectStructure(toEntityId(filteredStructures[0].entityId));
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
                      setSearchTerm("");
                      searchInputRef.current?.focus();
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
              filteredStructures.map((structure) => (
                <div key={structure.entityId} className="flex flex-row items-center">
                  <button
                    className="p-1"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite(structure.entityId);
                    }}
                  >
                    <Star className={structure.isFavorite ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                  </button>
                  <button
                    className="p-1"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectOpen(false);
                      onRequestNameChange(structure.structure);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <SelectItem className="flex justify-between" value={structure.entityId?.toString() || ""}>
                    <div className="self-center flex gap-4 text-xl">{structure.name}</div>
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
