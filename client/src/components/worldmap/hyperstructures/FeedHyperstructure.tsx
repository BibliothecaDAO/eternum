import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../elements/SecondaryPopup";
import Button from "../../../elements/Button";
import { SelectCaravanPanel } from "../../cityview/realm/trade/CreateOffer";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { getRealm } from "../../../utils/realms";
import { getComponentValue } from "@latticexyz/recs";
import {
  divideByPrecision,
  getContractPositionFromRealPosition,
  getEntityIdFromKeys,
  multiplyByPrecision,
} from "../../../utils/utils";
import { useDojo } from "../../../DojoContext";
import { Steps } from "../../../elements/Steps";
import { Headline } from "../../../elements/Headline";
import { OrderIcon } from "../../../elements/OrderIcon";
import { orderNameDict, orders } from "@bibliothecadao/eternum";
import { ResourceCost } from "../../../elements/ResourceCost";
import clsx from "clsx";
import { HyperStructureInterface, useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import { Tabs } from "../../../elements/tab";
import ProgressBar from "../../../elements/ProgressBar";
import { HyperStructureCaravansPanel } from "./HyperStructureCaravans/HyperStructureCaravansPanel";
import hyperStructures from "../../../data/hyperstructures.json";
import { useGetPositionCaravans } from "../../../hooks/helpers/useCaravans";
import { NumberInput } from "../../../elements/NumberInput";
import { ReactComponent as ArrowSeparator } from "../../../assets/icons/common/arrow-separator.svg";
import { WEIGHT_PER_DONKEY_KG } from "@bibliothecadao/eternum";
import { ReactComponent as CloseIcon } from "../../../assets/icons/common/cross-circle.svg";
import useUIStore from "../../../hooks/store/useUIStore";

type FeedHyperstructurePopupProps = {
  onClose: () => void;
  order: number;
};

export const FeedHyperstructurePopup = ({ onClose, order }: FeedHyperstructurePopupProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const hyperStructurePosition = useMemo(() => {
    const { x, z } = hyperStructures[order - 1];
    return getContractPositionFromRealPosition({ x, y: z });
  }, [order]);

  const { getHyperstructure } = useHyperstructure();
  const hyperstructureData = getHyperstructure(order, {
    x: hyperStructures[order - 1].x,
    y: hyperStructures[order - 1].y,
    z: hyperStructures[order - 1].z,
  });

  const { caravans } = useGetPositionCaravans(hyperStructurePosition.x, hyperStructurePosition.y);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Initialize or feed Hyperstructure with resources.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Build</div>
          </div>
        ),
        component: (
          <BuildHyperstructurePanel
            order={order}
            onSendCaravan={() => setSelectedTab(1)}
            onClose={onClose}
            hyperstructureData={hyperstructureData}
          />
        ),
      },
      {
        key: "my",
        label: (
          // TODO: implement incoming caravans here
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Watch incoming caravans.</p>
                    <p className="whitespace-nowrap">Pass resources to Hyperstructure on arriving.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex group relative flex-col items-center"
          >
            <div>{`Caravans (${caravans.length})`}</div>
          </div>
        ),
        component: hyperstructureData ? (
          <HyperStructureCaravansPanel caravans={caravans} hyperstructureData={hyperstructureData} />
        ) : (
          <></>
        ),
      },
    ],
    [selectedTab, caravans],
  );

  return (
    <SecondaryPopup name="hyperstructure">
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5 bg-gray">Manage Hyperstructure:</div>
          <CloseIcon className="w-3 h-3 cursor-pointer fill-white" onClick={onClose} />
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"460px"}>
        <Tabs
          selectedIndex={selectedTab}
          onChange={(index: any) => setSelectedTab(index)}
          variant="default"
          className="h-full"
        >
          <Tabs.List className="!border-t-transparent">
            {tabs.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panels className="overflow-hidden">
            {tabs.map((tab, index) => (
              <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const SelectableRealm = ({ realm, selected = false, initialized = false, onClick, costs, ...props }: any) => {
  const costById = useMemo(() => {
    const costById: any = {};
    costs &&
      costs.forEach((cost: any) => {
        costById[cost.resourceId] = cost.amount;
      });
    return costById;
  }, [costs]);

  const canInitialize = useMemo(() => {
    let canInitialize = true;
    if (!realm || !realm.resources) {
      return false;
    }
    realm.resources.forEach((resource: any) => {
      if (resource.balance < costById[resource.id]) {
        canInitialize = false;
      }
    });
    return canInitialize;
  }, [costById, realm.resources]);

  return (
    <div
      className={clsx(
        "flex flex-col relative items-center p-2 border rounded-md text-xxs text-gray-gold",
        "border-gray-gold",
      )}
      {...props}
    >
      {realm && (
        <div className="flex absolute items-center p-1 top-0 left-0 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
          {realm.order && <OrderIcon order={orderNameDict[realm.order]} size="xs" className="mr-1" />}
          {realm.name}
        </div>
      )}
      <div className="text-gold ml-auto absolute right-2 top-2">24h:10m away</div>
      <div className="flex items-center mt-6 w-full">
        <div className="flex">
          {!initialized &&
            realm.resources &&
            realm.resources.map((resource: any) => {
              return (
                <ResourceCost
                  type="vertical"
                  withTooltip
                  key={resource.id}
                  resourceId={resource.id}
                  amount={resource.balance}
                  color={resource.balance >= costById[resource.id] ? "" : "text-order-giants"}
                />
              );
            })}
        </div>
        <Button
          disabled={!initialized && !canInitialize}
          onClick={onClick}
          className="h-6 text-xxs ml-auto"
          variant="success"
        >
          {initialized ? `Set the amounts` : `Initialize construction`}
        </Button>
      </div>
    </div>
  );
};

const BuildHyperstructurePanel = ({
  order,
  onClose,
  onSendCaravan,
  hyperstructureData,
}: {
  order: number;
  onClose: () => void;
  onSendCaravan: () => void;
  hyperstructureData: HyperStructureInterface | undefined;
}) => {
  const [selectedCaravan, setSelectedCaravan] = useState<number>(0);
  const [isNewCaravan, setIsNewCaravan] = useState(false);
  const [donkeysCount, setDonkeysCount] = useState(1);
  const [hasEnoughDonkeys, setHasEnoughDonkeys] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  const {
    account: { account },
    setup: {
      systemCalls: { complete_hyperstructure, send_resources_to_hyperstructure },
    },
  } = useDojo();

  const completeHyperstructure = async () => {
    setIsLoading(true);
    await complete_hyperstructure({ signer: account, hyperstructure_id: hyperstructureData?.hyperstructureId || 0 });
    onClose();
  };

  const sendResourcesToHyperStructure = async () => {
    setIsLoading(true);
    if (hyperstructureData) {
      const resourcesList = hyperstructureData?.initialized
        ? Object.keys(feedResourcesGiveAmounts)
            .filter((id) => feedResourcesGiveAmounts[Number(id)] > 0)
            .flatMap((id) => [Number(id), multiplyByPrecision(feedResourcesGiveAmounts[Number(id)])])
        : hyperstructureData?.initialzationResources.flatMap((resource) => [resource.resourceId, resource.amount]);
      if (isNewCaravan) {
        await send_resources_to_hyperstructure({
          signer: account,
          sending_entity_id: realmEntityId,
          resources: resourcesList || [],
          destination_coord_x: hyperstructureData.position.x,
          destination_coord_y: hyperstructureData.position.y,
          donkeys_quantity: donkeysCount,
        });
      } else {
        // transfer resources to caravan
        await send_resources_to_hyperstructure({
          signer: account,
          sending_entity_id: realmEntityId,
          resources: resourcesList || [],
          destination_coord_x: hyperstructureData.position.x,
          destination_coord_y: hyperstructureData.position.y,
          caravan_id: selectedCaravan,
        });
      }
    }
    onSendCaravan();
  };

  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const setRealmEntityId = useRealmStore((state) => state.setRealmEntityId);
  const [feedResourcesGiveAmounts, setFeedResourcesGiveAmounts] = useState<{ [key: number]: number }>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
    13: 0,
    14: 0,
    15: 0,
    16: 0,
    17: 0,
    18: 0,
    19: 0,
    20: 0,
    21: 0,
    22: 0,
  });

  const isComplete = hyperstructureData && hyperstructureData?.progress >= 100;

  // TODO: use same precision everywhere
  const resourceWeight = useMemo(() => {
    let _resourceWeight = 0;
    if (!hyperstructureData?.initialized) {
      for (const [_, amount] of Object.entries(
        hyperstructureData?.initialzationResources.map((resource) => resource.amount) || {},
      )) {
        _resourceWeight += amount * 1;
      }
    } else {
      for (const amount of Object.values(feedResourcesGiveAmounts || {})) {
        _resourceWeight += multiplyByPrecision(amount * 1);
      }
    }
    return _resourceWeight;
  }, [hyperstructureData, feedResourcesGiveAmounts]);

  const initializeResourceIds = useMemo(() => {
    return hyperstructureData?.initialzationResources.map((resource) => resource.resourceId) || [];
  }, [hyperstructureData]);

  const initializeResourceAmounts = useMemo(() => {
    const amounts: any = {};
    hyperstructureData?.initialzationResources.forEach((resource) => {
      amounts[resource.resourceId] = divideByPrecision(resource.amount);
    });
    return amounts;
  }, [hyperstructureData]);

  const resourcesLeftToComplete = useMemo(() => {
    const resourcesLeftToComplete: any = {};
    hyperstructureData?.hyperstructureResources.forEach((resource) => {
      resourcesLeftToComplete[resource.resourceId] =
        divideByPrecision(resource.completeAmount) - divideByPrecision(resource.currentAmount);
    });
    return resourcesLeftToComplete;
  }, [hyperstructureData]);

  const realms = useMemo(
    () =>
      realmEntityIds.map((realmEntityId) => {
        const _realm = getRealm(realmEntityId.realmId);
        const _resources = hyperstructureData?.initialzationResources.map((resource) => ({
          id: resource.resourceId,
          balance:
            getComponentValue(
              Resource,
              getEntityIdFromKeys([BigInt(realmEntityId.realmEntityId), BigInt(resource.resourceId)]),
            )?.balance || 0,
        }));
        return { ..._realm, entity_id: realmEntityId.realmEntityId, resources: _resources };
      }),
    [realmEntityIds],
  );

  const canGoToNextStep = useMemo(() => {
    if (step === 3) {
      return selectedCaravan !== 0 || (hasEnoughDonkeys && isNewCaravan);
    } else if (step == 2) {
      return false;
    } else {
      return true;
    }
  }, [step, selectedCaravan, hasEnoughDonkeys, isNewCaravan]);

  useEffect(() => {
    if (donkeysCount * WEIGHT_PER_DONKEY_KG >= divideByPrecision(resourceWeight)) {
      setHasEnoughDonkeys(true);
    } else {
      setHasEnoughDonkeys(false);
    }
  }, [donkeysCount, resourceWeight]);

  return (
    <div className="flex flex-col items-center p-2">
      <div className="flex flex-col space-y-2 text-xs w-full mb-3">
        <div className="flex justify-between">
          <div className="flex items-center">
            {<OrderIcon order={orderNameDict[order]} size="xs" className="mx-1" />}
            <span className="text-white font-bold">{orders[order - 1].fullOrderName}</span>
          </div>
          <div className="flex flex-col text-xxs text-right">
            <span className="text-gray-gold italic">State</span>
            <span
              className={clsx(
                !hyperstructureData?.initialized && "text-order-giants",
                hyperstructureData?.completed && "text-order-brilliance",
                hyperstructureData && hyperstructureData?.progress >= 0 && !hyperstructureData?.completed
                  ? "text-gold"
                  : "",
              )}
            >
              {hyperstructureData?.completed
                ? "Completed"
                : hyperstructureData?.initialized
                ? `Building in progress ${hyperstructureData?.progress.toFixed(2)}%`
                : "Not initialized"}
            </span>
          </div>
        </div>
        <ProgressBar rounded progress={hyperstructureData?.progress || 0} className="bg-gold" />
      </div>
      {step == 1 && (
        <>
          <div className="flex flex-col space-y-2 text-xs">
            <div className="relative w-full">
              <img src={`/images/buildings/hyperstructure.jpg`} className="object-cover w-full h-full rounded-[10px]" />
              <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
                <div className="mb-1 ml-1 italic text-light-pink text-xxs">
                  {hyperstructureData?.initialized ? "Resources need to complete:" : "Initialization cost:"}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {!hyperstructureData?.initialized
                    ? hyperstructureData?.initialzationResources.map(({ resourceId, amount }) => (
                        <ResourceCost
                          withTooltip
                          type="vertical"
                          key={resourceId}
                          resourceId={resourceId}
                          amount={amount}
                        />
                      ))
                    : resourcesLeftToComplete &&
                      Object.keys(resourcesLeftToComplete).map((id) => (
                        <ResourceCost
                          withTooltip
                          type="vertical"
                          key={id}
                          resourceId={Number(id)}
                          amount={multiplyByPrecision(resourcesLeftToComplete[id])}
                        />
                      ))}
                </div>
              </div>
            </div>
            <Headline size="big">
              {hyperstructureData?.initialized ? "Feed Hyperstructure" : "Initialize Hyperstructure"}- Step {step}
            </Headline>
            <div className="text-xxs mb-2 italic text-gold">
              {hyperstructureData?.initialized
                ? `
                To feed the Hyperstructure you need to send any amount of required resources to the Hyperstructure location.
              `
                : `To start construction of the Hyperstructure you need to send a caravan with initial cost of resources to the Hyperstructure location.`}
            </div>

            <div className="text-xxs mb-2 italic text-white">{`Click the "Next" button to select a Realm from which you want to spend resources.`}</div>
          </div>
        </>
      )}
      {step == 2 && (
        <div className="flex flex-col w-full space-y-2">
          <Headline size="big">Select Realm - Step {step}</Headline>
          <div className="text-xxs mb-2 italic text-gold">
            {hyperstructureData?.initialized
              ? `Press "Set the amounts" on any Realm with required resources, to set amounts and send caravan to Hyperstructure.`
              : `Press "Initialize construction" on any Realm with enough resources, to send caravan to Hyperstructure.`}
          </div>
          {realms.map((realm) => (
            <SelectableRealm
              key={realm.realm_id}
              realm={realm}
              onClick={() => {
                setRealmEntityId(realm.entity_id);
                setStep(step + 1);
              }}
              costs={hyperstructureData?.initialzationResources}
              selected={realmEntityId === realm.entity_id}
              initialized={hyperstructureData?.initialized}
            />
          ))}
        </div>
      )}
      {step == 3 && (
        <>
          {hyperstructureData?.initialized && (
            <>
              <div className="grid relative grid-cols-9 gap-2 max-h-[350px] overflow-auto">
                <div className={clsx("flex flex-col items-center  space-y-2 h-min", "col-span-4")}>
                  <Headline className="mb-2">You Give</Headline>
                  {Object.keys(resourcesLeftToComplete).map((_id) => {
                    const id: any = Number(_id);
                    let resource = getComponentValue(
                      Resource,
                      getEntityIdFromKeys([BigInt(realmEntityId), BigInt(id)]),
                    );
                    return (
                      <div key={id} className="flex items-center w-full h-8">
                        <NumberInput
                          max={resourcesLeftToComplete[id]}
                          min={1}
                          value={feedResourcesGiveAmounts[id]}
                          onChange={(value) => {
                            setFeedResourcesGiveAmounts({
                              ...feedResourcesGiveAmounts,
                              [id]: Math.min(divideByPrecision(resource?.balance || 0), value),
                            });
                          }}
                        />
                        <div className="ml-2">
                          <ResourceCost
                            className=" cursor-pointer"
                            onClick={() => {
                              setFeedResourcesGiveAmounts({
                                ...feedResourcesGiveAmounts,
                                [id]: Math.min(divideByPrecision(resource?.balance || 0), resourcesLeftToComplete[id]),
                              });
                            }}
                            resourceId={id}
                            amount={resource?.balance || 0}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center">
                  <ArrowSeparator className="fixed top-1/2" />
                </div>
                <div className="flex flex-col col-span-4 space-y-2 h-min">
                  <Headline className="mb-2">Structure needs</Headline>
                  {Object.keys(resourcesLeftToComplete).map((id) => (
                    <ResourceCost
                      key={id}
                      className="!w-min h-8 cursor-pointer"
                      resourceId={Number(id)}
                      amount={multiplyByPrecision(resourcesLeftToComplete[id])}
                      onClick={() => {
                        setFeedResourcesGiveAmounts({
                          ...feedResourcesGiveAmounts,
                          [id]: resourcesLeftToComplete[id],
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          <SelectCaravanPanel
            className="!p-0"
            donkeysCount={donkeysCount}
            setDonkeysCount={setDonkeysCount}
            isNewCaravan={isNewCaravan}
            setIsNewCaravan={setIsNewCaravan}
            selectedCaravan={selectedCaravan}
            setSelectedCaravan={setSelectedCaravan}
            selectedResourceIdsGet={[]}
            selectedResourcesGetAmounts={[]}
            selectedResourceIdsGive={hyperstructureData?.initialized ? [] : initializeResourceIds}
            selectedResourcesGiveAmounts={hyperstructureData?.initialized ? [] : initializeResourceAmounts}
            resourceWeight={resourceWeight}
            hasEnoughDonkeys={hasEnoughDonkeys}
            headline="Select Caravan - Step 3"
          />
        </>
      )}
      <div className="flex justify-between items-center mt-3 w-full text-xxs">
        <Button
          className="!px-[6px] !py-[2px] text-xxs"
          onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
          variant="outline"
        >
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        <Steps className="absolute -translate-x-1/2 left-1/2 bottom-3" step={step} maxStep={3} />
        {!isLoading && (
          <Button
            className="!px-[6px] !py-[2px] text-xxs ml-auto"
            disabled={!canGoToNextStep}
            isLoading={isLoading}
            onClick={() => {
              if (step == 3) {
                sendResourcesToHyperStructure();
              } else {
                isComplete ? completeHyperstructure() : setStep(step + 1);
              }
            }}
            variant={canGoToNextStep ? "success" : "outline"}
          >
            {step == 3 ? "Send Caravan" : isComplete ? "Complete" : "Next Step"}
          </Button>
        )}
        {isLoading && (
          <Button
            isLoading={true}
            onClick={() => {}}
            variant="danger"
            className="ml-auto p-2 !h-4 text-xxs !rounded-md"
          >
            {" "}
            {}{" "}
          </Button>
        )}
      </div>
    </div>
  );
};
