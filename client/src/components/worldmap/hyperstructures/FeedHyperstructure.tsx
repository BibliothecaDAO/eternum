import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../elements/SecondaryPopup";
import Button from "../../../elements/Button";
import { SelectCaravanPanel } from "../../cityview/realm/trade/CreateOffer";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { getRealm } from "../../../utils/realms";
import { getComponentValue } from "@latticexyz/recs";
import { divideByPrecision, getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../../utils/utils";
import { useDojo } from "../../../DojoContext";
import { Steps } from "../../../elements/Steps";
import { Headline } from "../../../elements/Headline";
import { OrderIcon } from "../../../elements/OrderIcon";
import { orderNameDict, orders } from "../../../constants/orders";
import { ResourceCost } from "../../../elements/ResourceCost";
import clsx from "clsx";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import hyperstructure from "../../../data/hyperstructures.json";
import { Tabs } from "../../../elements/tab";
import { Tooltip } from "../../../elements/Tooltip";
import ProgressBar from "../../../elements/ProgressBar";

type FeedHyperstructurePopupProps = {
  onClose: () => void;
  order: number;
};

export const FeedHyperstructurePopup = ({ onClose, order }: FeedHyperstructurePopupProps) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Build</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Initialize or feed Hyperstructure with resources.</p>
            </Tooltip>
          </div>
        ),
        component: <BuildHyperstructurePanel order={order} onClose={onClose} />,
      },
      {
        key: "my",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Caravans (0)</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Watch incoming caravans.</p>
              <p className="whitespace-nowrap">Pass resources to Hyperstructure on arriving.</p>
            </Tooltip>
          </div>
        ),
        component: <></>,
      },
    ],
    [selectedTab],
  );

  return (
    <SecondaryPopup name="hyperstructure">
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5 bg-gray">Manage Hyperstructure:</div>
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

const SelectableRealm = ({ realm, selected = false, onClick, costs, ...props }: any) => {
  const costById = useMemo(() => {
    const costById: any = {};
    costs.forEach((cost: any) => {
      costById[cost.resourceId] = cost.amount;
    });
    return costById;
  }, [costs]);

  const canInitialize = useMemo(() => {
    let canInitialize = true;
    realm.resources.forEach((resource: any) => {
      if (resource.balance.balance < costById[resource.id]) {
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
          {realm.resources &&
            realm.resources.map((resource: any) => {
              return (
                <ResourceCost
                  type="vertical"
                  withTooltip
                  key={resource.id}
                  resourceId={resource.id}
                  amount={resource.balance.balance}
                  color={resource.balance.balance >= costById[resource.id] ? "" : "text-order-giants"}
                />
              );
            })}
        </div>
        <Button disabled={!canInitialize} onClick={onClick} className="h-6 text-xxs ml-auto" variant="success">
          Initialize construction
        </Button>
      </div>
    </div>
  );
};

const BuildHyperstructurePanel = ({ order, onClose }: any) => {
  const [selectedCaravan, setSelectedCaravan] = useState<number>(0);
  const [isNewCaravan, setIsNewCaravan] = useState(false);
  const [donkeysCount, setDonkeysCount] = useState(1);
  const [hasEnoughDonkeys, setHasEnoughDonkeys] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  const hyperStructurePosition = useMemo(() => {
    return getContractPositionFromRealPosition({ x: hyperstructure[order - 1].x, y: hyperstructure[order - 1].z });
  }, [order]);

  const {
    account: { account },
    setup: {
      systemCalls: { create_caravan, create_free_transport_unit, transfer_resources, travel },
    },
  } = useDojo();

  const initHyperStructure = async () => {
    setIsLoading(true);
    if (hyperstructureData) {
      if (isNewCaravan) {
        const transport_units_id = await create_free_transport_unit({
          signer: account,
          realm_id: realmEntityId,
          quantity: donkeysCount,
        });
        const caravan_id = await create_caravan({
          signer: account,
          entity_ids: [transport_units_id],
        });

        // transfer resources to caravan
        await transfer_resources({
          signer: account,
          sending_entity_id: realmEntityId,
          receiving_entity_id: caravan_id,
          resources:
            hyperstructureData?.initialzationResources.flatMap((resource) => [resource.resourceId, resource.amount]) ||
            [],
        });

        // send caravan to hyperstructure
        await travel({
          signer: account,
          travelling_entity_id: caravan_id,
          destination_entity_id: hyperstructureData.hyperstructureId,
        });
      } else {
        // transfer resources to caravan
        await transfer_resources({
          signer: account,
          sending_entity_id: realmEntityId,
          receiving_entity_id: selectedCaravan,
          resources:
            hyperstructureData?.initialzationResources.flatMap((resource) => [
              2,
              resource.resourceId,
              resource.amount,
            ]) || [],
        });

        // send caravan to hyperstructure
        await travel({
          signer: account,
          travelling_entity_id: selectedCaravan,
          destination_entity_id: hyperstructureData.hyperstructureId,
        });
      }
    }
    onClose();
  };

  const { getHyperstructure } = useHyperstructure();

  const hyperstructureData = getHyperstructure(
    order,
    // TODO: change z to y when right one
    hyperStructurePosition,
  );

  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  let resourceWeight = 0;
  for (const [_, amount] of Object.entries(
    hyperstructureData?.initialzationResources.map((resource) => resource.amount) || {},
  )) {
    resourceWeight += divideByPrecision(amount) * 1;
  }

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const setRealmEntityId = useRealmStore((state) => state.setRealmEntityId);

  const initializeResourceIds = useMemo(() => {
    return hyperstructureData?.initialzationResources.map((resource) => resource.resourceId) || [];
  }, []);

  const initializeResourceAmounts = useMemo(() => {
    const amounts: any = {};
    hyperstructureData?.initialzationResources.forEach((resource) => {
      amounts[resource.resourceId] = divideByPrecision(resource.amount);
    });
    return amounts;
  }, []);

  const realms = useMemo(
    () =>
      realmEntityIds.map((realmEntityId) => {
        const _realm = getRealm(realmEntityId.realmId);
        const _resources = hyperstructureData?.initialzationResources.map((resource) => ({
          id: resource.resourceId,
          balance: getComponentValue(
            Resource,
            getEntityIdFromKeys([BigInt(realmEntityId.realmEntityId), BigInt(resource.resourceId)]),
          ),
        }));
        return { ..._realm, entity_id: realmEntityId.realmEntityId, resources: _resources };
      }),
    [realmEntityIds],
  );

  const canSendCaravan = useMemo(() => {
    return selectedCaravan !== 0 || (isNewCaravan && hasEnoughDonkeys);
  }, [selectedCaravan, hasEnoughDonkeys, isNewCaravan]);

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
    if (donkeysCount * 100 >= resourceWeight) {
      setHasEnoughDonkeys(true);
    } else {
      setHasEnoughDonkeys(false);
    }
  }, [donkeysCount, resourceWeight]);

  return (
    <div className="flex flex-col items-center p-2">
      {step == 1 && (
        <>
          <div className="flex flex-col space-y-2 text-xs">
            <div className="flex justify-between">
              <div className="flex items-center">
                {<OrderIcon order={orderNameDict[order]} size="xs" className="mx-1" />}
                <span className="text-white font-bold">{orders[order - 1].fullOrderName}</span>
              </div>
              <div className="flex flex-col text-xxs text-right">
                <span className="text-gray-gold italic">State</span>
                <span className="text-order-giants">Not initialized</span>
              </div>
            </div>
            <ProgressBar rounded progress={hyperstructureData?.progress || 0} className="bg-gold" />
            <div className="relative w-full">
              <img src={`/images/buildings/hyperstructure.jpg`} className="object-cover w-full h-full rounded-[10px]" />
              <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
                <div className="mb-1 ml-1 italic text-light-pink text-xxs">Initialization cost:</div>
                <div className="grid grid-cols-4 gap-2">
                  {hyperstructureData?.initialzationResources.map(({ resourceId, amount }) => (
                    <ResourceCost
                      withTooltip
                      type="vertical"
                      key={resourceId}
                      resourceId={resourceId}
                      amount={amount}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Headline size="big">Initialize - Step {step}</Headline>
            <div className="text-xxs mb-2 italic text-gold">
              {`To start construction of the Hyperstructure you need to send a caravan with initial cost of resources to the Hyperstructure location.`}
            </div>

            <div className="text-xxs mb-2 italic text-white">{`Press "Next" button to select a Realm with enough resources.`}</div>
          </div>
        </>
      )}
      {step == 2 && (
        <div className="flex flex-col w-full space-y-2">
          <Headline size="big">Select Realm - Step {step}</Headline>
          <div className="text-xxs mb-2 italic text-gold">
            {`Press "Initialize construction" on any Realm with enough resources, to send caravan to Hyperstructure.`}
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
            />
          ))}
        </div>
      )}
      {step == 3 && (
        <>
          <SelectCaravanPanel
            donkeysCount={donkeysCount}
            setDonkeysCount={setDonkeysCount}
            isNewCaravan={isNewCaravan}
            setIsNewCaravan={setIsNewCaravan}
            selectedCaravan={selectedCaravan}
            setSelectedCaravan={setSelectedCaravan}
            selectedResourceIdsGet={[]}
            selectedResourcesGetAmounts={[]}
            selectedResourceIdsGive={initializeResourceIds}
            selectedResourcesGiveAmounts={initializeResourceAmounts}
            resourceWeight={resourceWeight}
            hasEnoughDonkeys={hasEnoughDonkeys}
            headline="Select Caravan - Step 3"
          />
        </>
      )}
      <div className="flex justify-between items-center mt-2 w-full text-xxs">
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
                initHyperStructure();
              } else {
                setStep(step + 1);
              }
            }}
            variant={canGoToNextStep ? "success" : "outline"}
          >
            {step == 3 ? "Send Caravan" : "Next Step"}
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
