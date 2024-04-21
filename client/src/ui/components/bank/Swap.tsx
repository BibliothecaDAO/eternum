import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import { divideByPrecision, getEntityIdFromKeys, multiplyByPrecision } from "@/ui/utils/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import { useComponentValue } from "@dojoengine/react";
import { ResourceBar } from "@/ui/components/bank/ResourceBar";
import { resources } from "@bibliothecadao/eternum";

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

  const market = useComponentValue(Market, getEntityIdFromKeys([bankEntityId, resourceId]));
  const marketManager = useMemo(
    () => new MarketManager(Market, Liquidity, bankEntityId, BigInt(account.address), resourceId),
    [Market, Liquidity, bankEntityId, resourceId, account.address, market],
  );

  useEffect(() => {
    const amount = isBuyResource ? lordsAmount : resourceAmount;
    const setAmount = isBuyResource ? setResourceAmount : setLordsAmount;
    const operation = isBuyResource ? marketManager.buyResource : marketManager.sellResource;

    if (amount > 0) {
      const resource = operation(multiplyByPrecision(amount));
      setAmount(divideByPrecision(resource));
    }
  }, [lordsAmount, resourceAmount, isBuyResource, marketManager]);

  const hasEnough = useMemo(() => {
    const amount = isBuyResource ? lordsAmount : resourceAmount;
    const balanceId = isBuyResource ? LORDS_RESOURCE_ID : resourceId;
    return multiplyByPrecision(amount) <= getBalance(entityId, Number(balanceId)).balance;
  }, [isBuyResource, lordsAmount, resourceAmount, getBalance, entityId, resourceId]);

  const canSwap = useMemo(
    () => lordsAmount > 0 && resourceAmount > 0 && hasEnough,
    [lordsAmount, resourceAmount, hasEnough],
  );

  const onInvert = useCallback(() => setIsBuyResource((prev) => !prev), []);

  const marketPrice = marketManager.getMarketPrice();
  const slippage = (marketPrice - lordsAmount / resourceAmount) * 100;
  const onSwap = useCallback(() => {
    setIsLoading(true);
    const operation = isBuyResource ? buy_resources : sell_resources;
    operation({
      signer: account,
      bank_entity_id: bankEntityId,
      resource_type: resourceId,
      amount: multiplyByPrecision(isBuyResource ? resourceAmount : lordsAmount),
    }).finally(() => setIsLoading(false));
  }, [isBuyResource, buy_resources, sell_resources, account, bankEntityId, resourceId, resourceAmount, lordsAmount]);

  const renderResourceBar = useCallback(
    (disableInput: boolean, isLords: boolean) => (
      <ResourceBar
        entityId={entityId}
        resources={isLords ? [resources[0]] : resources.slice(1)}
        amount={isLords ? lordsAmount : resourceAmount}
        setAmount={isLords ? setLordsAmount : setResourceAmount}
        resourceId={isLords ? LORDS_RESOURCE_ID : resourceId}
        setResourceId={setResourceId}
        disableInput={disableInput}
      />
    ),
    [entityId, lordsAmount, resourceAmount, resourceId],
  );

  return (
    <div>
      <div className="p-2 relative">
        {isBuyResource ? renderResourceBar(false, true) : renderResourceBar(false, false)}
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
        {isBuyResource ? renderResourceBar(true, false) : renderResourceBar(true, true)}
        <div className="w-full flex flex-col justify-center mt-2">
          <Button className="text-brown" isLoading={isLoading} disabled={!canSwap} onClick={onSwap} variant="primary">
            Swap
          </Button>
          {!canSwap && <div className="ml-1 text-danger">Warning: not enough resources or amount is zero</div>}
        </div>
      </div>
      <div className="p-2">
        <div className="mb-2">
          <div>Price: {marketPrice.toFixed(2)} $LORDS</div>
          {marketPrice > 0 && <div className="text-order-giants">Slippage: {slippage.toFixed(2)} %</div>}
        </div>
        <Button onClick={onSwap} variant="primary">
          Swap
        </Button>
      </div>
    </div>
  );
};
