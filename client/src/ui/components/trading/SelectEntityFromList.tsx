import { useRealm } from "@/hooks/helpers/useRealm";
import Button from "@/ui/elements/Button";
import { ID } from "@bibliothecadao/eternum";
import clsx from "clsx";

export const SelectEntityFromList = ({
  onSelect,
  selectedEntityId,
  selectedCounterpartyId,
  entities,
}: {
  onSelect: (name: string, entityId: ID) => void;
  selectedEntityId: ID | null;
  selectedCounterpartyId: ID | null;
  entities: any[];
}) => {
  const { getRealmAddressName } = useRealm();

  return (
    <div className="overflow-y-scroll max-h-72 border border-gold/10 gap-2 flex-col">
      {entities.map((entity, index) => {
        const realmName = getRealmAddressName(entity.entity_id);
        return (
          <div
            key={index}
            className={clsx(
              "flex w-full justify-between hover:bg-white/10 items-center p-1 text-xs pl-2",
              selectedEntityId === entity.entity_id && "border-gold/10 border",
            )}
            onClick={() => onSelect(entity.name, entity.entity_id!)}
          >
            <div className="font-serif text-lg">
              {realmName} ({entity.name})
            </div>
            <Button
              disabled={selectedEntityId === entity.entity_id || selectedCounterpartyId === entity.entity_id}
              size="md"
              variant="outline"
            >
              {selectedEntityId === entity.entity_id ? "Selected" : "Select"}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
