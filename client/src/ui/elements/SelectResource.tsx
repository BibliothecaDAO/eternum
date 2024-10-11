import { ReactComponent as Cross } from "@/assets/icons/common/cross.svg";
import { ResourcesIds } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useRef, useState } from "react";
import { ResourceIcon } from "./ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import TextInput from "./TextInput";

interface SelectResourceProps {
  onSelect: (resourceId: number | null) => void;
  className?: string;
}

export const SelectResource: React.FC<SelectResourceProps> = ({ onSelect, className }) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const resourceIds = Object.values(ResourcesIds)
    .filter((resource) => resource !== ResourcesIds.AncientFragment && resource !== ResourcesIds.Lords)
    .filter((resource) => typeof resource === "number");

  const filteredResourceIds = resourceIds.filter((resourceId) =>
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
          <TextInput
            ref={inputRef}
            onChange={setSearchInput}
            placeholder="Filter resources..."
            className="w-full"
            onKeyDown={handleKeyDown}
          />
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
