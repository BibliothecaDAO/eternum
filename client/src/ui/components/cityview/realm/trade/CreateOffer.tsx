import { useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ResourceCost } from "../../../../elements/ResourceCost";
import { NumberInput } from "../../../../elements/NumberInput";
import { SelectableResource } from "../../../../elements/SelectableResource";
import { ONE_MONTH, resources } from "@bibliothecadao/eternum";
import { ReactComponent as ArrowSeparator } from "@/assets/icons/common/arrow-separator.svg";
import { Steps } from "../../../../elements/Steps";
import { useDojo } from "../../../../../hooks/context/DojoContext";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { divideByPrecision, multiplyByPrecision } from "../../../../utils/utils";
import { useRealm } from "../../../../../hooks/helpers/useRealm";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { TradeRealmSelector } from "./TradeRealmSelector";
import { TravelInfo } from "@/ui/components/resources/ResourceWeight";

interface CreateOfferPopupProps {
  onClose: () => void;
  onCreate: () => void;
}

export const CreateOfferPopup = ({ onClose }: CreateOfferPopupProps) => {
  const [step, setStep] = useState<number>(1);
  const [selectedResourceIdsGive, setSelectedResourceIdsGive] = useState<number[]>([]);
  const [selectedResourceIdsGet, setSelectedResourceIdsGet] = useState<number[]>([]);
  const [selectedResourcesGiveAmounts, setSelectedResourcesGiveAmounts] = useState<Record<number, number>>({});
  const [selectedResourcesGetAmounts, setSelectedResourcesGetAmounts] = useState<Record<number, number>>({});
  const [selectedRealmEntityId, setSelectedRealmEntityId] = useState<bigint | undefined>();
  const [selectedRealmId, setSelectedRealmId] = useState<bigint | undefined>();
  const [canCarry, setCanCarry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    account: { account },
    setup: {
      systemCalls: { create_order },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { getRealmEntityIdFromRealmId } = useRealm();

  const onSelectRealmId = (realmId: bigint) => {
    const entityId = getRealmEntityIdFromRealmId(realmId);
    entityId && setSelectedRealmEntityId(entityId);
  };

  const createOrder = async () => {
    setIsLoading(true);
    if (!nextBlockTimestamp) return;
    await create_order({
      signer: account,
      maker_id: realmEntityId,
      maker_gives_resources: selectedResourceIdsGive.flatMap((id) => [
        id,
        multiplyByPrecision(selectedResourcesGiveAmounts[id]),
      ]),
      taker_id: selectedRealmEntityId || 0,
      taker_gives_resources: selectedResourceIdsGet.flatMap((id) => [
        id,
        multiplyByPrecision(selectedResourcesGetAmounts[id]),
      ]),
      expires_at: nextBlockTimestamp + ONE_MONTH,
    });
    onClose();
  };

  const canGoToNextStep = useMemo(() => {
    if (step === 1) {
      return selectedResourceIdsGive.length > 0 && selectedResourceIdsGet.length > 0;
    } else if (step === 3) {
      return canCarry;
    } else {
      return true;
    }
  }, [step, selectedResourceIdsGet, selectedResourceIdsGive, canCarry]);

  return (
    <SecondaryPopup name="create-offer">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Create Offer:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"476px"}>
        <div className="flex flex-col items-center p-2">
          {step == 1 && (
            <SelectResourcesPanel
              selectedResourceIdsGive={selectedResourceIdsGive}
              setSelectedResourceIdsGive={(e) => {
                setSelectedResourceIdsGive(e);
                setSelectedResourcesGiveAmounts(Object.fromEntries(e.map((id) => [id, 1])));
              }}
              selectedResourceIdsGet={selectedResourceIdsGet}
              setSelectedResourceIdsGet={(e) => {
                setSelectedResourceIdsGet(e);
                setSelectedResourcesGetAmounts(Object.fromEntries(e.map((id) => [id, 1])));
              }}
            />
          )}
          {step == 2 && (
            <SelectResourcesAmountPanel
              selectedResourceIdsGive={selectedResourceIdsGive}
              selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
              setSelectedResourcesGiveAmounts={setSelectedResourcesGiveAmounts}
              selectedResourceIdsGet={selectedResourceIdsGet}
              selectedResourcesGetAmounts={selectedResourcesGetAmounts}
              setSelectedResourcesGetAmounts={setSelectedResourcesGetAmounts}
              selectedRealmId={selectedRealmId}
              setSelectedRealmId={setSelectedRealmId}
              setCanCarry={setCanCarry}
            />
          )}
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <Button
            className="!px-[6px] !py-[2px] text-xxs"
            onClick={() => {
              step === 1 ? onClose() : setStep(step - 1);
            }}
            variant="outline"
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Steps className="absolute -translate-x-1/2 left-1/2 bottom-4" step={step} maxStep={3} />
          {!isLoading && (
            <Button
              className="!px-[6px] !py-[2px] text-xxs"
              disabled={!canGoToNextStep}
              onClick={() => {
                if (step === 3) {
                  createOrder();
                } else {
                  if (step === 2) {
                    selectedRealmId && onSelectRealmId(selectedRealmId);
                  }
                  setStep(step + 1);
                }
              }}
              variant={canGoToNextStep ? "success" : "danger"}
            >
              {step == 3 ? (selectedRealmId ? "Create Direct Offer" : "Create Public Offer") : "Next Step"}
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
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const SelectResourcesPanel = ({
  selectedResourceIdsGive,
  setSelectedResourceIdsGive,
  selectedResourceIdsGet,
  setSelectedResourceIdsGet,
}: {
  selectedResourceIdsGive: number[];
  setSelectedResourceIdsGive: (selectedResourceIds: number[]) => void;
  selectedResourceIdsGet: number[];
  setSelectedResourceIdsGet: (selectedResourceIds: number[]) => void;
}) => {
  const { getBalance } = useResourceBalance();

  const { realmEntityId } = useRealmStore();

  return (
    <div className="grid grid-cols-9 gap-2 p-2 relative">
      <div className="flex flex-col items-center col-span-4">
        <Headline className="mb-2">You Give</Headline>
        <div className="grid grid-cols-4 gap-2">
          {resources.map(({ id, trait: _name }) => {
            const resource = getBalance(realmEntityId, id);
            return (
              <SelectableResource
                key={id}
                resourceId={id}
                amount={resource?.balance || 0}
                disabled={(resource?.balance || 0) === 0 || selectedResourceIdsGet.includes(id)}
                selected={selectedResourceIdsGive.includes(id)}
                onClick={() => {
                  if (selectedResourceIdsGive.includes(id)) {
                    setSelectedResourceIdsGive(selectedResourceIdsGive.filter((_id) => _id !== id));
                  } else {
                    setSelectedResourceIdsGive([...selectedResourceIdsGive, id]);
                  }
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center">
        <ArrowSeparator className="sticky top-1/2 -translate-y-1/2" />
      </div>
      <div className="flex flex-col items-center col-span-4">
        <Headline className="mb-2">You Get</Headline>
        <div className="grid grid-cols-4 gap-2">
          {resources.map(({ id, trait: _name }) => {
            const resource = getBalance(realmEntityId, id);
            return (
              <SelectableResource
                key={id}
                resourceId={id}
                amount={resource?.balance || 0}
                selected={selectedResourceIdsGet.includes(id)}
                disabled={selectedResourceIdsGive.includes(id)}
                onClick={() => {
                  if (selectedResourceIdsGet.includes(id)) {
                    setSelectedResourceIdsGet(selectedResourceIdsGet.filter((_id) => _id !== id));
                  } else {
                    setSelectedResourceIdsGet([...selectedResourceIdsGet, id]);
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SelectResourcesAmountPanel = ({
  selectedResourceIdsGive,
  selectedResourceIdsGet,
  selectedResourcesGiveAmounts,
  selectedResourcesGetAmounts,
  setSelectedResourcesGiveAmounts,
  setSelectedResourcesGetAmounts,
  selectedRealmId,
  setSelectedRealmId,
  setCanCarry,
}: {
  selectedResourceIdsGive: number[];
  selectedResourceIdsGet: number[];
  selectedResourcesGiveAmounts: Record<number, number>;
  selectedResourcesGetAmounts: Record<number, number>;
  setSelectedResourcesGiveAmounts: (selectedResourcesGiveAmounts: Record<number, number>) => void;
  setSelectedResourcesGetAmounts: (selectedResourcesGetAmounts: Record<number, number>) => void;
  selectedRealmId: bigint | undefined;
  setSelectedRealmId: (selectedRealmId: bigint) => void;
  setCanCarry: (canCarry: boolean) => void;
}) => {
  const { realmEntityId } = useRealmStore();

  const { getBalance } = useResourceBalance();

  return (
    <>
      <div className="grid grid-cols-9 gap-2 p-2 max-h-[250px] overflow-y-auto overflow-x-hidden relative">
        <div className="flex flex-col items-center col-span-4 space-y-2">
          <Headline className="mb-2">You Give</Headline>
          {selectedResourceIdsGive.map((id) => {
            const resource = getBalance(realmEntityId, id);
            return (
              <div key={id} className="flex items-center w-full">
                <NumberInput
                  max={divideByPrecision(Number(resource?.balance) || 0)}
                  min={1}
                  value={Number(selectedResourcesGiveAmounts[id].toString())}
                  onChange={(value) => {
                    setSelectedResourcesGiveAmounts({
                      ...selectedResourcesGiveAmounts,
                      [id]: Math.min(divideByPrecision(resource?.balance || 0), value),
                    });
                  }}
                />
                <div className="ml-2">
                  <ResourceCost
                    onClick={() => {
                      setSelectedResourcesGiveAmounts({
                        ...selectedResourcesGiveAmounts,
                        [id]: divideByPrecision(resource?.balance || 0),
                      });
                    }}
                    resourceId={id}
                    amount={divideByPrecision(resource?.balance || 0)}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center">
          <ArrowSeparator className="sticky top-1/2 -translate-y-1/2" />
        </div>
        <div className="flex flex-col items-center col-span-4 space-y-2">
          <Headline className="mb-2">You Get</Headline>
          {selectedResourceIdsGet.map((id) => {
            const resource = getBalance(realmEntityId, id);

            return (
              <div key={id} className="flex items-center w-full">
                <NumberInput
                  max={100000}
                  min={1}
                  value={selectedResourcesGetAmounts[id]}
                  onChange={(value) => {
                    setSelectedResourcesGetAmounts({
                      ...selectedResourcesGetAmounts,
                      [id]: value,
                    });
                  }}
                />
                <div className="ml-2">
                  <ResourceCost resourceId={id} amount={divideByPrecision(resource?.balance || 0)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <TravelInfo
        entityId={realmEntityId}
        resources={selectedResourceIdsGet.map((resourceId) => ({
          resourceId,
          amount: selectedResourcesGetAmounts[resourceId],
        }))}
        setCanCarry={setCanCarry}
      />
      <TradeRealmSelector
        selectedRealmId={selectedRealmId}
        setSelectedRealmId={setSelectedRealmId}
      ></TradeRealmSelector>
    </>
  );
};
