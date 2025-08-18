import { usePlayResourceSound } from "@/hooks/helpers/use-ui-sound";
import { getIsBlitz } from "@bibliothecadao/eternum";

import { Button, ListSelect, NumberInput } from "@/ui/design-system/atoms";
import { ResourceCost } from "@/ui/design-system/molecules";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  canTransferMilitaryResources,
  divideByPrecision,
  getBalance,
  isMilitaryResource,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getResourceTiers, ID, resources, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";

export const SelectResources = ({
  selectedResourceIds,
  setSelectedResourceIds,
  selectedResourceAmounts,
  setSelectedResourceAmounts,
  entity_id,
  toEntityId,
}: {
  selectedResourceIds: any;
  setSelectedResourceIds: any;
  selectedResourceAmounts: any;
  setSelectedResourceAmounts: any;
  entity_id: ID;
  toEntityId: ID;
}) => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const { playResourceSound } = usePlayResourceSound();

  const canTransferMilitary = useMemo(() => {
    return canTransferMilitaryResources(entity_id, toEntityId, dojo.setup.components);
  }, [entity_id, toEntityId, dojo.setup.components]);

  const orderedResources = useMemo(() => {
    return Object.values(getResourceTiers(getIsBlitz()))
      .flat()
      .map((resourceId) => ({
        id: resourceId,
        trait: ResourcesIds[resourceId],
      }))
      .filter((res) => {
        return canTransferMilitary || !isMilitaryResource(res.id);
      });
  }, [canTransferMilitary]);

  const unselectedResources = useMemo(
    () => orderedResources.filter((res) => !selectedResourceIds.includes(res.id)),
    [selectedResourceIds],
  );

  const addResourceGive = () => {
    setSelectedResourceIds([...selectedResourceIds, unselectedResources[0].id]);
    setSelectedResourceAmounts({
      ...selectedResourceAmounts,
      [unselectedResources[0].id]: 1,
    });
    playResourceSound(unselectedResources[0].id);
  };

  return (
    <div className="items-center col-span-4 space-y-2 p-3">
      {!canTransferMilitary && (
        <div className="bg-red-500/20 border border-red-500/40 p-3 rounded-md mb-4">
          <p className="text-red-400 text-sm">
            Military resources can only be transferred between a village and its connected realm.
          </p>
        </div>
      )}
      {selectedResourceIds.map((id: any, index: any) => {
        const resource = getBalance(entity_id, id, currentDefaultTick, dojo.setup.components);

        const options = [orderedResources.find((res) => res.id === id), ...unselectedResources].map((res: any) => ({
          id: res.id,
          label: (
            <ResourceCost
              resourceId={res.id}
              amount={divideByPrecision(
                getBalance(entity_id, res.id, currentDefaultTick, dojo.setup.components)?.balance || 0,
              )}
            />
          ),
        }));

        return (
          <div key={id} className="flex items-center gap-4">
            {selectedResourceIds.length > 1 && (
              <Button
                variant="red"
                onClick={() => {
                  const updatedResourceIds = selectedResourceIds.filter((_: any, i: any) => i !== index);
                  setSelectedResourceIds(updatedResourceIds);
                  const { [id]: _, ...updatedAmounts } = selectedResourceAmounts;
                  setSelectedResourceAmounts(updatedAmounts);
                }}
              >
                Remove
              </Button>
            )}
            <ListSelect
              options={options.map((option) => ({
                ...option,
                searchText: resources.find((res) => res.id === option.id)?.trait,
              }))}
              value={selectedResourceIds[index]}
              onChange={(value) => {
                const updatedResourceIds = [...selectedResourceIds];
                updatedResourceIds[index] = value;
                setSelectedResourceIds(updatedResourceIds);
                setSelectedResourceAmounts({
                  ...selectedResourceAmounts,
                  [value]: 1,
                });
                playResourceSound(value);
              }}
              enableFilter={true}
            />
            <NumberInput
              className="h-14 "
              max={divideByPrecision(resource?.balance || 0)}
              min={1}
              value={selectedResourceAmounts[id]}
              onChange={(value) => {
                setSelectedResourceAmounts({
                  ...selectedResourceAmounts,
                  [id]: Math.min(divideByPrecision(resource?.balance || 0), value),
                });
              }}
            />
          </div>
        );
      })}
      <div className="mt-12">
        <Button variant="primary" size="md" onClick={addResourceGive}>
          Add Resource
        </Button>
      </div>
    </div>
  );
};
