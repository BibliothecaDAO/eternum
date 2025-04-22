import Button from "@/ui/elements/button";
import { getAddressNameFromEntity } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import clsx from "clsx";
import { memo } from "react";

interface Entity {
  entityId: ID;
  name: string;
}

interface SelectEntityFromListProps {
  onSelect: (name: string, entityId: ID) => void;
  selectedEntityId: ID | null;
  selectedCounterpartyId: ID | null;
  entities: Entity[];
}

export const SelectEntityFromList = memo(
  ({ onSelect, selectedEntityId, selectedCounterpartyId, entities }: SelectEntityFromListProps) => {
    const {
      setup: { components },
    } = useDojo();

    return (
      <div className="overflow-y-auto max-h-72 border border-gold/10 gap-2 flex-col">
        {entities.map((entity) => {
          const isSelected = selectedEntityId === entity.entityId;
          const isDisabled = isSelected || selectedCounterpartyId === entity.entityId;
          const realmName = getAddressNameFromEntity(entity.entityId, components);

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
                {realmName} ({entity.name})
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
