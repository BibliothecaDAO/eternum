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
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";

const LORDS_RESOURCE_ID = 253n;

export const ResourceSwap = ({ bankEntityId, entityId }: { bankEntityId: bigint; entityId: bigint }) => {
  const {
    account: { account },
    setup: {
      components: { Market, Liquidity },
      systemCalls: { buy_resources, sell_resources },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();

  const [isBuyResource, setIsBuyResource] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<bigint>(1n);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);

  const marketManager = useMemo(
    () => new MarketManager(Market, Liquidity, bankEntityId, BigInt(account.address), BigInt(resourceId)),
    [Market, Liquidity, bankEntityId, resourceId, account.address],
  );

  useEffect(() => {
    if (isBuyResource) {
      const resource = marketManager.buyResource(multiplyByPrecision(lordsAmount));
      setResourceAmount(divideByPrecision(resource));
    }
  }, [lordsAmount]);

  useEffect(() => {
    if (!isBuyResource) {
      const resource = marketManager.sellResource(multiplyByPrecision(resourceAmount));
      setLordsAmount(divideByPrecision(resource));
    }
  }, [resourceAmount]);

  const hasEnough = isBuyResource
    ? multiplyByPrecision(lordsAmount) <= getBalance(entityId, Number(LORDS_RESOURCE_ID)).balance
    : multiplyByPrecision(resourceAmount) <= getBalance(entityId, Number(resourceId)).balance;

  const isNotZero = lordsAmount > 0 && resourceAmount > 0;

  const canSwap = hasEnough && isNotZero;

  const onInvert = () => {
    setIsBuyResource((prev) => !prev);
  };

  const onSwap = () => {
    isBuyResource ? onBuy() : onSell();
  };

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

  const lordsBar = (disableInput: boolean) => (
    <SwapBar
      entityId={entityId}
      resources={[resources[0]]}
      amount={lordsAmount}
      setAmount={setLordsAmount}
      resourceId={LORDS_RESOURCE_ID}
      setResourceId={setResourceId}
      disableInput={disableInput}
    />
  );

  const resourceBar = (disableInput: boolean) => (
    <SwapBar
      entityId={entityId}
      resources={resources.slice(1, resources.length)}
      amount={resourceAmount}
      setAmount={setResourceAmount}
      resourceId={resourceId}
      setResourceId={setResourceId}
      disableInput={disableInput}
    />
  );

  return (
    <div>
      <div className="p-2 relative">
        {isBuyResource ? lordsBar(false) : resourceBar(false)}
        <div className="w-full absolute top-1/4 left-1/3">
          <Button
            className="text-brown bg-brown"
            isLoading={false}
            disabled={false}
            onClick={onInvert}
            variant="primary"
          >
            <Refresh className="text-gold cursor-pointer h-7"></Refresh>
          </Button>
        </div>
        {isBuyResource ? resourceBar(true) : lordsBar(true)}
        <div className="w-full flex flex-col justify-center mt-2">
          <Button className="text-brown" isLoading={isLoading} disabled={!canSwap} onClick={onSwap} variant="primary">
            Swap
          </Button>
          {!canSwap && <div className="ml-1 text-danger">Warning: not enough resources or amount is zero</div>}
        </div>
      </div>
      <div className="p-2">
        <h3>Rate: 1:1</h3>
        <Button onClick={onSwap} variant="primary">
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
  disableInput = false,
}: {
  entityId: bigint;
  resources: Resources[];
  resourceId: bigint;
  setResourceId: (resourceId: bigint) => void;
  amount: number;
  setAmount: (amount: number) => void;
  disableInput?: boolean;
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
    !disableInput && setAmount && setAmount(parseInt(amount));
  };

  return (
    <div className="w-full rounded border p-2 flex justify-between">
      <div className="self-center">
        <TextInput value={amount.toString()} onChange={(amount) => handleAmountChange(amount)} />
        {!disableInput && (
          <div className="text-xs text-white" onClick={() => handleAmountChange(selectedResourceBalance.toString())}>
            Max: {selectedResourceBalance}
          </div>
        )}
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
