import React, { useMemo } from "react";

import Button from "@/ui/design-system/atoms/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { FormField } from "@/ui/design-system/molecules";

import type { EntityTypeOption, SelectedEntity, TransferEntityOption } from "../lib/transfer-types";
import { StructureCard } from "./structure-card";
import { useStructurePreview } from "../lib/use-structure-preview";
import { toSelectedEntity } from "../lib/transfer-utils";

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
  "w-full rounded-lg border border-gold/20 bg-black/20 p-2 placeholder:text-gold/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gold/30";

const RESULTS_LIMIT = 12;

const ResultCard = ({
  entity,
  onSelect,
  tone,
}: {
  entity: TransferEntityOption;
  onSelect: () => void;
  tone: "source" | "destination";
}) => {
  const selected = toSelectedEntity(entity);
  const preview = useStructurePreview(selected);

  return (
    <StructureCard
      structure={selected}
      preview={preview}
      tone={tone}
      onSelect={onSelect}
      description={entity.accountName ? `Owner: ${entity.accountName}` : undefined}
    />
  );
};

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
  const tone = mode === "source" ? "source" : "destination";
  const selectedPreview = useStructurePreview(selectedEntity);
  const results = useMemo(() => filteredEntities.slice(0, RESULTS_LIMIT), [filteredEntities]);
  const showSearchHint = searchTerm.length > 0 && searchTerm.length < 2;
  const isSearching = debouncedSearchTerm !== searchTerm;

  if (selectedEntity) {
    return (
      <div className="mb-4 space-y-2">
        <StructureCard
          structure={selectedEntity}
          preview={selectedPreview}
          tone={tone}
          isActive
          headerAction={
            onResetSelection ? (
              <Button onClick={onResetSelection} variant="outline" size="xs">
                Change {title}
              </Button>
            ) : null
          }
          footer={
            mode === "source" ? (
              <span className={`text-[10px] uppercase ${isPaused ? "text-red" : "text-emerald-300"}`}>
                {isPaused ? "Automation paused" : "Automation active"}
              </span>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-md border border-gold/20 bg-black/25 px-4 py-4">
      <h4 className="mb-2 text-base font-semibold text-gold">Select {title}</h4>
      {description && <p className="mb-3 text-xs text-gold/70">{description}</p>}

      <FormField label="Entity Type">
        <Select value={selectedEntityType} onValueChange={onEntityTypeChange}>
          <SelectTrigger className="mb-2 w-full">
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

      {selectedEntityType ? (
        <div className="space-y-4">
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

          <div className="space-y-2 text-xs text-gold/60">
            {showSearchHint && <p>Type at least two characters to unlock search results.</p>}
            {isSearching && <p>Searching…</p>}
          </div>

          <div className="grid gap-3">
            {results.length === 0 && !isSearching && !showSearchHint && (
              <div className="rounded-md border border-gold/20 bg-black/30 px-3 py-4 text-center text-xs text-gold/60">
                No structures match your filters. Adjust the entity type or search with a different name.
              </div>
            )}

            {results.map((entity) => (
              <ResultCard
                key={`${entity.entityId}-${entity.category}`}
                entity={entity}
                tone={tone}
                onSelect={() => onSelectEntity(entity)}
              />
            ))}

            {filteredEntities.length > RESULTS_LIMIT && (
              <div className="rounded-md border border-gold/10 bg-black/20 px-3 py-2 text-[11px] text-gold/50">
                Showing the first {RESULTS_LIMIT} matches. Refine your search to narrow further.
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gold/60">Choose a structure type to browse available options.</p>
      )}
    </div>
  );
};
