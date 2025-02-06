import { ReactComponent as Cross } from "@/assets/icons/common/cross.svg";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import TextInput from "@/ui/elements/text-input";
import { RESOURCE_TIERS, ResourcesIds } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useMemo, useRef, useState } from "react";

interface SelectResourceProps {
  onSelect: (resourceId: number | null) => void;
  className?: string;
  realmProduction?: boolean;
  defaultValue?: number;
  excludeResourceIds?: number[];
}

export const SelectResource: React.FC<SelectResourceProps> = ({
  onSelect,
  className,
  realmProduction = false,
  defaultValue,
  excludeResourceIds = [],
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedResource, setSelectedResource] = useState<string>(defaultValue?.toString() || "");
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const REALM_PRODUCTION_EXCLUDED = [
    ResourcesIds.AncientFragment,
    ResourcesIds.Crossbowman,
    ResourcesIds.Knight,
    ResourcesIds.Paladin,
    ResourcesIds.Fish,
    ResourcesIds.Wheat,
    ResourcesIds.Donkey,
    ResourcesIds.Lords,
    ResourcesIds.Labor,
  ];

  const orderedResources = useMemo(() => {
    return Object.values(RESOURCE_TIERS)
      .flat()
      .filter((resourceId) => {
        if (resourceId === ResourcesIds.Lords) return false;
        if (realmProduction && REALM_PRODUCTION_EXCLUDED.includes(resourceId)) return false;
        if (excludeResourceIds.includes(resourceId)) return false;
        return true;
      });
  }, [realmProduction, excludeResourceIds]);

  const filteredResourceIds = orderedResources.filter((resourceId) =>
    ResourcesIds[resourceId].toLowerCase().startsWith(searchInput.toLowerCase()),
  );

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && inputRef.current) {
      setSelectedResource("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else {
      setSearchInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (filteredResourceIds.length > 0) {
        const selectedResourceId = filteredResourceIds[0];
        setSelectedResource(selectedResourceId.toString());
        onSelect(selectedResourceId);
        setOpen(false);
      }
      setSearchInput("");
    } else {
      e.stopPropagation();
    }
  };

  // Call onSelect with default value on mount
  React.useEffect(() => {
    if (defaultValue !== undefined) {
      onSelect(defaultValue);
    }
  }, []);

  return (
    <div className="flex items-center">
      <Cross
        className={clsx(
          "my-auto w-8 mx-auto hover:fill-gold/50 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all",
          { "pointer-events-none fill-gold/50": !selectedResource },
        )}
        onClick={() => {
          setSelectedResource("");
          onSelect(null);
        }}
      />
      <Select
        open={open}
        onOpenChange={handleOpenChange}
        value={selectedResource}
        onValueChange={(value) => {
          setSelectedResource(value);
          onSelect(value ? parseInt(value) : null);
          setOpen(false);
          setSearchInput("");
        }}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder="Select a resource" />
        </SelectTrigger>
        <SelectContent>
          <div className="p-2">
            <TextInput
              ref={inputRef}
              onChange={setSearchInput}
              placeholder="Filter resources..."
              onKeyDown={handleKeyDown}
            />
          </div>
          {filteredResourceIds.map((resourceId) => (
            <SelectItem key={resourceId} value={resourceId.toString()}>
              <div className="flex items-center">
                <ResourceIcon resource={ResourcesIds[resourceId]} size="md" />
                <span className="ml-2">{ResourcesIds[resourceId]}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
