import { useRealm } from "@/hooks/helpers/useRealm";
import Button from "@/ui/elements/Button";
import { ID } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { memo } from "react";

interface Entity {
  entity_id: ID;
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
    const { getRealmAddressName } = useRealm();

    return (
      <div className="overflow-y-scroll max-h-72 border border-gold/10 gap-2 flex-col">
        {entities.map((entity) => {
          const isSelected = selectedEntityId === entity.entity_id;
          const isDisabled = isSelected || selectedCounterpartyId === entity.entity_id;
          const realmName = getRealmAddressName(entity.entity_id);

          return (
            <div
              key={entity.entity_id}
              className={clsx(
                "flex w-full justify-between hover:bg-white/10 items-center p-1 text-xs pl-2",
                isSelected && "border-gold/10 border",
              )}
              onClick={() => onSelect(entity.name, entity.entity_id)}
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
