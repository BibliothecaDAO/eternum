import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useTravel } from "@/hooks/helpers/useTravel";
import { usePlayResourceSound } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import ListSelect from "@/ui/elements/ListSelect";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import TextInput from "@/ui/elements/TextInput";
import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { EternumGlobalConfig, ID, resources } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { ArrowRight, LucideArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TravelInfo } from "../resources/ResourceWeight";
import { ToggleComponent } from "../toggle/ToggleComponent";

enum STEP_ID {
  SELECT_ENTITIES = 1,
  SELECT_RESOURCES = 2,
  SUCCESS = 3,
}
const STEPS = [
  {
    id: STEP_ID.SELECT_ENTITIES,
    title: "Select transfer",
  },
  {
    id: STEP_ID.SELECT_RESOURCES,
    title: "Select resources to transfer",
  },
  {
    id: STEP_ID.SUCCESS,
    title: "Transfer successful",
  },
];

interface SelectedEntity {
  name: string;
  entityId: ID;
}

export const TransferBetweenEntities = ({ entitiesList }: { entitiesList: { entities: any[]; name: string }[] }) => {
  const { getRealmAddressName } = useRealm();

  const [selectedEntityIdFrom, setSelectedEntityIdFrom] = useState<SelectedEntity | null>(null);
  const [selectedEntityIdTo, setSelectedEntityIdTo] = useState<SelectedEntity | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});
  const [selectedStepId, setSelectedStepId] = useState(STEP_ID.SELECT_ENTITIES);
  const [isLoading, setIsLoading] = useState(false);
  const [canCarry, setCanCarry] = useState(true);
  const [isOriginDonkeys, setIsOriginDonkeys] = useState(true);
  const [travelTime, setTravelTime] = useState<number | undefined>(undefined);
  const [fromSearchTerm, setFromSearchTerm] = useState("");
  const [toSearchTerm, setToSearchTerm] = useState("");

  const currentStep = useMemo(() => STEPS.find((step) => step.id === selectedStepId), [selectedStepId]);

  const entitiesListWithAccountNames = useMemo(() => {
    return entitiesList.map(({ entities, name }) => ({
      entities: entities.map((entity) => ({
        ...entity,
        accountName: getRealmAddressName(entity.entity_id),
      })),
      name,
    }));
  }, [entitiesList]);

  const {
    account: { account },
    setup: {
      systemCalls: { send_resources, pickup_resources },
    },
  } = useDojo();

  const { computeTravelTime } = useTravel();

  useEffect(() => {
    selectedEntityIdFrom &&
      selectedEntityIdTo &&
      setTravelTime(
        computeTravelTime(
          selectedEntityIdFrom?.entityId,
          selectedEntityIdTo?.entityId,
          EternumGlobalConfig.speed.donkey,
        ),
      );
  }, [selectedEntityIdFrom, selectedEntityIdTo]);

  const onSendResources = () => {
    setIsLoading(true);
    const resourcesList = selectedResourceIds.flatMap((id: number) => [
      Number(id),
      multiplyByPrecision(selectedResourceAmounts[Number(id)]),
    ]);
    const systemCall = !isOriginDonkeys
      ? pickup_resources({
          signer: account,
          owner_entity_id: selectedEntityIdFrom?.entityId!,
          recipient_entity_id: selectedEntityIdTo?.entityId!,
          resources: resourcesList || [],
        })
      : send_resources({
          // pickup_resources is not defined in the snippet
          signer: account,
          sender_entity_id: selectedEntityIdFrom?.entityId!,
          recipient_entity_id: selectedEntityIdTo?.entityId!,
          resources: resourcesList || [],
        });

    systemCall.finally(() => {
      setIsLoading(false);
      setSelectedStepId(STEP_ID.SUCCESS);
    });
  };

  const isEntitySelected = (entities: any[], selectedEntityId: ID | undefined) => {
    return entities.some((entity) => entity.entity_id === selectedEntityId);
  };

  const filterEntities = (entities: any[], searchTerm: string, selectedEntityId: ID | undefined) => {
    return entities.filter(
      (entity) =>
        entity.entity_id === selectedEntityId ||
        entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entity.accountName && entity.accountName.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  };

  return (
    <div className="p-2 h-full">
      <h4 className="text-center capitalize my-5">{currentStep?.title}</h4>

      <div className="flex justify-center gap-4 mb-8 text-xl">
        {selectedEntityIdFrom?.toString() && selectedEntityIdTo?.toString() && (
          <>
            <div className="p-2 self-center">
              Transfer From: <span className="font-bold">{selectedEntityIdFrom?.name}</span>{" "}
            </div>
            <ArrowRight className="self-center" />
            <div className="p-2 self-center">
              Transfer To: <span className="font-bold">{selectedEntityIdTo?.name}</span>
            </div>
          </>
        )}
      </div>

      {currentStep?.id === STEP_ID.SELECT_ENTITIES && (
        <>
          <div className="w-full flex justify-center items-center">
            Travel Time: {Math.floor((travelTime || 0) / 60)} hrs {(travelTime || 0) % 60} mins
          </div>
          <div className="grid grid-cols-2 gap-6 mt-3">
            <div className="justify-around">
              <Headline>From</Headline>
              <TextInput
                placeholder="Search Structures..."
                value={fromSearchTerm}
                onChange={(fromSearchTerm) => setFromSearchTerm(fromSearchTerm)}
                className="my-2"
              />
              {entitiesListWithAccountNames
                .filter(({ name }) => name !== "Other Realms")
                .map(({ entities, name: title }, index) => (
                  <ToggleComponent
                    title={title}
                    key={index}
                    props={{
                      searchTerm: fromSearchTerm,
                      open: fromSearchTerm !== "" || isEntitySelected(entities, selectedEntityIdFrom?.entityId),
                    }}
                  >
                    <SelectEntityFromList
                      onSelect={(name, entityId) => setSelectedEntityIdFrom({ name, entityId })}
                      selectedCounterpartyId={selectedEntityIdTo?.entityId!}
                      selectedEntityId={selectedEntityIdFrom?.entityId!}
                      entities={filterEntities(entities, fromSearchTerm, selectedEntityIdFrom?.entityId)}
                    />
                  </ToggleComponent>
                ))}
            </div>
            <div className="justify-around overflow-auto">
              <Headline>To</Headline>
              <TextInput
                placeholder="Search entities..."
                value={toSearchTerm}
                onChange={(toSearchTerm) => setToSearchTerm(toSearchTerm)}
                className="my-2"
              />
              {entitiesListWithAccountNames.map(({ entities, name: title }, index) => (
                <ToggleComponent
                  title={title}
                  key={index}
                  props={{
                    searchTerm: toSearchTerm,
                    open: toSearchTerm !== "" || isEntitySelected(entities, selectedEntityIdTo?.entityId),
                  }}
                >
                  <SelectEntityFromList
                    onSelect={(name, entityId) => setSelectedEntityIdTo({ name, entityId })}
                    selectedCounterpartyId={selectedEntityIdFrom?.entityId!}
                    selectedEntityId={selectedEntityIdTo?.entityId!}
                    entities={filterEntities(entities, toSearchTerm, selectedEntityIdTo?.entityId)}
                  />
                </ToggleComponent>
              ))}
            </div>
          </div>
          <div className="flex justify-center w-full">
            <Button
              className="w-full mt-8"
              disabled={!selectedEntityIdFrom || !selectedEntityIdTo}
              variant="primary"
              size="md"
              onClick={() => {
                setSelectedStepId(STEP_ID.SELECT_RESOURCES);
              }}
            >
              Next - Select Resources
              <LucideArrowRight className="ml-2" />
            </Button>
          </div>
        </>
      )}

      {currentStep?.id === STEP_ID.SELECT_RESOURCES && (
        <div className="grid grid-cols-2 gap-16 px-16 h-full">
          <div className="p-4   h-full">
            <SelectResources
              selectedResourceIds={selectedResourceIds}
              setSelectedResourceIds={setSelectedResourceIds}
              selectedResourceAmounts={selectedResourceAmounts}
              setSelectedResourceAmounts={setSelectedResourceAmounts}
              entity_id={selectedEntityIdFrom?.entityId!}
            />
          </div>

          <div className=" ">
            <div className="p-10 bg-gold/10  h-auto border border-gold/40">
              <div className="flex flex-col w-full items-center">
                <TravelInfo
                  entityId={isOriginDonkeys ? selectedEntityIdFrom?.entityId! : selectedEntityIdTo?.entityId!}
                  resources={selectedResourceIds.map((resourceId: number) => ({
                    resourceId,
                    amount: selectedResourceAmounts[resourceId],
                  }))}
                  travelTime={travelTime}
                  setCanCarry={setCanCarry}
                />
              </div>
            </div>
          </div>

          <div className="w-full col-span-2">
            <Button
              className="w-full justify-center"
              isLoading={isLoading}
              disabled={!canCarry || selectedResourceIds.length === 0}
              variant="primary"
              size="md"
              onClick={onSendResources}
            >
              Confirm Transfer
            </Button>
          </div>
        </div>
      )}

      {currentStep?.id === STEP_ID.SUCCESS && (
        <div className=" justify-center items-center text-center">
          <h4>Transfer successful!</h4>
          <p>Check transfers in the right sidebar transfer menu.</p>
        </div>
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
            <div className="text-sm">
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
  entity_id: ID;
}) => {
  const { getBalance } = getResourceBalance();
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
          <div key={id} className="flex items-center gap-8 w-64 ">
            <ListSelect
              className=" overflow-hidden max-h-48 w-full"
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
          </div>
        );
      })}
      <Button
        variant="primary"
        className="mt-16"
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
