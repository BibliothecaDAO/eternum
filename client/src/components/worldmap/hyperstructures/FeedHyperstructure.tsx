import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../elements/SecondaryPopup";
import Button from "../../../elements/Button";
import { SelectCaravanPanel } from "../../cityview/realm/trade/CreateOffer";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { getRealm } from "../../../utils/realms";
import { getComponentValue } from "@latticexyz/recs";
import { getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../../utils/utils";
import { useDojo } from "../../../DojoContext";
import { Steps } from "../../../elements/Steps";
import { Headline } from "../../../elements/Headline";
import { OrderIcon } from "../../../elements/OrderIcon";
import { orderNameDict, orders } from "../../../constants/orders";
import { ResourceCost } from "../../../elements/ResourceCost";
import clsx from "clsx";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import hyperstructure from "../../../data/hyperstructures.json";

type FeedHyperstructurePopupProps = {
  onClose: () => void;
  order: number;
};

export const FeedHyperstructurePopup = ({ onClose, order }: FeedHyperstructurePopupProps) => {
  const [selectedCaravan, setSelectedCaravan] = useState<number>(0);
  const [isNewCaravan, setIsNewCaravan] = useState(false);
  const [donkeysCount, setDonkeysCount] = useState(1);
  const [hasEnoughDonkeys, setHasEnoughDonkeys] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  const { getHyperstructure } = useHyperstructure();

  const hyperstructureData = getHyperstructure(
    order,
    // TODO: change z to y when right one
    getContractPositionFromRealPosition({ x: hyperstructure[order - 1].x, y: hyperstructure[order - 1].z }),
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
    resourceWeight += amount * 1;
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
      amounts[resource.resourceId] = resource.amount;
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
    return true;
  }, []);

  useEffect(() => {
    if (donkeysCount * 100 >= resourceWeight) {
      setHasEnoughDonkeys(true);
    } else {
      setHasEnoughDonkeys(false);
    }
  }, [donkeysCount, resourceWeight]);

  return (
    <SecondaryPopup name="hyperstructure">
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Manage Hyperstructure:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"500px"}>
        <div className="flex flex-col space-y-2 p-3 text-xs">
          <Headline size="big">Hyperstructure Status:</Headline>
          <div className="flex flex-col space-y-1">
            <div className="flex">
              <span className="text-gray-gold">Order:</span>
              {<OrderIcon order={orderNameDict[order]} size="xs" className="mx-1" />}
              <span className="text-gold">{orders[order - 1].fullOrderName}</span>
            </div>
            <div>
              <span className="text-gray-gold">State:</span>
              <span className="text-order-giants ml-1">Not initialized</span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-gold">Required resources:</span>
              <div className="flex items-center">
                {hyperstructureData?.initialzationResources.map((resource) => {
                  return (
                    <ResourceCost key={resource.resourceId} resourceId={resource.resourceId} amount={resource.amount} />
                  );
                })}
              </div>
            </div>
          </div>
          <Headline size="big">Initialize - Step {step}</Headline>
          <div className="text-xxs mb-2 italic text-gold">
            {`To start construction of the Hyperstructure you need to send a caravan with initial cost of resources to the Hyperstructure location.`}
          </div>
          {step == 1 && (
            <>
              <div className="text-xxs mb-2 italic text-white">{`Step 1: Select a Realm with enough resources.`}</div>
              <div className="flex flex-col space-y-2">
                {realms.map((realm) => (
                  <SelectableRealm
                    key={realm.realm_id}
                    realm={realm}
                    onClick={() => {
                      setRealmEntityId(realm.entity_id);
                    }}
                    selected={realmEntityId === realm.entity_id}
                  />
                ))}
              </div>
            </>
          )}
          {step == 2 && (
            <>
              <div className="text-xxs mb-2 italic text-white">{`Step 2: Select or summon a caravan and send it to Hyperstructure location`}</div>
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
              />
            </>
          )}
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <Button
            className="!px-[6px] !py-[2px] text-xxs"
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            variant="outline"
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Steps className="absolute -translate-x-1/2 left-1/2 bottom-4" step={step} maxStep={2} />
          {!isLoading && (
            <Button
              className="!px-[6px] !py-[2px] text-xxs ml-auto"
              disabled={!canGoToNextStep}
              isLoading={isLoading}
              onClick={() => {
                setStep(step + 1);
              }}
              variant={canGoToNextStep ? "success" : "danger"}
            >
              {step == 2 ? "Send Caravan" : "Next Step"}
            </Button>
          )}
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const SelectableRealm = ({ realm, selected = false, ...props }: any) => {
  return (
    <div
      className={clsx(
        "flex items-center p-2 border rounded-md text-xxs text-gray-gold",
        selected ? "border-order-brilliance" : "border-gray-gold",
      )}
      {...props}
    >
      <OrderIcon order={orderNameDict[realm.order]} size="xs" className="mx-1" />
      <div>{realm.name}</div>
      <div className="flex ml-auto">
        {realm.resources.map((resource: any) => {
          return <ResourceCost key={resource.id} resourceId={resource.id} amount={resource.balance.balance} />;
        })}
      </div>
    </div>
  );
};
