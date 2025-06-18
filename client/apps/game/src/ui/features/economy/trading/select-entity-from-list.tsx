import Button from "@/ui/elements/button";
import { ID } from "@bibliothecadao/types";
import clsx from "clsx";
import { memo } from "react";

interface Entity {
  entityId: ID;
  name: string;
  accountName: string | undefined;
}

interface SelectEntityFromListProps {
  onSelect: (name: string, entityId: ID) => void;
  selectedEntityId: ID | null;
  selectedCounterpartyId: ID | null;
  entities: Entity[];
}

export const SelectEntityFromList = memo(
  ({ onSelect, selectedEntityId, selectedCounterpartyId, entities }: SelectEntityFromListProps) => {
    return (
      <div className="overflow-y-auto max-h-72 border border-gold/10 gap-2 flex-col">
        {entities.map((entity) => {
          const isSelected = selectedEntityId === entity.entityId;
          const isDisabled = isSelected || selectedCounterpartyId === entity.entityId;

          return (
            <div
              key={entity.entityId}
              className={clsx(
                "flex w-full justify-between hover:bg-gold/5 items-center p-1 text-xs pl-2",
                isSelected && "border-gold/10 border",
              )}
              onClick={() => onSelect(entity.name, entity.entityId)}
            >
              <div className="font-serif text-lg">
                {entity.accountName} ({entity.name})
              </div>
              <Button disabled={isDisabled} size="md" variant="outline">
                {isSelected ? "Selected" : "Select"}
              </Button>
            </div>
          );
        })}
      </div>
    );
  },
);
