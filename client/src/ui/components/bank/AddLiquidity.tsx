import Button from "@/ui/elements/Button";
import { ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import { useDojo } from "@/hooks/context/DojoContext";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { ResourceBar } from "./ResourceBar";
import { MarketManager } from "@/dojo/modelManager/MarketManager";

const AddLiquidity = ({ bank_entity_id, entityId }: { bank_entity_id: bigint; entityId: bigint }) => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { add_liquidity },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();

  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<bigint>(1n);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);

  const marketManager = useMemo(
    () =>
      new MarketManager(
        components.Market,
        components.Liquidity,
        bank_entity_id,
        BigInt(account.address),
        BigInt(resourceId),
      ),
    [components.Market, components.Liquidity, bank_entity_id, resourceId, account.address],
  );

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

  const hasEnough =
    getBalance(entityId, Number(ResourcesIds.Lords)).balance >= multiplyByPrecision(lordsAmount) &&
    getBalance(entityId, Number(resourceId)).balance >= multiplyByPrecision(resourceAmount);

  const isNotZero = lordsAmount > 0 && resourceAmount > 0;
  const canAdd = hasEnough && isNotZero;

  const onAddLiquidity = () => {
    setIsLoading(true);
    add_liquidity({
      bank_entity_id,
      entity_id: entityId,
      lords_amount: multiplyByPrecision(lordsAmount),
      resource_type: resourceId,
      resource_amount: multiplyByPrecision(resourceAmount),
      signer: account,
    })
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));
  };

  return (
    <div className="bg-gold/10 p-1 clip-angled-sm">
      <div className="p-2 relative space-y-1">
        <ResourceBar
          entityId={entityId}
          resources={resources.filter((r) => r.id === Number(ResourcesIds.Lords))}
          amount={Math.floor(lordsAmount)}
          lordsFee={0}
          setAmount={setLordsAmount}
          resourceId={BigInt(ResourcesIds.Lords)}
          setResourceId={setResourceId}
        />

        <div className="mt-2 absolute top-[97px] left-1/3">
          <Button
            variant="primary"
            isLoading={isLoading}
            disabled={!canAdd}
            className="text-brown bg-brown"
            onClick={onAddLiquidity}
          >
            Add Liquidity
          </Button>
        </div>

        <ResourceBar
          entityId={entityId}
          resources={resources.filter((r) => r.id !== Number(ResourcesIds.Lords))}
          amount={Math.floor(resourceAmount)}
          lordsFee={0}
          setAmount={setResourceAmount}
          resourceId={resourceId}
          setResourceId={setResourceId}
        />
      </div>
      {!canAdd && <div className="p-2 text-danger font-bold text-md">Not enough resources or amount is zero</div>}
    </div>
  );
};

export default AddLiquidity;
