import { useEntities } from "@/hooks/helpers/useEntities";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { usePlayResourceSound } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import ListSelect from "@/ui/elements/ListSelect";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";

enum STEP_ID {
  SELECT_ENTITY_FROM = 1,
  SELECT_ENTITY_TO = 2,
  SELECT_RESOURCES = 3,
}
const STEPS = [
  {
    id: STEP_ID.SELECT_ENTITY_FROM,
    title: "Select entity you want to transfer from",
  },
  {
    id: STEP_ID.SELECT_ENTITY_TO,
    title: "Select entity you want to transfer to",
  },
  {
    id: STEP_ID.SELECT_RESOURCES,
    title: "Select resources to transfer",
  },
];

export const TransferBetweenEntities = () => {
  const [selectedEntityIdFrom, setSelectedEntityIdFrom] = useState<bigint | null>(null);
  const [selectedEntityIdTo, setSelectedEntityIdTo] = useState<bigint | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState({});

  const selectedStep = useMemo(() => {
    if (!selectedEntityIdFrom) return STEPS.find((step) => step.id === STEP_ID.SELECT_ENTITY_FROM);
    if (!selectedEntityIdTo) return STEPS.find((step) => step.id === STEP_ID.SELECT_ENTITY_TO);
    return STEPS.find((step) => step.id === STEP_ID.SELECT_RESOURCES);
  }, [selectedEntityIdFrom, selectedEntityIdTo]);

  return (
    <div className="p-2">
      <div className="text-center">{selectedStep?.title}</div>
      {selectedStep?.id === STEP_ID.SELECT_ENTITY_FROM && <SelectEntityFromList onSelect={setSelectedEntityIdFrom} />}
      {selectedStep?.id === STEP_ID.SELECT_ENTITY_TO && <SelectEntityToList onSelect={setSelectedEntityIdTo} />}
      {selectedStep?.id === STEP_ID.SELECT_RESOURCES && (
        <SelectResoruces
          selectedResourceIds={selectedResourceIds}
          setSelectedResourceIds={setSelectedResourceIds}
          selectedResourceAmounts={selectedResourceAmounts}
          setSelectedResourceAmounts={setSelectedResourceAmounts}
          entity_id={selectedEntityIdFrom!}
        />
      )}
    </div>
  );
};

const SelectEntityFromList = ({ onSelect }: { onSelect: (entityId: bigint) => void }) => {
  const { playerRealms } = useEntities();
  return (
    <div>
      {playerRealms().map((realm) => (
        <div className="flex justify-between rounded-md hover:bg-white/10 items-center border-b h-8 border-black px-1 text-lightest text-xs">
          <div>{realm.name}</div>
          <Button size="xs" variant="success" onClick={() => onSelect(realm.realm_id!)}>
            Select
          </Button>
        </div>
      ))}
    </div>
  );
};

const SelectEntityToList = ({ onSelect }: { onSelect: (entityId: bigint) => void }) => {
  const { playerRealms } = useEntities();
  return (
    <div>
      {playerRealms().map((realm) => (
        <div className="flex justify-between rounded-md hover:bg-white/10 items-center border-b h-8 border-black px-1 text-lightest text-xs">
          <div>{realm.name}</div>
          <Button size="xs" variant="success" onClick={() => onSelect(realm.realm_id!)}>
            Select
          </Button>
        </div>
      ))}
    </div>
  );
};

const SelectResoruces = ({
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
  entity_id: bigint;
}) => {
  const { getBalance } = useResourceBalance();
  const { playResourceSound } = usePlayResourceSound();

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
    playResourceSound(unselectedResources[0].id);
  };

  return (
    <div className="flex flex-col items-center col-span-4 space-y-2">
      {selectedResourceIds.map((id: any, index: any) => {
        const resource = getBalance(entity_id, id);
        let options = [resources.find((res) => res.id === id), ...unselectedResources] as any;
        options = options.map((res: any) => {
          const bal = getBalance(entity_id, res.id);
          return {
            id: res.id,
            label: <ResourceCost resourceId={res.id} amount={divideByPrecision(bal?.balance || 0)} />,
          };
        });
        if (selectedResourceIds.length > 1) {
          options = [
            {
              id: 0,
              label: (
                <div className="flex items-center justify-center">
                  <div className="ml-1 text-danger">Remove item</div>
                </div>
              ),
            },
            ...options,
          ];
        }
        return (
          <div key={id} className="flex items-center w-[300px]">
            <NumberInput
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
            <ListSelect
              className="ml-2 rounded-md overflow-hidden"
              style="black"
              options={options}
              value={selectedResourceIds[index]}
              onChange={(value) => {
                if (value === 0) {
                  const tmp = [...selectedResourceIds];
                  tmp.splice(index, 1);
                  setSelectedResourceIds(tmp);
                  const tmpAmounts = { ...selectedResourceAmounts };
                  delete tmpAmounts[id];
                  setSelectedResourceAmounts(tmpAmounts);
                  return;
                }
                const tmp = [...selectedResourceIds];
                tmp[index] = value;
                playResourceSound(value);
                setSelectedResourceIds(tmp);
                setSelectedResourceAmounts({
                  ...selectedResourceAmounts,
                  [value]: 1,
                });
              }}
            />
          </div>
        );
      })}
      <Button
        className="w-full"
        variant="primary"
        size="md"
        onClick={() => {
          addResourceGive();
        }}
      >
        Add Resource
      </Button>
      <Button className="w-full" variant="primary" size="md" onClick={() => {}}>
        Confirm
      </Button>
    </div>
  );
};
