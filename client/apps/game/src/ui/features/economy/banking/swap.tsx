import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUISound } from "@/audio";
import { Button } from "@/ui/design-system/atoms";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { ConfirmationPopup } from "@/ui/features/economy/banking";
import { ResourceBar } from "@/ui/features/economy/banking/resource-bar";
import { TravelInfo } from "@/ui/features/economy/resources";
import { formatNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { setup } from "@bibliothecadao/dojo";
import {
  computeTravelTime,
  configManager,
  divideByPrecision,
  getBalance,
  getClosestBank,
  getEntityIdFromKeys,
  isMilitaryResource,
  MarketManager,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  ContractAddress,
  ID,
  Resources,
  resources,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";

export const ResourceSwap = ({ entityId, listResourceId }: { entityId: ID; listResourceId: number }) => {
  const mode = useGameModeConfig();
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const playLordsSound = useUISound("resources.lords.add");

  const [isBuyResource, setIsBuyResource] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<ResourcesIds>(ResourcesIds.Wood);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [canCarry, setCanCarry] = useState(false);
  const [openConfirmation, setOpenConfirmation] = useState(false);

  const ownerFee = lordsAmount * configManager.getAdminBankOwnerFee();
  const lpFee = (isBuyResource ? lordsAmount : resourceAmount) * configManager.getAdminBankLpFee();

  const marketManager = useMemo(
    () => new MarketManager(components, ContractAddress(account.address), resourceId),
    [components, resourceId, account.address],
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

  const lordsBalance = useMemo(
    () => getBalance(entityId, ResourcesIds.Lords, currentDefaultTick, components).balance,
    [entityId, currentDefaultTick, getBalance],
  );
  const resourceBalance = useMemo(
    () => getBalance(entityId, resourceId, currentDefaultTick, components).balance,
    [entityId, resourceId, currentDefaultTick, getBalance],
  );

  const hasEnough = useMemo(() => {
    const amount = isBuyResource ? lordsAmount + ownerFee : resourceAmount;
    const balance = isBuyResource ? lordsBalance : resourceBalance;
    return multiplyByPrecision(amount) <= balance;
  }, [isBuyResource, lordsAmount, resourceAmount, resourceBalance, lordsBalance, ownerFee]);

  const amountsBiggerThanZero = lordsAmount > 0 && resourceAmount > 0;

  const canSwap = useMemo(() => amountsBiggerThanZero && hasEnough, [lordsAmount, resourceAmount, hasEnough]);

  const onInvert = useCallback(() => setIsBuyResource((prev) => !prev), []);

  const onSwap = useCallback(() => {
    setIsLoading(true);
    const operation = isBuyResource ? systemCalls.buy_resources : systemCalls.sell_resources;

    const closestBank = getClosestBank(entityId, components);

    if (!closestBank) return;

    const performSwap = () => {
      return operation({
        signer: account,
        bank_entity_id: closestBank.bankId,
        entity_id: entityId,
        resource_type: resourceId,
        amount: multiplyByPrecision(Number(resourceAmount.toFixed(2))),
      });
    };

    // If no bank protector, just perform swap
    performSwap().finally(() => {
      playLordsSound();
      setIsLoading(false);
      setOpenConfirmation(false);
    });
  }, [isBuyResource, setup, account, entityId, resourceId, resourceAmount]);

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
    return Object.values(mode.resources.getTiers())
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

  const renderConfirmationPopup = useCallback(() => {
    const warningMessage = `Warning: not enough donkeys to transport ${isBuyResource ? chosenResourceName : "Lords"}`;
    const negativeAmount = isBuyResource ? lordsAmount + ownerFee : resourceAmount;
    const positiveAmount = isBuyResource ? resourceAmount : lordsAmount;
    const negativeResource = isBuyResource ? "Lords" : chosenResourceName || "";
    const positiveResource = isBuyResource ? chosenResourceName || "" : "Lords";
    const resourcesToTransport = isBuyResource
      ? [{ resourceId: Number(resourceId), amount: resourceAmount }]
      : [{ resourceId: ResourcesIds.Lords, amount: lordsAmount }];

    const closestBank = getClosestBank(entityId, components);

    if (!closestBank) return;

    const isVillageAndMilitaryResource =
      getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]))?.category ===
        StructureType.Village && isMilitaryResource(resourceId);

    return (
      <ConfirmationPopup
        title="Confirm Swap"
        warning={warningMessage}
        disabled={!canCarry || isVillageAndMilitaryResource}
        isLoading={isLoading}
        onConfirm={onSwap}
        onCancel={() => setOpenConfirmation(false)}
      >
        {isVillageAndMilitaryResource && (
          <div className="mb-4 bg-red/20 text-red rounded-md">
            Military resources cannot be traded from village structures.
          </div>
        )}
        <div className="amm-swap-fee-selector">
          <div className=" flex items-center justify-center space-x-2 text-2xl">
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
          <div className="amm-swap-donkey-selector rounded-lg h-auto">
            <TravelInfo
              entityId={entityId}
              resources={resourcesToTransport}
              travelTime={closestBank.travelTime}
              setCanCarry={setCanCarry}
              isAmm={true}
            />
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
    setCanCarry,
  ]);

  return (
    <div>
      <div className="amm-swap-selector mx-auto  px-3 py-1">
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
                    <td>
                      Bank Owner Fees{" "}
                      <span className="text-green">({configManager.getAdminBankOwnerFee() * 100}%)</span>
                    </td>
                    <td className="text-left text-danger px-8">
                      {formatNumber(-ownerFee, 4)} {"Lords"}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      LP Fees <span className="text-green">({configManager.getAdminBankLpFee() * 100}%)</span>
                    </td>
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
              </div>
            )}
          </div>
        </div>
      </div>
      {openConfirmation && renderConfirmationPopup()}
    </div>
  );
};
