import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import { divideByPrecision, getEntityIdFromKeys, multiplyByPrecision } from "@/ui/utils/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import { useComponentValue } from "@dojoengine/react";
import { ResourceBar } from "@/ui/components/bank/ResourceBar";
import { EternumGlobalConfig, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { TravelInfo } from "../resources/ResourceWeight";
import { useTravel } from "@/hooks/helpers/useTravel";

const OWNER_FEE = EternumGlobalConfig.banks.ownerFeesNumerator / EternumGlobalConfig.banks.ownerFeesDenominator;
const LP_FEE = EternumGlobalConfig.banks.lpFeesNumerator / EternumGlobalConfig.banks.lpFeesDenominator;

export const ResourceSwap = ({ bankEntityId, entityId }: { bankEntityId: bigint; entityId: bigint }) => {
  const {
    account: { account },
    setup: {
      components: { Market, Liquidity },
      systemCalls: { buy_resources, sell_resources },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();
  const { computeTravelTime } = useTravel();

  const [isBuyResource, setIsBuyResource] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<bigint>(1n);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [canCarry, setCanCarry] = useState(false);

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
      const cost = operation(multiplyByPrecision(amount) || 0, EternumGlobalConfig.banks.lpFeesNumerator);
      setAmount(divideByPrecision(cost));
    }
  }, [lordsAmount, resourceAmount, isBuyResource, marketManager]);

  const hasEnough = useMemo(() => {
    const amount = isBuyResource ? lordsAmount : resourceAmount;
    const balanceId = isBuyResource ? BigInt(ResourcesIds.Lords) : resourceId;
    return multiplyByPrecision(amount) <= getBalance(entityId, Number(balanceId)).balance;
  }, [isBuyResource, lordsAmount, resourceAmount, getBalance, entityId, resourceId]);

  const canSwap = useMemo(
    () => lordsAmount > 0 && resourceAmount > 0 && hasEnough,
    [lordsAmount, resourceAmount, hasEnough],
  );

  const onInvert = useCallback(() => setIsBuyResource((prev) => !prev), []);

  const onSwap = useCallback(() => {
    setIsLoading(true);
    const operation = isBuyResource ? buy_resources : sell_resources;
    operation({
      signer: account,
      bank_entity_id: bankEntityId,
      entity_id: entityId,
      resource_type: resourceId,
      amount: multiplyByPrecision(resourceAmount),
    }).finally(() => setIsLoading(false));
  }, [isBuyResource, buy_resources, sell_resources, account, bankEntityId, resourceId, resourceAmount, lordsAmount]);

  const chosenResourceName = resources.find((r) => r.id === Number(resourceId))?.trait;

  const renderResourceBar = useCallback(
    (disableInput: boolean, isLords: boolean) => {
      const lordsFee = lordsAmount * OWNER_FEE;
      const amount = isLords ? (isBuyResource ? lordsAmount : lordsAmount - lordsFee) : resourceAmount;
      return (
        <ResourceBar
          entityId={entityId}
          resources={
            isLords
              ? resources.filter((r) => r.id === ResourcesIds.Lords)
              : resources.filter((r) => r.id !== ResourcesIds.Lords)
          }
          lordsFee={lordsFee}
          amount={amount}
          setAmount={isLords ? setLordsAmount : setResourceAmount}
          resourceId={isLords ? BigInt(ResourcesIds.Lords) : resourceId}
          setResourceId={setResourceId}
          disableInput={disableInput}
        />
      );
    },
    [entityId, isBuyResource, lordsAmount, resourceAmount, resourceId],
  );

  return (
    <div className=" w-1/2 mx-auto bg-gold/10 px-3 py-1 clip-angled-sm">
      <div className="relative my-2 space-y-1">
        {isBuyResource ? renderResourceBar(false, true) : renderResourceBar(false, false)}
        <div className="absolute  left-1/2 top-[94px]">
          <Button isLoading={false} disabled={false} onClick={onInvert} size="md" className="">
            <Refresh
              className={`text-gold cursor-pointer h-4 duration-150 ${isBuyResource ? "rotate-180" : ""}`}
            ></Refresh>
          </Button>
        </div>
        {isBuyResource ? renderResourceBar(true, false) : renderResourceBar(true, true)}
      </div>
      <div className="p-2">
        <div className="mb-2 font-bold">
          <table className="w-full text-right text-xs text-gold/60">
            <tbody>
              <tr className="text-xl text-gold">
                <td>{marketManager.getMarketPrice().toFixed(2)}</td>
                <td className="text-left px-8 flex gap-4">
                  <>
                    {" "}
                    <ResourceIcon size="sm" resource={"Lords"} /> {"/"}
                    <ResourceIcon size="sm" resource={chosenResourceName || ""} />
                  </>
                </td>
              </tr>
              <>
                <tr>
                  <td>Slippage</td>
                  <td className="text-left text-order-giants px-8">
                    {(
                      marketManager.slippage(
                        (isBuyResource ? multiplyByPrecision(lordsAmount) : multiplyByPrecision(resourceAmount)) || 0,
                        isBuyResource,
                      ) || 0
                    ).toFixed(2)}{" "}
                    %
                  </td>
                </tr>
                <tr>
                  <td>Bank Owner Fees</td>
                  <td className="text-left text-order-giants px-8">
                    {(-(lordsAmount * OWNER_FEE)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {"Lords"}
                  </td>
                </tr>
                <tr>
                  <td>LP Fees</td>
                  <td className="text-left text-order-giants px-8">
                    {(-(isBuyResource ? lordsAmount : resourceAmount) * LP_FEE).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {isBuyResource ? "Lords" : chosenResourceName}
                  </td>
                </tr>
              </>
            </tbody>
          </table>
        </div>
        <div className="w-full flex flex-col justify-center mt-4">
          <Button
            className="text-brown"
            isLoading={isLoading}
            disabled={!canSwap || !canCarry}
            onClick={onSwap}
            variant="primary"
          >
            Swap {isBuyResource ? "Lords" : chosenResourceName} for {isBuyResource ? chosenResourceName : "Lords"}
          </Button>
          {!canSwap && (
            <div className="px-3 text-danger font-bold">Warning: not enough resources or amount is zero</div>
          )}
        </div>
      </div>
      <div className=" ">
        <div className="p-10 bg-gold/10 clip-angled-sm h-auto">
          <div className="flex flex-col w-full items-center">
            <TravelInfo
              entityId={entityId}
              resources={
                isBuyResource
                  ? [{ resourceId: Number(resourceId), amount: resourceAmount }]
                  : [{ resourceId: ResourcesIds.Lords, amount: lordsAmount }]
              }
              travelTime={computeTravelTime(bankEntityId, entityId, EternumGlobalConfig.speed.donkey)}
              isPickup={true}
              setCanCarry={setCanCarry}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
