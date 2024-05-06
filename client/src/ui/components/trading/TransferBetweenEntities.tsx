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
import { Headline } from "@/ui/elements/Headline";

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

export const TransferBetweenEntities = ({ entities }: { entities: any[] }) => {
  const [selectedEntityIdFrom, setSelectedEntityIdFrom] = useState<bigint | null>(null);
  const [selectedEntityIdTo, setSelectedEntityIdTo] = useState<bigint | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});
  const [selectedStepId, setSelectedStepId] = useState(STEP_ID.SELECT_ENTITIES);
  const [isLoading, setIsLoading] = useState(false);
  const [canCarry, setCanCarry] = useState(true);
  const [isOriginDonkeys, setIsOriginDonkeys] = useState(true);

  const currentStep = useMemo(() => STEPS.find((step) => step.id === selectedStepId), [selectedStepId]);

  const {
    account: { account },
    setup: {
      systemCalls: { send_resources, pickup_resources },
    },
  } = useDojo();

  const onSendResources = () => {
    setIsLoading(true);
    const resourcesList = selectedResourceIds.flatMap((id: number) => [
      Number(id),
      multiplyByPrecision(selectedResourceAmounts[Number(id)]),
    ]);
    const systemCall = !isOriginDonkeys
      ? pickup_resources({
          signer: account,
          owner_entity_id: selectedEntityIdFrom!,
          recipient_entity_id: selectedEntityIdTo!,
          resources: resourcesList || [],
        })
      : send_resources({
          // pickup_resources is not defined in the snippet
          signer: account,
          sender_entity_id: selectedEntityIdFrom!,
          recipient_entity_id: selectedEntityIdTo!,
          resources: resourcesList || [],
        });

    systemCall.finally(() => {
      setIsLoading(false);
    });
  };

  const toggleDonkeyOrigin = () => {
    setIsOriginDonkeys(!isOriginDonkeys);
  };

  return (
    <div className="p-2">
      <h4 className="text-center capitalize mb-5">{currentStep?.title}</h4>

      {currentStep?.id === STEP_ID.SELECT_RESOURCES && (
        <div className="w-full flex justify-center">
          {" "}
          <Button className="m-2" variant="outline" size="xs" onClick={toggleDonkeyOrigin}>
            Toggle Donkey Origin: {isOriginDonkeys ? "Origin" : "Destination"}
          </Button>
        </div>
      )}

      {currentStep?.id === STEP_ID.SELECT_ENTITIES && (
        <>
          <div className="grid grid-cols-2 gap-6 mt-3">
            <div className="justify-around">
              <Headline>From</Headline>
              <SelectEntityFromList
                onSelect={setSelectedEntityIdFrom}
                selectedCounterpartyId={selectedEntityIdTo}
                selectedEntityId={selectedEntityIdFrom}
                entities={entities}
              />
            </div>
            <div className="justify-around">
              <Headline>To</Headline>
              <SelectEntityFromList
                onSelect={setSelectedEntityIdTo}
                selectedCounterpartyId={selectedEntityIdFrom}
                selectedEntityId={selectedEntityIdTo}
                entities={entities}
              />
            </div>
          </div>
          <div className="flex justify-center w-full">
            <Button
              className="w-full mt-2"
              disabled={!selectedEntityIdFrom || !selectedEntityIdTo}
              variant="primary"
              size="md"
              onClick={() => {
                setSelectedStepId(STEP_ID.SELECT_RESOURCES);
              }}
            >
              Next - Select Resources
            </Button>
          </div>
        </>
      )}
      {currentStep?.id === STEP_ID.SELECT_RESOURCES && (
        <>
          <SelectResources
            selectedResourceIds={selectedResourceIds}
            setSelectedResourceIds={setSelectedResourceIds}
            selectedResourceAmounts={selectedResourceAmounts}
            setSelectedResourceAmounts={setSelectedResourceAmounts}
            entity_id={selectedEntityIdFrom!}
          />
          <div className="flex flex-col w-full items-center my-4">
            <ResourceWeightsInfo
              entityId={isOriginDonkeys ? selectedEntityIdFrom! : selectedEntityIdTo!}
              resources={selectedResourceIds.map((resourceId: number) => ({
                resourceId,
                amount: selectedResourceAmounts[resourceId],
              }))}
              setCanCarry={setCanCarry}
            />
          </div>
          <Button
            className="w-full mt-2"
            isLoading={isLoading}
            disabled={!canCarry || selectedResourceIds.length === 0}
            variant="primary"
            size="md"
            onClick={onSendResources}
          >
            Confirm
          </Button>
        </>
      )}
    </div>
  );
};

const SelectEntityFromList = ({
  onSelect,
  selectedEntityId,
  selectedCounterpartyId,
  entities,
}: {
  onSelect: (entityId: bigint) => void;
  selectedEntityId: bigint | null;
  selectedCounterpartyId: bigint | null;
  entities: any[];
}) => {
  return (
    <div>
      {entities.map((entity) => (
        <div
          className={clsx(
            "flex w-full justify-between hover:bg-white/10 items-center  p-1  text-xs my-3 pl-2",
            selectedEntityId === entity.entity_id && "border-order-brilliance/40 border",
          )}
        >
          <h6 className="text-sm">{entity.name}</h6>
          <Button
            disabled={selectedEntityId === entity.entity_id || selectedCounterpartyId === entity.entity_id}
            size="md"
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
          <div key={id} className="flex items-center w-[300px] gap-3">
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
    </div>
  );
};
