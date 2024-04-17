import Button from "@/ui/elements/Button";
import { resources } from "@bibliothecadao/eternum";
import { useState } from "react";
import { SwapBar } from "./Swap";

const LORDS_RESOURCE_ID = 253n;

const AddLiquidity = ({ entityId }: { entityId: bigint }) => {
  const [resourceId, setResourceId] = useState<bigint>(1n);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);

  const canAdd = lordsAmount > 0 && resourceAmount > 0;

  return (
    <div>
      <div className="p-2 relative">
        <SwapBar
          entityId={entityId}
          resources={[resources[0]]}
          amount={lordsAmount}
          setAmount={setLordsAmount}
          resourceId={LORDS_RESOURCE_ID}
          setResourceId={setResourceId}
        />

        <div className="w-full mt-2 absolute top-1/3 left-1/3">
          <Button disabled={!canAdd} className="text-brown" onClick={() => console.log("")} variant="primary">
            Add Liquidity
          </Button>
        </div>

        <SwapBar
          entityId={entityId}
          resources={resources.slice(1, resources.length)}
          amount={resourceAmount}
          setAmount={setResourceAmount}
          resourceId={resourceId}
          setResourceId={setResourceId}
        />
      </div>
    </div>
  );
};

export default AddLiquidity;
