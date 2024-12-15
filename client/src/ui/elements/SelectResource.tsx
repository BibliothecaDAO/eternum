import { ReactComponent as Cross } from "@/assets/icons/common/cross.svg";
import { RESOURCE_TIERS, ResourcesIds } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useMemo, useRef, useState } from "react";
import { ResourceIcon } from "./ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import TextInput from "./TextInput";

interface SelectResourceProps {
  onSelect: (resourceId: number | null) => void;
  className?: string;
  realmProduction?: boolean;
}

export const SelectResource: React.FC<SelectResourceProps> = ({ onSelect, className, realmProduction = false }) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedResource, setSelectedResource] = useState<string>("");
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
  ];

  const orderedResources = useMemo(() => {
    return Object.values(RESOURCE_TIERS)
      .flat()
      .filter((resourceId) => {
        if (resourceId === ResourcesIds.Lords) return false;
        if (realmProduction && REALM_PRODUCTION_EXCLUDED.includes(resourceId)) return false;
        return true;
      });
  }, [realmProduction]);

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

  return (
    <div className="flex items-center">
      <Cross
        className={clsx(
          "my-auto w-8 mx-auto hover:fill-gold/50 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all",
          { "pointer-events-none fill-gold/50": !selectedResource },
        )}
        onClick={() => setSelectedResource("")}
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
