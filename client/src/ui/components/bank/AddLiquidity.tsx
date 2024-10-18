import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useIsResourcesLocked } from "@/hooks/helpers/useStructures";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { ContractAddress, ID, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import { ConfirmationPopup } from "./ConfirmationPopup";
import { LiquidityResourceRow } from "./LiquidityResourceRow";
import { LiquidityTableHeader } from "./LiquidityTable";
import { ResourceBar } from "./ResourceBar";

const AddLiquidity = ({
  bankEntityId,
  entityId,
  listResourceId,
}: {
  bankEntityId: ID;
  entityId: ID;
  listResourceId: number;
}) => {
  const {
    account: { account },
    setup,
  } = useDojo();

  const { getBalance } = getResourceBalance();

  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<ResourcesIds>(ResourcesIds.Wood);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [openConfirmation, setOpenConfirmation] = useState(false);

  const marketManager = useMemo(
    () => new MarketManager(setup, bankEntityId, ContractAddress(account.address), resourceId),
    [setup, bankEntityId, resourceId, account.address],
  );

  useEffect(() => {
    setResourceId(listResourceId);
  }, [listResourceId]);

  useEffect(() => {
    const optimalResourceAmout = marketManager.quoteResource(lordsAmount);
    if (resourceAmount !== optimalResourceAmout) {
      setResourceAmount(optimalResourceAmout);
    }
  }, [lordsAmount]);

  useEffect(() => {
    const optimalLordsAmout = marketManager.quoteLords(resourceAmount);
    if (lordsAmount !== optimalLordsAmout) {
      setLordsAmount(optimalLordsAmout);
    }
  }, [resourceAmount]);

  const lordsBalance = getBalance(entityId, Number(ResourcesIds.Lords)).balance;
  const resourceBalance = getBalance(entityId, Number(resourceId)).balance;
  const hasEnough =
    lordsBalance >= multiplyByPrecision(lordsAmount) && resourceBalance >= multiplyByPrecision(resourceAmount);

  const isBankResourcesLocked = useIsResourcesLocked(bankEntityId);
  const isMyResourcesLocked = useIsResourcesLocked(entityId);
  const isNotZero = lordsAmount > 0 && resourceAmount > 0;
  const canAdd = hasEnough && isNotZero && !isBankResourcesLocked && !isMyResourcesLocked;

  const onAddLiquidity = () => {
    setIsLoading(true);
    setup.systemCalls
      .add_liquidity({
        signer: account,
        bank_entity_id: bankEntityId,
        entity_id: entityId,
        calls: [
          {
            resource_type: resourceId,
            resource_amount: multiplyByPrecision(resourceAmount),
            lords_amount: multiplyByPrecision(lordsAmount),
          },
        ],
      })
      .finally(() => {
        setIsLoading(false);
        setOpenConfirmation(false);
      });
  };

  const renderConfirmationPopup = useMemo(() => {
    const resourcesToConfirm = [
      { amount: resourceAmount, resourceId: Number(resourceId) },
      { amount: lordsAmount, resourceId: ResourcesIds.Lords },
    ];

    return (
      <ConfirmationPopup
        title="Confirm Deposit"
        isLoading={isLoading}
        onConfirm={onAddLiquidity}
        onCancel={() => setOpenConfirmation(false)}
      >
        <div className="flex items-center justify-center space-x-2">
          {resourcesToConfirm.map((resource, index) => (
            <div key={index} className="flex items-center justify-center">
              <ResourceCost withTooltip amount={resource.amount} resourceId={resource.resourceId} />
            </div>
          ))}
        </div>
      </ConfirmationPopup>
    );
  }, [isLoading, onAddLiquidity, resourceAmount, resourceId, lordsAmount]);

  return (
    <>
      <div className="bg-gold/10 p-1 ">
        <div className="p-2 mb-2 relative space-y-1">
          <ResourceBar
            entityId={entityId}
            resources={resources.filter((r) => r.id === Number(ResourcesIds.Lords))}
            amount={Math.floor(lordsAmount)}
            lordsFee={0}
            setAmount={setLordsAmount}
            resourceId={ResourcesIds.Lords}
            setResourceId={setResourceId}
            max={divideByPrecision(lordsBalance)}
          />

          <ResourceBar
            entityId={entityId}
            resources={resources.filter((r) => r.id !== Number(ResourcesIds.Lords))}
            amount={Math.floor(resourceAmount)}
            lordsFee={0}
            setAmount={setResourceAmount}
            resourceId={resourceId}
            setResourceId={setResourceId}
            max={divideByPrecision(resourceBalance)}
          />
        </div>
        <div className="p-2">
          <LiquidityTableHeader />
          <LiquidityResourceRow bankEntityId={bankEntityId} entityId={entityId} resourceId={resourceId} />
          <div className="w-full flex flex-col justify-center mt-4">
            <Button
              variant="primary"
              isLoading={false}
              disabled={!canAdd}
              className="text-brown bg-brown/90"
              onClick={() => setOpenConfirmation(true)}
            >
              Add Liquidity
            </Button>
            {!canAdd && (
              <div className="px-3 mt-2 mb-1 text-danger font-bold text-center">
                {!isNotZero && <div>Warning: Amount must be greater than zero</div>}
                {!hasEnough && <div>Warning: Not enough resources for this operation</div>}
                {isBankResourcesLocked && <div>Warning: Bank resources are currently locked</div>}
                {isMyResourcesLocked && <div>Warning: Your resources are currently locked</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      {openConfirmation && renderConfirmationPopup}
    </>
  );
};

export default AddLiquidity;
