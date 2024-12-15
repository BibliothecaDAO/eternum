import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { useTravel } from "@/hooks/helpers/useTravel";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import { Checkbox } from "@/ui/elements/Checkbox";
import { Headline } from "@/ui/elements/Headline";
import TextInput from "@/ui/elements/TextInput";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { DONKEY_ENTITY_TYPE, ID } from "@bibliothecadao/eternum";
import { ArrowRight, LucideArrowRight } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { TravelInfo } from "../resources/TravelInfo";
import { ToggleComponent } from "../toggle/ToggleComponent";
import { SelectEntityFromList } from "./SelectEntityFromList";
import { SelectResources } from "./SelectResources";

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

const SelectEntitiesStep = memo(
  ({
    selectedEntityIdFrom,
    selectedEntityIdTo,
    setSelectedEntityIdFrom,
    setSelectedEntityIdTo,
    travelTime,
    entitiesListWithAccountNames,
    fromSearchTerm,
    setFromSearchTerm,
    toSearchTerm,
    setToSearchTerm,
    filtered,
    filterBy,
    setSelectedStepId,
  }: {
    selectedEntityIdFrom: SelectedEntity | null;
    selectedEntityIdTo: SelectedEntity | null;
    setSelectedEntityIdFrom: (entity: SelectedEntity | null) => void;
    setSelectedEntityIdTo: (entity: SelectedEntity | null) => void;
    travelTime: number | undefined;
    entitiesListWithAccountNames: { entities: any[]; name: string }[];
    fromSearchTerm: string;
    setFromSearchTerm: (term: string) => void;
    toSearchTerm: string;
    setToSearchTerm: (term: string) => void;
    filtered: boolean;
    filterBy: (filtered: boolean) => void;
    setSelectedStepId: (stepId: STEP_ID) => void;
  }) => {
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
      <>
        <div className="w-full flex justify-center items-center">
          Travel Time: {Math.floor((travelTime || 0) / 60)} hrs {(travelTime || 0) % 60} mins
        </div>
        <div className="grid grid-cols-2 gap-6 mt-3">
          {/* From column */}
          <div className="justify-around">
            <Headline>From</Headline>
            <TextInput placeholder="Search Structures..." onChange={setFromSearchTerm} className="my-2" />
            {entitiesListWithAccountNames
              .filter(({ name }) => name !== "Other Realms")
              .map(({ entities, name: title }, index) => {
                const filteredEntities = filterEntities(entities, fromSearchTerm, selectedEntityIdFrom?.entityId);
                if (filteredEntities.length === 0) return null;
                return (
                  <ToggleComponent
                    title={title}
                    key={index}
                    searchTerm={fromSearchTerm}
                    initialOpen={fromSearchTerm !== "" || isEntitySelected(entities, selectedEntityIdFrom?.entityId)}
                  >
                    <SelectEntityFromList
                      onSelect={(name, entityId) => setSelectedEntityIdFrom({ name, entityId })}
                      selectedCounterpartyId={selectedEntityIdTo?.entityId!}
                      selectedEntityId={selectedEntityIdFrom?.entityId!}
                      entities={filteredEntities}
                    />
                  </ToggleComponent>
                );
              })}
          </div>
          {/* To column */}
          <div className="justify-around overflow-auto">
            <Headline>To</Headline>
            <div className="p-1">
              <div className="flex space-x-2 items-center cursor-pointer" onClick={() => filterBy(!filtered)}>
                <Checkbox enabled={filtered} />
                <div>Tribe Only</div>
              </div>
            </div>

            <TextInput placeholder="Search entities..." onChange={setToSearchTerm} className="my-2" />
            {entitiesListWithAccountNames.map(({ entities, name: title }, index) => (
              <ToggleComponent
                title={title}
                key={index}
                searchTerm={toSearchTerm}
                initialOpen={toSearchTerm !== "" || isEntitySelected(entities, selectedEntityIdTo?.entityId)}
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
            onClick={() => setSelectedStepId(STEP_ID.SELECT_RESOURCES)}
          >
            Next - Select Resources
            <LucideArrowRight className="ml-2" />
          </Button>
        </div>
      </>
    );
  },
);

export const TransferBetweenEntities = ({
  entitiesList,
  filtered,
  filterBy,
}: {
  entitiesList: { entities: any[]; name: string }[];
  filtered: boolean;
  filterBy: (filtered: boolean) => void;
}) => {
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
  const { play: playDonkeyScreaming } = useUiSounds(soundSelector.burnDonkey);

  const currentStep = useMemo(() => STEPS.find((step) => step.id === selectedStepId), [selectedStepId]);

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
          configManager.getSpeedConfig(DONKEY_ENTITY_TYPE),
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

    playDonkeyScreaming();

    systemCall.finally(() => {
      setIsLoading(false);
      setSelectedStepId(STEP_ID.SUCCESS);
    });
  };

  const onNewTrade = () => {
    setSelectedEntityIdFrom(null);
    setSelectedEntityIdTo(null);
    setSelectedResourceIds([]);
    setSelectedResourceAmounts({});
    setSelectedStepId(STEP_ID.SELECT_ENTITIES);
  };

  const entitiesListWithAccountNames = useMemo(() => {
    return entitiesList.map(({ entities, name }) => ({
      entities: entities.map((entity) => ({
        ...entity,
        accountName: getRealmAddressName(entity.entity_id),
      })),
      name,
    }));
  }, [entitiesList]);

  return (
    <div className="transfer-selector p-2 h-full">
      <Headline className="text-center capitalize my-5">{currentStep?.title}</Headline>

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
        <SelectEntitiesStep
          selectedEntityIdFrom={selectedEntityIdFrom}
          selectedEntityIdTo={selectedEntityIdTo}
          setSelectedEntityIdFrom={setSelectedEntityIdFrom}
          setSelectedEntityIdTo={setSelectedEntityIdTo}
          travelTime={travelTime}
          entitiesListWithAccountNames={entitiesListWithAccountNames}
          fromSearchTerm={fromSearchTerm}
          setFromSearchTerm={setFromSearchTerm}
          toSearchTerm={toSearchTerm}
          setToSearchTerm={setToSearchTerm}
          filtered={filtered}
          filterBy={filterBy}
          setSelectedStepId={setSelectedStepId}
        />
      )}

      {currentStep?.id === STEP_ID.SELECT_RESOURCES && (
        <div className="grid grid-cols-2 gap-8 px-8 h-full">
          <div className=" bg-gold/10  h-auto border border-gold/40">
            <SelectResources
              selectedResourceIds={selectedResourceIds}
              setSelectedResourceIds={setSelectedResourceIds}
              selectedResourceAmounts={selectedResourceAmounts}
              setSelectedResourceAmounts={setSelectedResourceAmounts}
              entity_id={selectedEntityIdFrom?.entityId!}
            />
          </div>

          <div className=" ">
            <div className="p-10 bg-gold/10  h-auto rounded-lg border border-gold/40">
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
      {currentStep?.id === STEP_ID.SUCCESS && <FinalTransfer onNewTrade={onNewTrade} />}
    </div>
  );
};

const FinalTransfer = memo(({ onNewTrade }: { onNewTrade: () => void }) => {
  return (
    <div className=" justify-center items-center text-center">
      <h4>Transfer successful!</h4>
      <p>Check transfers in the right sidebar transfer menu.</p>
      <Button variant="primary" size="md" className="mt-4" onClick={onNewTrade}>
        New transfer
      </Button>
    </div>
  );
});
