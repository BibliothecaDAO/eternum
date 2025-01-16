import { useDojo } from "@/hooks/context/dojo-context";
import { usePlayerStructures } from "@/hooks/helpers/use-entities";
import { useIsStructureResourcesLocked } from "@/hooks/helpers/use-resources";
import { ConfirmationPopup } from "@/ui/components/bank/confirmation-popup";
import { LiquidityResourceRow } from "@/ui/components/bank/liquidity-resource-row";
import { LiquidityTableHeader } from "@/ui/components/bank/liquidity-table";
import { ResourceBar } from "@/ui/components/bank/resource-bar";
import Button from "@/ui/elements/button";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { getBalance } from "@/utils/resources";
import { ContractAddress, ID, MarketManager, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";

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

  const playerStructures = usePlayerStructures(ContractAddress(account.address));

  const playerStructureIds = playerStructures.map((structure) => structure.entity_id);

  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<ResourcesIds>(ResourcesIds.Wood);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [openConfirmation, setOpenConfirmation] = useState(false);

  const marketManager = useMemo(
    () => new MarketManager(setup.components, bankEntityId, ContractAddress(account.address), resourceId),
    [setup, bankEntityId, resourceId, account.address],
  );

  useEffect(() => {
    setResourceId(listResourceId);
  }, [listResourceId]);

  useEffect(() => {
    if (!marketManager.hasReserves()) return;
    const optimalResourceAmout = marketManager.quoteResource(lordsAmount);
    if (resourceAmount !== optimalResourceAmout) {
      setResourceAmount(optimalResourceAmout);
    }
  }, [lordsAmount]);

  useEffect(() => {
    if (!marketManager.hasReserves()) return;
    const optimalLordsAmout = marketManager.quoteLords(resourceAmount);
    if (lordsAmount !== optimalLordsAmout) {
      setLordsAmount(optimalLordsAmout);
    }
  }, [resourceAmount]);

  const lordsBalance = getBalance(entityId, Number(ResourcesIds.Lords), setup.components).balance;
  const resourceBalance = getBalance(entityId, Number(resourceId), setup.components).balance;
  const hasEnough =
    lordsBalance >= multiplyByPrecision(lordsAmount) && resourceBalance >= multiplyByPrecision(resourceAmount);

  const isBankResourcesLocked = useIsStructureResourcesLocked(bankEntityId);
  const isMyResourcesLocked = useIsStructureResourcesLocked(entityId);
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
          <LiquidityResourceRow
            playerStructureIds={playerStructureIds}
            bankEntityId={bankEntityId}
            entityId={entityId}
            resourceId={resourceId}
          />
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
