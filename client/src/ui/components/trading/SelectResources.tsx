import { useResourceBalance } from "@/hooks/helpers/useResources";
import { usePlayResourceSound } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import ListSelect from "@/ui/elements/ListSelect";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { ID, RESOURCE_TIERS, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const SelectResources = ({
  selectedResourceIds,
  setSelectedResourceIds,
  selectedResourceAmounts,
  setSelectedResourceAmounts,
  entity_id,
}: {
  selectedResourceIds: any;
  setSelectedResourceIds: any;
  selectedResourceAmounts: any;
  setSelectedResourceAmounts: any;
  entity_id: ID;
}) => {
  const { getBalance } = useResourceBalance();
  const { playResourceSound } = usePlayResourceSound();

  const orderedResources = useMemo(() => {
    return Object.values(RESOURCE_TIERS)
      .flat()
      .map((resourceId) => ({
        id: resourceId,
        trait: ResourcesIds[resourceId],
      }));
  }, []);

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
      {selectedResourceIds.map((id: any, index: any) => {
        const resource = getBalance(entity_id, id);

        const options = [orderedResources.find((res) => res.id === id), ...unselectedResources].map((res: any) => ({
          id: res.id,
          label: (
            <ResourceCost resourceId={res.id} amount={divideByPrecision(getBalance(entity_id, res.id)?.balance || 0)} />
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
