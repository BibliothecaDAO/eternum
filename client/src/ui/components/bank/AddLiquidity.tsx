import Button from "@/ui/elements/Button";
import { resources } from "@bibliothecadao/eternum";
import { useState } from "react";
import { useDojo } from "@/hooks/context/DojoContext";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { ResourceBar } from "./ResourceBar";

const LORDS_RESOURCE_ID = 253n;

const AddLiquidity = ({ bank_entity_id, entityId }: { bank_entity_id: bigint; entityId: bigint }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { add_liquidity },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();

  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<bigint>(1n);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);

  const hasEnough =
    getBalance(entityId, Number(LORDS_RESOURCE_ID)).balance >= multiplyByPrecision(lordsAmount) &&
    getBalance(entityId, Number(resourceId)).balance >= multiplyByPrecision(resourceAmount);

  const isNotZero = lordsAmount > 0 && resourceAmount > 0;
  const canAdd = hasEnough && isNotZero;

  const onAddLiquidity = () => {
    setIsLoading(true);
    add_liquidity({
      bank_entity_id,
      lords_amount: multiplyByPrecision(lordsAmount),
      resource_type: resourceId,
      resource_amount: multiplyByPrecision(resourceAmount),
      signer: account,
    })
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));
  };

  return (
    <div>
      <div className="p-2 relative">
        <ResourceBar
          entityId={entityId}
          resources={resources.filter((r) => r.id === Number(LORDS_RESOURCE_ID))}
          amount={lordsAmount}
          setAmount={setLordsAmount}
          resourceId={LORDS_RESOURCE_ID}
          setResourceId={setResourceId}
        />

        <div className="w-full mt-2 absolute top-1/3 left-1/3">
          <Button
            isLoading={isLoading}
            disabled={!canAdd}
            className="text-brown bg-brown"
            onClick={onAddLiquidity}
            variant="primary"
          >
            Add Liquidity
          </Button>
        </div>

        <ResourceBar
          entityId={entityId}
          resources={resources.filter((r) => r.id !== Number(LORDS_RESOURCE_ID))}
          amount={resourceAmount}
          setAmount={setResourceAmount}
          resourceId={resourceId}
          setResourceId={setResourceId}
        />
      </div>
      {!canAdd && <div className="ml-1 text-danger">Warning: not enough resources or amount is zero</div>}
    </div>
  );
};

export default AddLiquidity;
