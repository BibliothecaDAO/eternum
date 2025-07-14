import { ReactComponent as Cross } from "@/assets/icons/common/cross.svg";
import TextInput from "@/ui/design-system/atoms/text-input";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { RELICS, RelicActivation, RelicInfo, ResourcesIds, resources } from "@bibliothecadao/types";
import clsx from "clsx";
import React, { useEffect, useMemo, useRef, useState } from "react";

interface SelectRelicProps {
  onSelect: (relicIds: ResourcesIds[]) => void;
  className?: string;
  defaultValue?: ResourcesIds[];
  allowMultiple?: boolean;
  filterTypes?: RelicInfo["type"][];
  label?: string;
}

export const SelectRelic: React.FC<SelectRelicProps> = ({
  onSelect,
  className,
  defaultValue = [],
  allowMultiple = false,
  filterTypes = ["Damage", "Damage Reduction", "Stamina"],
  label = "Select Relic",
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedRelics, setSelectedRelics] = useState<ResourcesIds[]>(defaultValue);
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredRelics = useMemo(() => {
    return RELICS.filter((relic) => {
      // Filter by type
      if (!filterTypes.includes(relic.type)) return false;

      // Filter by search input
      if (searchInput && !relic.name.toLowerCase().includes(searchInput.toLowerCase())) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by type then by level
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.level - b.level;
    });
  }, [searchInput, filterTypes]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else {
      setSearchInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!allowMultiple && filteredRelics.length > 0) {
        const selectedRelic = filteredRelics[0];
        setSelectedRelics([selectedRelic.id]);
        onSelect([selectedRelic.id]);
        setOpen(false);
      }
      setSearchInput("");
    } else {
      e.stopPropagation();
    }
  };

  const toggleRelic = (relicId: ResourcesIds) => {
    let newSelection: ResourcesIds[];

    if (allowMultiple) {
      if (selectedRelics.includes(relicId)) {
        newSelection = selectedRelics.filter((id) => id !== relicId);
      } else {
        newSelection = [...selectedRelics, relicId];
      }
    } else {
      newSelection = [relicId];
      setOpen(false);
    }

    setSelectedRelics(newSelection);
    onSelect(newSelection);
  };

  const clearSelection = () => {
    setSelectedRelics([]);
    onSelect([]);
  };

  const getRelicTypeColor = (type: RelicInfo["type"]) => {
    switch (type) {
      case "Damage":
        return "text-order-giants";
      case "Damage Reduction":
        return "text-order-brilliance";
      case "Stamina":
        return "text-order-power";
      default:
        return "text-gold";
    }
  };

  const getActivationColor = (activation: RelicActivation) => {
    switch (activation) {
      case RelicActivation.Army:
        return "bg-red-500/20 text-red-400";
      case RelicActivation.Structure:
        return "bg-green-500/20 text-green-400";
      case RelicActivation.ArmyAndStructure:
        return "bg-orange-500/20 text-orange-400";
    }
  };

  // Call onSelect with default value on mount
  React.useEffect(() => {
    if (defaultValue.length > 0) {
      onSelect(defaultValue);
    }
  }, []);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const selectedRelicInfos = selectedRelics.map((id) => RELICS.find((r) => r.id === id)).filter(Boolean) as RelicInfo[];

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm font-medium text-gold/80">{label}</span>}
      <div className="flex items-center gap-2 w-full">
        {selectedRelics.length > 0 && (
          <Cross
            className="my-auto w-8 hover:fill-gold/50 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all cursor-pointer"
            onClick={clearSelection}
          />
        )}
        <div className="relative w-full" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={clsx(
              "flex h-10 w-full items-center justify-between rounded-md border border-gold/20 bg-dark-brown px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          >
            <span>
              {selectedRelics.length === 0
                ? "Select relics..."
                : allowMultiple
                  ? `${selectedRelics.length} relic${selectedRelics.length > 1 ? "s" : ""} selected`
                  : selectedRelicInfos[0]?.name || "Select a relic"}
            </span>
            <span className="h-4 w-4">▼</span>
          </button>

          {open && (
            <div className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gold/20 bg-dark-brown text-popover-foreground shadow-md top-full w-full mt-1">
              <div className="p-2">
                <TextInput
                  ref={inputRef}
                  onChange={setSearchInput}
                  placeholder="Search relics..."
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredRelics.map((relic) => {
                  const isSelected = selectedRelics.includes(relic.id);
                  return (
                    <div
                      key={relic.id}
                      className={clsx(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gold/10",
                        isSelected && "bg-gold/10",
                      )}
                      onClick={() => toggleRelic(relic.id)}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-2">
                          <ResourceIcon resource={resources.find((r) => r.id === relic.id)?.trait || ""} size="sm" />
                          <div className="flex flex-col">
                            <span className="font-medium">{relic.name}</span>
                            <span className={clsx("text-xs", getRelicTypeColor(relic.type))}>{relic.effect}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={clsx("px-2 py-1 rounded text-xs", getActivationColor(relic.activation))}>
                            {relic.activation}
                          </span>
                          {isSelected && allowMultiple && <span className="text-gold">✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Display selected relics */}
      {selectedRelicInfos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedRelicInfos.map((relic) => (
            <div
              key={relic.id}
              className="flex items-center gap-1 px-2 py-1 bg-gold/10 border border-gold/20 rounded text-sm"
            >
              <ResourceIcon resource={resources.find((r) => r.id === relic.id)?.trait || ""} size="xs" />
              <span>{relic.name}</span>
              <span className={clsx("text-xs", getRelicTypeColor(relic.type))}>
                (
                {relic.bonus > 1
                  ? `+${Math.round((relic.bonus - 1) * 100)}%`
                  : `-${Math.round((1 - relic.bonus) * 100)}%`}
                )
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
