import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { useIsResourcesLocked, useStructures } from "@/hooks/helpers/useStructures";
import { useTravel } from "@/hooks/helpers/useTravel";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import { ResourceBar } from "@/ui/components/bank/ResourceBar";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { divideByPrecision, formatNumber, multiplyByPrecision } from "@/ui/utils/utils";
import {
  ContractAddress,
  DONKEY_ENTITY_TYPE,
  ID,
  RESOURCE_TIERS,
  Resources,
  ResourcesIds,
  resources,
} from "@bibliothecadao/eternum";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TravelInfo } from "../resources/TravelInfo";
import { ConfirmationPopup } from "./ConfirmationPopup";

export const ResourceSwap = ({
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

  const { getBalance } = useResourceBalance();
  const { computeTravelTime } = useTravel();
  const { play: playLordsSound } = useUiSounds(soundSelector.addLords);

  const [isBuyResource, setIsBuyResource] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<ResourcesIds>(ResourcesIds.Wood);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [canCarry, setCanCarry] = useState(false);
  const [openConfirmation, setOpenConfirmation] = useState(false);
  const { getStructureByEntityId } = useStructures();

  const bankProtector = useMemo(() => {
    const structure = getStructureByEntityId(bankEntityId);
    return structure?.protector;
  }, [bankEntityId]);

  const ownerFee = lordsAmount * configManager.getAdminBankOwnerFee();
  const lpFee = (isBuyResource ? lordsAmount : resourceAmount) * configManager.getAdminBankLpFee();

  const marketManager = useMemo(
    () => new MarketManager(setup, bankEntityId, ContractAddress(account.address), resourceId),
    [setup, bankEntityId, resourceId, account.address],
  );

  useEffect(() => {
    setResourceId(listResourceId);
  }, [listResourceId]);

  // recompute resource amount when resource id changes
  useEffect(() => {
    if (isBuyResource) {
      handleResourceAmountChange(resourceAmount);
    } else {
      handleLordsAmountChange(lordsAmount);
    }
  }, [marketManager.resourceId]);

  const lordsBalance = useMemo(() => getBalance(entityId, ResourcesIds.Lords).balance, [entityId, getBalance]);
  const resourceBalance = useMemo(() => getBalance(entityId, resourceId).balance, [entityId, resourceId, getBalance]);

  const hasEnough = useMemo(() => {
    const amount = isBuyResource ? lordsAmount + ownerFee : resourceAmount;
    const balance = isBuyResource ? lordsBalance : resourceBalance;
    return multiplyByPrecision(amount) <= balance;
  }, [isBuyResource, lordsAmount, resourceAmount, resourceBalance, lordsBalance, ownerFee]);

  const isBankResourcesLocked = useIsResourcesLocked(bankEntityId);
  const isMyResourcesLocked = useIsResourcesLocked(entityId);
  const amountsBiggerThanZero = lordsAmount > 0 && resourceAmount > 0;

  const canSwap = useMemo(
    () => amountsBiggerThanZero && hasEnough && !isBankResourcesLocked && !isMyResourcesLocked,
    [lordsAmount, resourceAmount, hasEnough, isBankResourcesLocked, isMyResourcesLocked],
  );

  const onInvert = useCallback(() => setIsBuyResource((prev) => !prev), []);

  const onSwap = useCallback(() => {
    setIsLoading(true);
    const operation = isBuyResource ? setup.systemCalls.buy_resources : setup.systemCalls.sell_resources;

    const performSwap = () => {
      return operation({
        signer: account,
        bank_entity_id: bankEntityId,
        entity_id: entityId,
        resource_type: resourceId,
        amount: multiplyByPrecision(Number(resourceAmount.toFixed(2))),
      });
    };

    if (bankProtector?.battle_id) {
      // If there's a bank protector in battle, resolve battle first then perform swap
      setup.systemCalls
        .battle_resolve({
          signer: account,
          battle_id: bankProtector.battle_id,
          army_id: bankProtector.entity_id,
        })
        .then(performSwap)
        .finally(() => {
          playLordsSound();
          setIsLoading(false);
          setOpenConfirmation(false);
        });
    } else {
      // If no bank protector, just perform swap
      performSwap().finally(() => {
        playLordsSound();
        setIsLoading(false);
        setOpenConfirmation(false);
      });
    }
  }, [isBuyResource, setup, account, entityId, bankEntityId, resourceId, resourceAmount, bankProtector]);

  const chosenResourceName = resources.find((r) => r.id === Number(resourceId))?.trait;

  // Dedicated handler for Lords Amount
  const handleLordsAmountChange = (amount: number) => {
    setLordsAmount(amount);
    if (isBuyResource) {
      const calculatedResourceAmount = divideByPrecision(
        marketManager.calculateResourceOutputForLordsInput(
          multiplyByPrecision(amount) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
      );
      setResourceAmount(calculatedResourceAmount);
    } else {
      const calculatedResourceAmount = divideByPrecision(
        marketManager.calculateResourceInputForLordsOutput(
          multiplyByPrecision(amount / (1 - configManager.getAdminBankOwnerFee())) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
      );
      setResourceAmount(calculatedResourceAmount);
    }
  };

  // Dedicated handler for Resource Amount
  const handleResourceAmountChange = (amount: number) => {
    setResourceAmount(amount);
    if (isBuyResource) {
      const calculatedLordsAmount = divideByPrecision(
        marketManager.calculateLordsInputForResourceOutput(
          multiplyByPrecision(amount) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
      );
      setLordsAmount(calculatedLordsAmount);
    } else {
      const calculatedLordsAmount = divideByPrecision(
        marketManager.calculateLordsOutputForResourceInput(
          multiplyByPrecision(amount) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
      );
      const lordsAmountAfterFee = calculatedLordsAmount * (1 - configManager.getAdminBankOwnerFee());
      setLordsAmount(lordsAmountAfterFee);
    }
  };

  const orderedResources = useMemo(() => {
    return Object.values(RESOURCE_TIERS)
      .flat()
      .map((id) => resources.find((r) => r.id === id))
      .filter((r): r is Resources => !!r)
      .filter((r) => !Number.isNaN(r.id));
  }, []);

  const renderResourceBar = useCallback(
    (disableInput: boolean, isLords: boolean) => {
      const amount = isLords ? lordsAmount : resourceAmount;
      const selectableResources = orderedResources.filter((r) =>
        isLords ? r.id === ResourcesIds.Lords : r.id !== ResourcesIds.Lords,
      );

      return (
        <ResourceBar
          entityId={entityId}
          resources={selectableResources}
          lordsFee={ownerFee}
          amount={amount}
          setAmount={isLords ? handleLordsAmountChange : handleResourceAmountChange}
          resourceId={isLords ? ResourcesIds.Lords : resourceId}
          setResourceId={setResourceId}
          disableInput={disableInput}
          max={isLords ? divideByPrecision(lordsBalance) : Infinity}
        />
      );
    },
    [
      entityId,
      isBuyResource,
      lordsAmount,
      resourceAmount,
      resourceId,
      ownerFee,
      resources,
      handleLordsAmountChange,
      handleResourceAmountChange,
    ],
  );

  const renderConfirmationPopup = useMemo(() => {
    const warningMessage = `Warning: not enough donkeys to transport ${isBuyResource ? chosenResourceName : "Lords"}`;
    const negativeAmount = isBuyResource ? lordsAmount + ownerFee : resourceAmount;
    const positiveAmount = isBuyResource ? resourceAmount : lordsAmount;
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
        <div className="amm-swap-fee-selector">
          <div className=" flex items-center justify-center space-x-2">
            <div className="flex justify-center items-center text-danger">
              -{negativeAmount.toLocaleString()}
              <ResourceIcon resource={negativeResource} size="md" />
            </div>
            <span>→</span>
            <div className="flex items-center text-green">
              +{positiveAmount.toLocaleString()}
              <ResourceIcon resource={positiveResource} size="md" />
            </div>
          </div>
          <div className="amm-swap-donkey-selector bg-gold/10 p-2 rounded-lg h-auto">
            <div className="flex flex-col p-2 items-center">
              <TravelInfo
                entityId={entityId}
                resources={resourcesToTransport}
                travelTime={computeTravelTime(
                  bankEntityId,
                  entityId,
                  configManager.getSpeedConfig(DONKEY_ENTITY_TYPE),
                  true,
                )}
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
    ownerFee,
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
      <div className="amm-swap-selector mx-auto bg-gold/10 px-3 py-1">
        <div className="relative my-2 space-y-1">
          {isBuyResource ? renderResourceBar(false, true) : renderResourceBar(false, false)}
          <div className="absolute left-1/2 top-[94px]">
            <Button isLoading={false} disabled={false} onClick={onInvert} size="md" className="">
              <Refresh
                className={`text-gold cursor-pointer h-4 duration-150 ${isBuyResource ? "rotate-180" : ""}`}
              ></Refresh>
            </Button>
          </div>
          {isBuyResource ? renderResourceBar(true, false) : renderResourceBar(true, true)}
        </div>
        <div className="p-2 w-full mx-auto">
          <div className="w-full flex flex-col justify-center ">
            <table className="text-xs text-gold/60 mx-auto">
              <tbody>
                <tr className="text-gold">
                  <td>Price</td>
                  <td className="text-left px-8 flex gap-4">
                    <>{`1 ${chosenResourceName} = ${formatNumber(marketManager.getMarketPrice(), 4)} LORDS`}</>
                  </td>
                </tr>
                <>
                  <tr>
                    <td>Slippage</td>
                    <td className="text-left text-danger px-8">
                      -
                      {formatNumber(
                        marketManager.slippage(
                          isBuyResource
                            ? multiplyByPrecision(Math.abs(lordsAmount - lpFee))
                            : multiplyByPrecision(Math.abs(resourceAmount - lpFee)),
                          isBuyResource,
                        ) || 0,
                        4,
                      )}{" "}
                      %
                    </td>
                  </tr>
                  <tr>
                    <td>Bank Owner Fees</td>
                    <td className="text-left text-danger px-8">
                      {formatNumber(-ownerFee, 4)} {"Lords"}
                    </td>
                  </tr>
                  <tr>
                    <td>LP Fees</td>
                    <td className="text-left text-danger px-8">
                      {formatNumber(-lpFee, 4)} {isBuyResource ? "Lords" : chosenResourceName}
                    </td>
                  </tr>
                </>
              </tbody>
            </table>
          </div>
          <div className="w-full flex flex-col justify-center mt-4">
            <Button
              className="swap-button-selector text-brown"
              isLoading={false}
              disabled={!canSwap}
              onClick={() => setOpenConfirmation(true)}
              variant="primary"
            >
              Swap {isBuyResource ? "Lords" : chosenResourceName} for {isBuyResource ? chosenResourceName : "Lords"}
            </Button>
            {!canSwap && (
              <div className="px-3 mt-2 mb-1 text-danger font-bold text-center">
                {!amountsBiggerThanZero && <div>Warning: Amount must be greater than zero</div>}
                {!hasEnough && <div>Warning: Not enough resources for this swap</div>}
                {isBankResourcesLocked && <div>Warning: Bank resources are currently locked</div>}
                {isMyResourcesLocked && <div>Warning: Your resources are currently locked</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      {openConfirmation && renderConfirmationPopup}
    </div>
  );
};
