import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import TextInput from "@/ui/elements/TextInput";
import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { Resources, findResourceById, findResourceIdByTrait, resources } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";

const LORDS_RESOURCE_ID = 253n;

export const ResourceSwap = ({ bankEntityId, entityId }: { bankEntityId: bigint; entityId: bigint }) => {
  const {
    account: { account },
    setup: {
      components: { Market, Liquidity },
      systemCalls: { buy_resources, sell_resources },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<bigint>(1n);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);

  const marketManager = useMemo(
    () => new MarketManager(Market, Liquidity, bankEntityId, BigInt(account.address), BigInt(resourceId)),
    [Market, Liquidity, bankEntityId, resourceId, account.address],
  );

  useEffect(() => {
    const buyResource = marketManager.buyResource(multiplyByPrecision(lordsAmount));
    setResourceAmount(divideByPrecision(buyResource));
  }, [lordsAmount]);

  const canSwap = lordsAmount > 0 && resourceAmount > 0;

  const onBuy = () => {
    setIsLoading(true);
    buy_resources({
      signer: account,
      bank_entity_id: bankEntityId,
      resource_type: resourceId,
      amount: multiplyByPrecision(resourceAmount),
    })
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));
  };

  const onSell = () => {
    setIsLoading(true);
    sell_resources({
      signer: account,
      bank_entity_id: bankEntityId,
      resource_type: resourceId,
      amount: multiplyByPrecision(resourceAmount),
    })
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));
  };

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
          <Button className="text-brown" isLoading={isLoading} disabled={!canSwap} onClick={onBuy} variant="primary">
            Swap
          </Button>
        </div>

        <SwapBar
          entityId={entityId}
          resources={resources.slice(1, resources.length)}
          amount={resourceAmount}
          setAmount={() => {}}
          resourceId={resourceId}
          setResourceId={setResourceId}
        />
      </div>
      <div className="p-2">
        <h3>Rate: 1:1</h3>
        <Button onClick={() => console.log("")} variant="primary">
          Swap
        </Button>
      </div>
    </div>
  );
};

export const SwapBar = ({
  entityId,
  resources,
  resourceId,
  setResourceId,
  amount,
  setAmount,
}: {
  entityId: bigint;
  resources: Resources[];
  resourceId: bigint;
  setResourceId: (resourceId: bigint) => void;
  amount: number;
  setAmount: (amount: number) => void;
}) => {
  const { getBalance } = useResourceBalance();

  const [selectedResourceBalance, setSelectedResourceBalance] = useState(0);

  useEffect(() => {
    setSelectedResourceBalance(divideByPrecision(getBalance(entityId, Number(resourceId)).balance));
  }, [resourceId]);

  const handleResourceChange = (trait: string) => {
    const resourceId = findResourceIdByTrait(trait);
    setResourceId && setResourceId(BigInt(resourceId));
  };

  const handleAmountChange = (amount: string) => {
    setAmount && setAmount(Math.min(parseInt(amount), selectedResourceBalance));
  };

  return (
    <div className="w-full rounded border p-2 flex justify-between">
      <div className="self-center">
        <TextInput value={amount.toString()} onChange={(amount) => handleAmountChange(amount)} />
        <div className="text-xs text-white" onClick={() => handleAmountChange(selectedResourceBalance.toString())}>
          Max: {selectedResourceBalance}
        </div>
      </div>

      <Select
        value={findResourceById(Number(resourceId))!.trait}
        onValueChange={(trait) => handleResourceChange(trait)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Resources" />
        </SelectTrigger>
        <SelectContent className="bg-brown text-gold">
          {resources.map((resource, index) => (
            <SelectItem key={index} value={resource.trait}>
              <div className="flex">
                <ResourceCost
                  resourceId={resource.id}
                  amount={divideByPrecision(getBalance(entityId, resource.id).balance)}
                ></ResourceCost>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
