import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useTravel } from "@/hooks/helpers/useTravel";
import { ResourceBar } from "@/ui/components/bank/ResourceBar";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { divideByPrecision, getEntityIdFromKeys, multiplyByPrecision } from "@/ui/utils/utils";
import { EternumGlobalConfig, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TravelInfo } from "../resources/ResourceWeight";
import { ConfirmationPopup } from "./ConfirmationPopup";

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

  const { getBalance } = getResourceBalance();
  const { computeTravelTime } = useTravel();

  const [isBuyResource, setIsBuyResource] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<bigint>(1n);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [canCarry, setCanCarry] = useState(false);
  const [openConfirmation, setOpenConfirmation] = useState(false);

  const lordsFee = lordsAmount * OWNER_FEE;

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
    const amount = isBuyResource ? lordsAmount + lordsFee : resourceAmount;
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
    }).finally(() => {
      setIsLoading(false);
      setOpenConfirmation(false);
    });
  }, [isBuyResource, buy_resources, sell_resources, account, bankEntityId, resourceId, resourceAmount, lordsAmount]);

  const chosenResourceName = resources.find((r) => r.id === Number(resourceId))?.trait;

  const renderResourceBar = useCallback(
    (disableInput: boolean, isLords: boolean) => {
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
    [entityId, isBuyResource, lordsAmount, resourceAmount, resourceId, lordsFee],
  );
  const renderConfirmationPopup = useMemo(() => {
    const warningMessage = `Warning: not enough donkeys to transport ${isBuyResource ? chosenResourceName : "Lords"}`;
    const negativeAmount = isBuyResource ? lordsAmount + lordsFee : resourceAmount;
    const positiveAmount = isBuyResource ? resourceAmount : lordsAmount - lordsFee;
    const negativeResource = isBuyResource ? "Lords" : chosenResourceName || "";
    const positiveResource = isBuyResource ? chosenResourceName || "" : "Lords";
    const resourcesToTransport = isBuyResource
      ? [{ resourceId: Number(resourceId), amount: resourceAmount }]
      : [{ resourceId: ResourcesIds.Lords, amount: lordsAmount }];

    return (
      <ConfirmationPopup
        title="Confirm Swap"
        warning={warningMessage}
        disabled={!canCarry}
        isLoading={isLoading}
        onConfirm={onSwap}
        onCancel={() => setOpenConfirmation(false)}
      >
        <div>
          <div className="flex items-center justify-center space-x-2">
            <div className="flex justify-center items-center text-danger">
              -{negativeAmount}
              <ResourceIcon resource={negativeResource} size="md" />
            </div>
            <span>→</span>
            <div className="flex items-center text-green">
              +{positiveAmount}
              <ResourceIcon resource={positiveResource} size="md" />
            </div>
          </div>
          <div className="bg-gold/10 p-2 m-2 clip-angled-sm h-auto">
            <div className="flex flex-col p-2 items-center">
              <TravelInfo
                entityId={entityId}
                resources={resourcesToTransport}
                travelTime={computeTravelTime(bankEntityId, entityId, EternumGlobalConfig.speed.donkey, true)}
                setCanCarry={setCanCarry}
                isAmm={true}
              />
            </div>
          </div>
        </div>
      </ConfirmationPopup>
    );
  }, [
    isBuyResource,
    chosenResourceName,
    lordsAmount,
    lordsFee,
    resourceAmount,
    resourceId,
    canCarry,
    isLoading,
    onSwap,
    entityId,
    computeTravelTime,
    bankEntityId,
    setCanCarry,
  ]);

  return (
    <div>
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
                    <td className="text-left text-danger px-8">
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
                    <td className="text-left text-danger px-8">
                      {(-(lordsAmount * OWNER_FEE)).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {"Lords"}
                    </td>
                  </tr>
                  <tr>
                    <td>LP Fees</td>
                    <td className="text-left text-danger px-8">
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
              isLoading={false}
              disabled={!canSwap}
              onClick={() => setOpenConfirmation(true)}
              variant="primary"
            >
              Swap {isBuyResource ? "Lords" : chosenResourceName} for {isBuyResource ? chosenResourceName : "Lords"}
            </Button>
            {!canSwap && (
              <div className="px-3 mt-2 mb-1 text-danger font-bold text-center">
                Warning: not enough resources or amount is zero
              </div>
            )}
          </div>
        </div>
      </div>
      {openConfirmation && renderConfirmationPopup}
    </div>
  );
};
