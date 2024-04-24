import { useEntities } from "@/hooks/helpers/useEntities";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { usePlayResourceSound } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import ListSelect from "@/ui/elements/ListSelect";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { resources } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { ResourceWeightsInfo } from "../resources/ResourceWeight";
import { useDojo } from "@/hooks/context/DojoContext";

enum STEP_ID {
  SELECT_ENTITIES = 1,
  SELECT_RESOURCES = 2,
}
const STEPS = [
  {
    id: STEP_ID.SELECT_ENTITIES,
    title: "Select entities you want to transfer between",
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
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});
  const [selectedStepId, setSelectedStepId] = useState(STEP_ID.SELECT_ENTITIES);

  const currentStep = useMemo(() => STEPS.find((step) => step.id === selectedStepId), [selectedStepId]);
  const { playerRealms, playerAccounts } = useEntities();

  return (
    <div className="p-2">
      <div className="text-center">{currentStep?.title}</div>
      {currentStep?.id === STEP_ID.SELECT_ENTITIES && (
        <div className="flex flex-col mt-3">
          <div className="flex justify-around">
            <div>From</div>
            <div>To</div>
          </div>
          <div className="flex justify-around">
            <SelectEntityFromList
              onSelect={setSelectedEntityIdFrom}
              selectedEntityId={selectedEntityIdFrom}
              entities={[...playerRealms(), ...playerAccounts()]}
            />
            <SelectEntityFromList
              onSelect={setSelectedEntityIdTo}
              selectedEntityId={selectedEntityIdTo}
              entities={[...playerRealms(), ...playerAccounts()]}
            />
          </div>
          <Button
            className="w-full mt-2"
            disabled={!selectedEntityIdFrom || !selectedEntityIdTo}
            variant="primary"
            size="md"
            onClick={() => {
              setSelectedStepId(STEP_ID.SELECT_RESOURCES);
            }}
          >
            Next
          </Button>
        </div>
      )}
      {currentStep?.id === STEP_ID.SELECT_RESOURCES && (
        <SelectResources
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

const SelectEntityFromList = ({
  onSelect,
  selectedEntityId,
  entities,
}: {
  onSelect: (entityId: bigint) => void;
  selectedEntityId: bigint | null;
  entities: any[];
}) => {
  return (
    <div>
      {entities.map((entity) => (
        <div
          className={clsx(
            "flex w-[200px] justify-between rounded-md hover:bg-white/10 items-center border-b h-8 border-black px-2 text-lightest text-xs",
            selectedEntityId === entity.entity_id && "border-order-brilliance",
          )}
        >
          <div>{entity.name}</div>
          <Button
            disabled={selectedEntityId === entity.entity_id}
            size="xs"
            variant={"outline"}
            onClick={() => onSelect(entity.entity_id!)}
          >
            {selectedEntityId === entity.entity_id ? "Selected" : "Select"}
          </Button>
        </div>
      ))}
    </div>
  );
};

const SelectResources = ({
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
  const {
    account: { account },
    setup: {
      systemCalls: { send_resources },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();
  const { playResourceSound } = usePlayResourceSound();

  const [isLoading, setIsLoading] = useState(false);
  const [canCarry, setCanCarry] = useState(true);

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

  const onSendResources = async () => {
    setIsLoading(true);
    const resourcesList = selectedResourceIds.flatMap((id: number) => [
      Number(id),
      multiplyByPrecision(selectedResourceAmounts[Number(id)]),
    ]);
    console.log({ resourcesList, selectedResourceAmounts });
    await send_resources({
      signer: account,
      sender_entity_id: entity_id,
      // todo: change that
      recipient_entity_id: 0n,
      resources: resourcesList || [],
    });
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
        variant="primary"
        size="md"
        onClick={() => {
          addResourceGive();
        }}
      >
        Add Resource
      </Button>
      <ResourceWeightsInfo
        entityId={entity_id}
        resources={selectedResourceIds.map((resourceId) => ({
          resourceId,
          amount: selectedResourceAmounts[resourceId],
        }))}
        setCanCarry={setCanCarry}
      />
      <Button isLoading={isLoading} disabled={!canCarry} variant="primary" size="md" onClick={onSendResources}>
        Confirm
      </Button>
    </div>
  );
};
