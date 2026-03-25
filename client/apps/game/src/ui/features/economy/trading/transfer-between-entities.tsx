import { useUISound } from "@/audio";
import Button from "@/ui/design-system/atoms/button";
import { Checkbox } from "@/ui/design-system/atoms/checkbox";
import TextInput from "@/ui/design-system/atoms/text-input";
import { TravelInfo } from "@/ui/features/economy/resources";
import { SelectEntityFromList, SelectResources } from "@/ui/features/economy/trading";
import { ToggleComponent } from "@/ui/shared";
import { calculateArrivalTime, formatArrivalTime, normalizeDiacriticalMarks } from "@/ui/utils/utils";
import {
  computeTravelTime,
  configManager,
  getAddressName,
  getEntityNameFromLocalStorage,
  getRealmNameById,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, EntityType, ID, StructureType } from "@bibliothecadao/types";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import { memo, useEffect, useMemo, useState } from "react";
import { EntityIdFormat } from "./transfer-view";

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
    entitiesListWithAccountNames: {
      entities: { entityId: ID; accountName: string | undefined; name: string }[];
      name: string;
    }[];
    fromSearchTerm: string;
    setFromSearchTerm: (term: string) => void;
    toSearchTerm: string;
    setToSearchTerm: (term: string) => void;
    filtered: boolean;
    filterBy: (filtered: boolean) => void;
    setSelectedStepId: (stepId: STEP_ID) => void;
  }) => {
    const isEntitySelected = (entities: any[], selectedEntityId: ID | undefined) => {
      return entities.some((entity) => entity.entityId === selectedEntityId);
    };

    const filterEntities = (
      entities: { entityId: ID; accountName: string | undefined; name: string }[],
      searchTerm: string,
      selectedEntityId: ID | undefined,
    ) => {
      const normalizedSearchTerm = normalizeDiacriticalMarks(searchTerm.toLowerCase());
      return entities.filter(
        (entity) =>
          entity.entityId === selectedEntityId ||
          normalizeDiacriticalMarks(entity.name.toLowerCase()).includes(normalizedSearchTerm) ||
          (entity.accountName &&
            normalizeDiacriticalMarks(entity.accountName.toLowerCase()).includes(normalizedSearchTerm)),
      );
    };

    // Calculate the arrival time based on the travel time
    const arrivalTime = calculateArrivalTime(travelTime);
    const formattedArrivalTime = formatArrivalTime(arrivalTime);

    return (
      <>
        {formattedArrivalTime && (
          <div className="flex justify-center mb-3">
            <div className="text-xs text-gold/60 px-3 py-1 rounded-full bg-gold/5 border border-gold/10">
              Estimated Arrival: {formattedArrivalTime}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-6 mt-3">
          {/* From column */}
          <div className="rounded-lg border border-gold/10 p-3">
            <div className="text-xs uppercase text-gold/50 font-medium mb-2">From</div>
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
          <div className="rounded-lg border border-gold/10 p-3 overflow-auto">
            <div className="text-xs uppercase text-gold/50 font-medium mb-2">To</div>
            <div className="flex items-center gap-2 cursor-pointer mb-2 text-xs" onClick={() => filterBy(!filtered)}>
              <Checkbox enabled={filtered} />
              <span className="text-gold/70">Tribe Only</span>
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
            className="w-full mt-4"
            disabled={!selectedEntityIdFrom || !selectedEntityIdTo}
            variant="primary"
            size="md"
            onClick={() => setSelectedStepId(STEP_ID.SELECT_RESOURCES)}
          >
            Next - Select Resources
            <ArrowRight className="ml-2" />
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
  entitiesList: { entities: EntityIdFormat[]; name: string }[];
  filtered: boolean;
  filterBy: (filtered: boolean) => void;
}) => {
  const [selectedEntityIdFrom, setSelectedEntityIdFrom] = useState<SelectedEntity | null>(null);
  const [selectedEntityIdTo, setSelectedEntityIdTo] = useState<SelectedEntity | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});
  const [selectedStepId, setSelectedStepId] = useState(STEP_ID.SELECT_ENTITIES);
  const [isLoading, setIsLoading] = useState(false);
  const [canCarry, setCanCarry] = useState(true);
  const [travelTime, setTravelTime] = useState<number | undefined>(undefined);
  const [fromSearchTerm, setFromSearchTerm] = useState("");
  const [toSearchTerm, setToSearchTerm] = useState("");
  const playDonkeyScreaming = useUISound("resource.burn_donkey");

  const currentStep = useMemo(() => STEPS.find((step) => step.id === selectedStepId), [selectedStepId]);

  const {
    account: { account },
    setup: {
      components,
      systemCalls: { send_resources },
    },
  } = useDojo();

  useEffect(() => {
    selectedEntityIdFrom &&
      selectedEntityIdTo &&
      setTravelTime(
        computeTravelTime(
          selectedEntityIdFrom?.entityId,
          selectedEntityIdTo?.entityId,
          configManager.getSpeedConfig(EntityType.DONKEY),
          components,
        ),
      );
  }, [selectedEntityIdFrom, selectedEntityIdTo]);

  const onSendResources = () => {
    setIsLoading(true);
    const resourcesList = selectedResourceIds.map((id: number) => ({
      resource: Number(id),
      amount: multiplyByPrecision(selectedResourceAmounts[Number(id)]),
    }));
    const systemCall = send_resources({
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
      entities: entities.map((entity) => {
        const entityName =
          getEntityNameFromLocalStorage(entity.entityId) ||
          (entity.realmId ? getRealmNameById(entity.realmId) : `${StructureType[entity.category]} ${entity.entityId}`);

        return {
          ...entity,
          accountName: getAddressName(ContractAddress(entity.owner), components),
          name: entityName,
        };
      }),
      name,
    }));
  }, [entitiesList]);

  return (
    <div className="transfer-selector px-4 py-2 h-full overflow-y-auto">
      <div className="text-center text-sm font-medium text-gold/70 uppercase tracking-wider my-4">
        {currentStep?.title}
      </div>

      <div className="flex justify-center items-center gap-3 mb-4 text-sm">
        {selectedEntityIdFrom?.toString() && selectedEntityIdTo?.toString() && (
          <>
            <div className="px-3 py-1.5 rounded-lg bg-green/10 border border-green/20 text-green">
              <span className="text-gold/50">From:</span>{" "}
              <span className="font-medium">{selectedEntityIdFrom?.name}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gold/40" />
            <div className="px-3 py-1.5 rounded-lg bg-blueish/10 border border-blueish/20 text-blueish">
              <span className="text-gold/50">To:</span> <span className="font-medium">{selectedEntityIdTo?.name}</span>
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
        <div className="grid grid-cols-2 gap-4 px-4 h-full">
          <div className="bg-black/20 h-auto border border-gold/20 rounded-lg">
            <SelectResources
              selectedResourceIds={selectedResourceIds}
              setSelectedResourceIds={setSelectedResourceIds}
              selectedResourceAmounts={selectedResourceAmounts}
              setSelectedResourceAmounts={setSelectedResourceAmounts}
              entity_id={selectedEntityIdFrom?.entityId!}
              toEntityId={selectedEntityIdTo?.entityId!}
            />
          </div>

          <div className=" ">
            <div className="p-6 bg-black/20 h-auto rounded-lg border border-gold/20">
              <div className="flex flex-col w-full items-center">
                <TravelInfo
                  entityId={selectedEntityIdFrom?.entityId!}
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

          <div className="w-full col-span-2 grid grid-cols-4 gap-4">
            <Button
              className="col-span-1 justify-center"
              variant="secondary"
              size="md"
              onClick={() => setSelectedStepId(STEP_ID.SELECT_ENTITIES)}
            >
              Back
            </Button>
            <Button
              className="col-span-3 justify-center"
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
    <div className="flex flex-col justify-center items-center text-center py-12">
      <div className="text-lg text-green font-medium mb-2">Transfer successful!</div>
      <div className="text-sm text-gold/60 mb-6">Check transfers in the right sidebar transfer menu.</div>
      <Button variant="primary" size="md" className="mt-4" onClick={onNewTrade}>
        New transfer
      </Button>
    </div>
  );
});
