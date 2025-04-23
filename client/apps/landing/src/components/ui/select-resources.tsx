import { useResourceBalance } from "@/hooks/helpers/use-resources";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { ID, resources } from "@bibliothecadao/types";
import { XIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "./button";
import ListSelect from "./elements/list-select";
import { NumberInput } from "./elements/number-input";
import { ResourceCost } from "./elements/resource-cost";

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
  const { getBalance } = useResourceBalance({ entityId: entity_id });

  const unselectedResources = useMemo(
    () => resources.filter((res) => !selectedResourceIds.includes(res.id)),
    [selectedResourceIds],
  );

  const addResourceGive = () => {
    setSelectedResourceIds([...selectedResourceIds, unselectedResources[0].id]);
    setSelectedResourceAmounts({
      ...selectedResourceAmounts,
      [unselectedResources[0].id]: divideByPrecision(getBalance(unselectedResources[0].id) || 0),
    });
  };

  return (
    <div className=" items-center col-span-4 space-y-2 p-3">
      {selectedResourceIds.map((id: any, index: any) => {
        const balance = getBalance(id);
        const options = [resources.find((res) => res.id === id), ...unselectedResources]
          .filter((res) => getBalance(res?.id || 0) > 0)
          .map((res: any) => ({
            id: res.id,
            label: <ResourceCost resourceId={res.id} amount={divideByPrecision(getBalance(res.id) || 0)} />,
          }));

        return (
          <div key={id} className="flex items-center gap-4">
            {selectedResourceIds.length > 1 && (
              <Button
                variant="destructive"
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
              className="overflow-hidden h-10"
              options={options}
              value={selectedResourceIds[index]}
              onChange={(value) => {
                const updatedResourceIds = [...selectedResourceIds];
                updatedResourceIds[index] = value;
                setSelectedResourceIds(updatedResourceIds);

                // Remove the old resource amount and set the new one
                const { [selectedResourceIds[index]]: _, ...remainingAmounts } = selectedResourceAmounts;
                setSelectedResourceAmounts({
                  ...remainingAmounts,
                  [value]: divideByPrecision(getBalance(value) || 0),
                });
              }}
            />
            <NumberInput
              className="h-10"
              max={divideByPrecision(balance || 0)}
              min={1}
              value={selectedResourceAmounts[id]}
              onChange={(value) => {
                setSelectedResourceAmounts({
                  ...selectedResourceAmounts,
                  [id]: Math.min(divideByPrecision(balance || 0), value),
                });
              }}
            />
          </div>
        );
      })}
      <div className="mt-12">
        <Button variant="default" onClick={addResourceGive}>
          Add Resourceabcd
        </Button>
      </div>
    </div>
  );
};

export const SelectSingleResource = ({
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
  const { getBalance } = useResourceBalance({ entityId: entity_id });

  const unselectedResources = useMemo(
    () => resources.filter((res) => !selectedResourceIds.includes(res.id)),
    [selectedResourceIds],
  );

  useEffect(() => {
    if (selectedResourceIds.length === 0) {
      addResourceGive();
    }
  }, [selectedResourceIds]);

  const addResourceGive = () => {
    setSelectedResourceIds([...selectedResourceIds, unselectedResources[0].id]);
    setSelectedResourceAmounts({
      ...selectedResourceAmounts,
      [unselectedResources[0].id]: divideByPrecision(getBalance(unselectedResources[0].id) || 0),
    });
  };

  return (
    <div className=" items-center col-span-4 space-y-2 p-3">
      {selectedResourceIds.map((id: any, index: any) => {
        const resourceBalance = getBalance(id);
        const options = [resources.find((res) => res.id === id), ...unselectedResources]
          .filter((res) => getBalance(res?.id || 0) > 0)
          .map((res: any) => ({
            id: res.id,
            label: <ResourceCost resourceId={res.id} amount={divideByPrecision(getBalance(res.id) || 0)} />,
          }));

        return (
          <>
            <div key={id} className="flex items-center gap-4">
              <ListSelect
                className="overflow-hidden"
                options={options}
                value={selectedResourceIds[index]}
                onChange={(value) => {
                  const updatedResourceIds = [...selectedResourceIds];
                  updatedResourceIds[index] = value;
                  setSelectedResourceIds(updatedResourceIds);

                  // Remove the old resource amount and set the new one
                  const { [selectedResourceIds[index]]: _, ...remainingAmounts } = selectedResourceAmounts;
                  setSelectedResourceAmounts({
                    ...remainingAmounts,
                    [value]: divideByPrecision(getBalance(value) || 0),
                  });
                }}
              />
              <NumberInput
                className="h-14"
                max={divideByPrecision(resourceBalance || 0)}
                min={1}
                value={selectedResourceAmounts[id]}
                onChange={(value) => {
                  setSelectedResourceAmounts({
                    ...selectedResourceAmounts,
                    [id]: Math.min(divideByPrecision(resourceBalance || 0), value),
                  });
                }}
              />
              {selectedResourceIds.length > 1 && (
                <Button
                  variant="destructive"
                  className="px-0"
                  onClick={() => {
                    const updatedResourceIds = selectedResourceIds.filter((_: any, i: any) => i !== index);
                    setSelectedResourceIds(updatedResourceIds);
                    const { [id]: _, ...updatedAmounts } = selectedResourceAmounts;
                    setSelectedResourceAmounts(updatedAmounts);
                  }}
                  size="sm"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          </>
        );
      })}
    </div>
  );
};

export const ShowSingleResource = ({
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
  const { getBalance } = useResourceBalance({ entityId: entity_id });

  const unselectedResources = useMemo(
    () => resources.filter((res) => !selectedResourceIds.includes(res.id)),
    [selectedResourceIds],
  );

  useEffect(() => {
    if (selectedResourceIds.length === 0) {
      addResourceGive();
    }
  }, [selectedResourceIds]);

  const addResourceGive = () => {
    setSelectedResourceIds([...selectedResourceIds, unselectedResources[0].id]);
    setSelectedResourceAmounts({
      ...selectedResourceAmounts,
      [unselectedResources[0].id]: divideByPrecision(getBalance(unselectedResources[0].id) || 0),
    });
  };

  return (
    <div className=" items-center col-span-2 space-y-2 p-3">
      <ResourceCost
        resourceId={selectedResourceIds[0]}
        amount={selectedResourceAmounts[selectedResourceIds[0]]}
        size="lg"
      />
    </div>
  );
};
