import { getResourceBalance } from "@/hooks/helpers/useResources";
import { ID, resources } from "@bibliothecadao/eternum";
import { XIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { divideByPrecision } from "../ui/utils/utils";
import Button from "./elements/Button";
import ListSelect from "./elements/ListSelect";
import { NumberInput } from "./elements/NumberInput";
import { ResourceCost } from "./elements/ResourceCost";

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
  const { getBalance } = getResourceBalance();

  const unselectedResources = useMemo(
    () => resources.filter((res) => !selectedResourceIds.includes(res.id)),
    [selectedResourceIds],
  );

  const addResourceGive = () => {
    setSelectedResourceIds([...selectedResourceIds, unselectedResources[0].id]);
    setSelectedResourceAmounts({
      ...selectedResourceAmounts,
      [unselectedResources[0].id]: 1,
    });
  };

  return (
    <div className=" items-center col-span-4 space-y-2 p-3">
      {selectedResourceIds.map((id: any, index: any) => {
        const resource = getBalance(entity_id, id);
        const options = [resources.find((res) => res.id === id), ...unselectedResources].map((res: any) => ({
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
              className="overflow-hidden"
              options={options}
              value={selectedResourceIds[index]}
              onChange={(value) => {
                const updatedResourceIds = [...selectedResourceIds];
                updatedResourceIds[index] = value;
                setSelectedResourceIds(updatedResourceIds);
                setSelectedResourceAmounts({
                  ...selectedResourceAmounts,
                  [value]: 1,
                });
                // playResourceSound(value);
              }}
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
  const { getBalance } = getResourceBalance();

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
      [unselectedResources[0].id]: 1,
    });
  };

  return (
    <div className=" items-center col-span-4 space-y-2 p-3">
      {selectedResourceIds.map((id: any, index: any) => {
        const resource = getBalance(entity_id, id);
        const options = [resources.find((res) => res.id === id), ...unselectedResources].map((res: any) => ({
          id: res.id,
          label: (
            <ResourceCost resourceId={res.id} amount={divideByPrecision(getBalance(entity_id, res.id)?.balance || 0)} />
          ),
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
                  setSelectedResourceAmounts({
                    ...selectedResourceAmounts,
                    [value]: 1,
                  });
                  // playResourceSound(value);
                }}
              />
              <NumberInput
                className="h-14"
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
              {selectedResourceIds.length > 1 && (
                <Button
                  variant="red"
                  className="px-0"
                  onClick={() => {
                    const updatedResourceIds = selectedResourceIds.filter((_: any, i: any) => i !== index);
                    setSelectedResourceIds(updatedResourceIds);
                    const { [id]: _, ...updatedAmounts } = selectedResourceAmounts;
                    setSelectedResourceAmounts(updatedAmounts);
                  }}
                  size="xs"
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
  const { getBalance } = getResourceBalance();

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
      [unselectedResources[0].id]: 1,
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
