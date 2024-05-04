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
const OWNER_FEE = 0.05;
const LP_FEE = 0.05;

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
      const cost = operation(multiplyByPrecision(amount));
      setAmount(divideByPrecision(cost));
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
  const onSwap = useCallback(() => {
    setIsLoading(true);
    const operation = isBuyResource ? buy_resources : sell_resources;
    operation({
      signer: account,
      bank_entity_id: bankEntityId,
      resource_type: resourceId,
      amount: multiplyByPrecision(resourceAmount),
    }).finally(() => setIsLoading(false));
  }, [isBuyResource, buy_resources, sell_resources, account, bankEntityId, resourceId, resourceAmount, lordsAmount]);

  const chosenResourceName = "$" + resources.find((r) => r.id === Number(resourceId))?.trait.toUpperCase();

  const renderResourceBar = useCallback(
    (disableInput: boolean, isLords: boolean) => (
      <ResourceBar
        entityId={entityId}
        resources={
          isLords
            ? resources.filter((r) => r.id === Number(LORDS_RESOURCE_ID))
            : resources.filter((r) => r.id !== Number(LORDS_RESOURCE_ID))
        }
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
      <div className="relative my-2 space-y-1">
        {isBuyResource ? renderResourceBar(false, true) : renderResourceBar(false, false)}
        <div className="absolute top-[49px] left-1/3">
          <Button
            className="text-brown bg-brown"
            isLoading={false}
            disabled={false}
            onClick={onInvert}
            size="md"
            variant="default"
          >
            <Refresh className="text-gold cursor-pointer h-4"></Refresh>
          </Button>
        </div>
        {isBuyResource ? renderResourceBar(true, false) : renderResourceBar(true, true)}
      </div>
      <div className="p-2 border">
        <div className="mb-2">
          <table className="w-full text-left text-xs">
            <tbody>
              <tr className="text-xl">
                <td>{chosenResourceName} Price:</td>
                <td>{marketPrice.toFixed(2)} $LORDS</td>
              </tr>
              {marketPrice > 0 && (
                <>
                  <tr>
                    <td>Slippage:</td>
                    <td>{marketManager.slippage(lordsAmount, resourceAmount).toFixed(2)} %</td>
                  </tr>
                  <tr>
                    <td>Bank Owner Fees:</td>
                    <td>
                      {((isBuyResource ? lordsAmount : resourceAmount) * OWNER_FEE).toFixed(2)}{" "}
                      {isBuyResource ? "$LORDS" : chosenResourceName}
                    </td>
                  </tr>
                  <tr>
                    <td>LP Fees:</td>
                    <td>
                      {((isBuyResource ? lordsAmount : resourceAmount) * LP_FEE).toFixed(2)}{" "}
                      {isBuyResource ? "$LORDS" : chosenResourceName}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="w-full flex flex-col justify-center mt-2">
          <Button className="text-brown" isLoading={isLoading} disabled={!canSwap} onClick={onSwap} variant="primary">
            Swap
          </Button>
          {!canSwap && <div className="ml-1 text-danger">Warning: not enough resources or amount is zero</div>}
        </div>
      </div>
    </div>
  );
};
