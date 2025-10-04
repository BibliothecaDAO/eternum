import React from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import Button from "@/ui/design-system/atoms/button";
import { DropdownList, FormField } from "@/ui/design-system/molecules";

import type { EntityTypeOption, SelectedEntity, TransferEntityOption } from "../lib/transfer-types";

interface TransferEntityPickerProps {
  mode: "source" | "destination";
  title: string;
  selectedEntity: SelectedEntity | null;
  description?: string;
  entityTypeOptions: EntityTypeOption[];
  selectedEntityType: string;
  onEntityTypeChange: (value: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  debouncedSearchTerm: string;
  filteredEntities: TransferEntityOption[];
  onSelectEntity: (entity: TransferEntityOption) => void;
  onResetSelection?: () => void;
  isPaused?: boolean;
}

const CONTROL_CLASSNAME =
  "w-full p-2 transition-all duration-300 focus:outline-none border border-gold/20 rounded-lg bg-black/20 placeholder:text-gold/50 focus:ring-2 focus:ring-gold/30";

export const TransferEntityPicker: React.FC<TransferEntityPickerProps> = ({
  mode,
  title,
  selectedEntity,
  description,
  entityTypeOptions,
  selectedEntityType,
  onEntityTypeChange,
  searchTerm,
  onSearchTermChange,
  debouncedSearchTerm,
  filteredEntities,
  onSelectEntity,
  onResetSelection,
  isPaused,
}) => {
  if (selectedEntity) {
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4 bg-black/20 border border-gold/20 rounded-md px-4 py-3">
          <div>
            <h4 className="text-base font-semibold">
              {title}: {selectedEntity.name} ({selectedEntity.entityId})
            </h4>
            {mode === "source" && isPaused && <span className="text-red text-xs">(PAUSED)</span>}
          </div>
          {onResetSelection && (
            <Button onClick={onResetSelection} variant="outline" size="xs">
              Change {title}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-black/20 border border-gold/20 rounded-md px-4 py-4">
      <h4 className="mb-2 text-base font-semibold">Select {title}</h4>
      {description && <p className="text-xs text-gold/70 mb-3">{description}</p>}

      <FormField label="Entity Type">
        <Select value={selectedEntityType} onValueChange={onEntityTypeChange}>
          <SelectTrigger className="w-full mb-2">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {entityTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {selectedEntityType && (
        <>
          <FormField
            label="Search"
            description={`Look up a ${selectedEntityType.toLowerCase()} by name or ID.`}
            spacing="tight"
          >
            <input
              type="text"
              placeholder={`Search ${selectedEntityType.toLowerCase()}...`}
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredEntities.length > 0) {
                  event.preventDefault();
                  onSelectEntity(filteredEntities[0]);
                }
              }}
              className={CONTROL_CLASSNAME}
            />
          </FormField>

          <DropdownList className="mt-2">
            <Select
              onValueChange={(value) => {
                const entity = filteredEntities.find((item) => item.entityId.toString() === value);
                if (entity) {
                  onSelectEntity(entity);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Select a ${selectedEntityType.toLowerCase().slice(0, -1)}`} />
              </SelectTrigger>
              <SelectContent>
                {searchTerm.length > 0 && searchTerm.length < 2 && (
                  <div className="px-2 py-1 text-xs text-gold/50">Type at least 2 characters to search...</div>
                )}
                {debouncedSearchTerm !== searchTerm && (
                  <div className="px-2 py-1 text-xs text-gold/50">Searching...</div>
                )}
                {filteredEntities.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-gold/50">No entities found</div>
                ) : (
                  <>
                    {filteredEntities.map((entity) => (
                      <SelectItem key={entity.entityId.toString()} value={entity.entityId.toString()}>
                        {entity.name} {entity.accountName && `(${entity.accountName})`}
                      </SelectItem>
                    ))}
                    {filteredEntities.length === 50 && (
                      <div className="px-2 py-1 text-xs text-gold/50 italic">
                        Showing first 50 results. Refine your search for more precise matches.
                      </div>
                    )}
                  </>
                )}
              </SelectContent>
            </Select>
          </DropdownList>
        </>
      )}
    </div>
  );
};
