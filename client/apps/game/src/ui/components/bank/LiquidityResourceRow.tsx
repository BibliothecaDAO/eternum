import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useTravel } from "@/hooks/helpers/useTravel";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { divideByPrecision, formatNumber, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ContractAddress, EntityType, ID, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import React, { useCallback, useMemo, useState } from "react";
import { TravelInfo } from "../resources/TravelInfo";
import { ConfirmationPopup } from "./ConfirmationPopup";

type LiquidityResourceRowProps = {
  playerStructureIds: ID[];
  bankEntityId: ID;
  entityId: ID;
  resourceId: ResourcesIds;
  isFirst?: boolean;
};

export const LiquidityResourceRow = ({
  playerStructureIds,
  bankEntityId,
  entityId,
  resourceId,
  isFirst,
}: LiquidityResourceRowProps) => {
  const dojoContext = useDojo();
  const [isLoading, setIsLoading] = useState(false);
  const [canCarry, setCanCarry] = useState(false);
  const [openConfirmation, setOpenConfirmation] = useState(false);
  const [showInputResourcesPrice, setShowInputResourcesPrice] = useState(false);
  const [withdrawalPercentage, setWithdrawalPercentage] = useState(100);

  const marketEntityId = useMemo(
    () => getEntityIdFromKeys([BigInt(bankEntityId), BigInt(resourceId)]),
    [bankEntityId, resourceId],
  );
  const liquidityEntityId = useMemo(
    () => getEntityIdFromKeys([BigInt(bankEntityId), BigInt(dojoContext.account.account.address), BigInt(resourceId)]),
    [bankEntityId, resourceId],
  );

  const market = useComponentValue(dojoContext.setup.components.Market, marketEntityId);
  const liquidity = useComponentValue(dojoContext.setup.components.Liquidity, liquidityEntityId);

  const marketManager = useMemo(
    () =>
      new MarketManager(
        dojoContext.setup,
        bankEntityId,
        ContractAddress(dojoContext.account.account.address),
        resourceId,
      ),
    [dojoContext, bankEntityId, resourceId, market, liquidity],
  );

  const resource = useMemo(() => resources.find((r) => r.id === resourceId), [resourceId]);

  const pair = useMemo(
    () => (
      <div className="flex flex-row items-center">
        <ResourceIcon resource={"Lords"} size="md" />
        {" / "}
        {resource?.trait && <ResourceIcon resource={resource.trait} size="md" />}
      </div>
    ),
    [resource],
  );

  const [totalLords, totalResource] = marketManager.getReserves();
  const [lordsAmount, resourceAmount] = marketManager.getMyLP();

  const myLiquidity = marketManager.getPlayerLiquidity();
  const canWithdraw = useMemo(
    () => (myLiquidity?.shares.mag || 0) > 0 && (totalLords > 0 || totalResource > 0),
    [myLiquidity, totalLords, totalResource],
  );

  const { computeTravelTime } = useTravel();

  const onWithdraw = useCallback(
    (percentage: number) => {
      setIsLoading(true);
      const { withdrawShares } = calculateWithdrawAmounts(percentage);

      dojoContext.setup.systemCalls
        .remove_liquidity({
          bank_entity_id: bankEntityId,
          entity_id: entityId,
          resource_type: BigInt(resourceId),
          shares: withdrawShares,
          signer: dojoContext.account.account,
        })
        .finally(() => {
          setIsLoading(false);
          setOpenConfirmation(false);
        });
    },
    [dojoContext, bankEntityId, entityId, resourceId, marketManager],
  );

  const calculateWithdrawAmounts = useCallback(
    (percentage: number) => {
      const sharesUnscaled = marketManager.getSharesUnscaled();
      const totalLiquidityUnscaled = marketManager.getTotalLiquidityUnscaled();
      const maxShares = sharesUnscaled > totalLiquidityUnscaled ? totalLiquidityUnscaled : sharesUnscaled;
      const withdrawShares = (maxShares * BigInt(percentage)) / BigInt(100);

      const lordsToReceive = (lordsAmount * percentage) / 100;
      const resourceToReceive = (resourceAmount * percentage) / 100;

      return {
        withdrawShares: withdrawShares,
        lords: lordsToReceive,
        resource: resourceToReceive,
      };
    },
    [marketManager, lordsAmount, resourceAmount],
  );

  const renderConfirmationPopup = useMemo(() => {
    const { lords, resource } = calculateWithdrawAmounts(withdrawalPercentage);

    const travelResources = [
      { amount: divideByPrecision(lords), resourceId: ResourcesIds.Lords },
      { amount: divideByPrecision(resource), resourceId: resourceId },
    ];

    return (
      <ConfirmationPopup
        title="Confirm Withdraw"
        warning="Warning: not enough donkeys to transport resources"
        disabled={!canCarry}
        isLoading={isLoading}
        onConfirm={() => onWithdraw(withdrawalPercentage)}
        onCancel={() => setOpenConfirmation(false)}
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-full flex items-center justify-between">
              <span>Withdrawal Amount:</span>
              <span className="font-bold">{withdrawalPercentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={withdrawalPercentage}
              onChange={(e) => setWithdrawalPercentage(Number(e.target.value))}
              className="w-full appearance-none bg-gold/20 h-2 rounded-lg focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-gold [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-center space-x-2">
              {travelResources.map((cost, index) => (
                <div key={index} className="flex items-center">
                  <ResourceCost withTooltip amount={cost.amount} resourceId={cost.resourceId} />
                </div>
              ))}
            </div>
            <div className="bg-gold/10 p-2 mt-2 rounded-lg h-auto">
              <div className="flex flex-col items-center">
                <TravelInfo
                  entityId={entityId}
                  resources={travelResources}
                  travelTime={computeTravelTime(
                    bankEntityId,
                    entityId,
                    configManager.getSpeedConfig(EntityType.DONKEY),
                    true,
                  )}
                  setCanCarry={setCanCarry}
                />
              </div>
            </div>
          </div>
        </div>
      </ConfirmationPopup>
    );
  }, [
    withdrawalPercentage,
    lordsAmount,
    resourceAmount,
    canCarry,
    isLoading,
    onWithdraw,
    resourceId,
    bankEntityId,
    entityId,
    computeTravelTime,
    setCanCarry,
    calculateWithdrawAmounts,
  ]);

  return (
    <>
      <div className="grid grid-cols-7 gap-4 text-lg hover:bg-gold/20 my-1 border border-gold/10 px-2">
        {pair}

        <div
          className="flex items-center relative"
          onMouseEnter={() => setShowInputResourcesPrice(true)}
          onMouseLeave={() => setShowInputResourcesPrice(false)}
        >
          {formatNumber(marketManager.getMarketPrice(), 4)} <ResourceIcon resource="Lords" size="sm" />
          {showInputResourcesPrice && (
            <div className={`${isFirst ? "top-10" : "bottom-10"} absolute left-0 z-[100] pointer-events-none`}>
              <InputResourcesPrice marketManager={marketManager} />
            </div>
          )}
        </div>
        <TotalLiquidity totalLords={totalLords} totalResource={totalResource} resourceId={resourceId} />
        <MyLiquidity
          playerStructureIds={playerStructureIds}
          lordsAmount={lordsAmount}
          resourceAmount={resourceAmount}
          totalLords={totalLords}
          totalResource={totalResource}
          marketManager={marketManager}
        />

        <div>
          <div className="flex items-center h-full">
            <Button
              variant="outline"
              onClick={() => setOpenConfirmation(true)}
              isLoading={false}
              disabled={!canWithdraw}
            >
              Withdraw
            </Button>
          </div>
        </div>
      </div>
      {openConfirmation && renderConfirmationPopup}
    </>
  );
};

const TotalLiquidity = ({
  totalLords,
  totalResource,
  resourceId,
}: {
  totalLords: number;
  totalResource: number;
  resourceId: ResourcesIds;
}) => {
  return (
    <div className="flex flex-col col-span-2 justify-center">
      <div className="flex">
        <div>{divideByPrecision(totalLords).toLocaleString()}</div>
        <ResourceIcon resource="Lords" size="sm" />
      </div>

      <div className="flex">
        <div>{divideByPrecision(totalResource).toLocaleString()}</div>
        <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" />
      </div>
    </div>
  );
};

const MyLiquidity = ({
  playerStructureIds,
  lordsAmount,
  resourceAmount,
  totalLords,
  totalResource,
  marketManager,
}: {
  playerStructureIds: ID[];
  lordsAmount: number;
  resourceAmount: number;
  totalLords: number;
  totalResource: number;
  marketManager: MarketManager;
}) => {
  const resourceId = marketManager.resourceId;

  const playerLiquidityInfo = useMemo(() => {
    return marketManager.getLatestLiquidityEvent(playerStructureIds);
  }, [playerStructureIds, marketManager]);

  const [lordsDifferencePercentage, resourceDifferencePercentage] = useMemo(() => {
    if (!playerLiquidityInfo) return [0, 0];
    return [
      ((lordsAmount - Number(playerLiquidityInfo.lords_amount)) / Number(playerLiquidityInfo.lords_amount)) * 100,
      ((resourceAmount - Number(playerLiquidityInfo.resource_amount)) / Number(playerLiquidityInfo.resource_amount)) *
        100,
    ];
  }, [playerLiquidityInfo, lordsAmount, resourceAmount]);

  const totalValueDifferenceInLords = useMemo(() => {
    if (!playerLiquidityInfo) return 0;
    const currentResourcePrice = marketManager.getMarketPrice();
    const previousResourcePrice = divideByPrecision(Number(playerLiquidityInfo.resource_price));

    const currentTotalValue = lordsAmount + currentResourcePrice * resourceAmount;
    const previousTotalValue =
      Number(playerLiquidityInfo.lords_amount) + previousResourcePrice * Number(playerLiquidityInfo.resource_amount);

    return divideByPrecision(currentTotalValue - previousTotalValue);
  }, [playerLiquidityInfo, totalLords, totalResource, marketManager]);

  return (
    <div className="flex flex-col col-span-2">
      <div className="flex">
        <div>{divideByPrecision(lordsAmount).toLocaleString()}</div>
        <ResourceIcon resource="Lords" size="sm" />
        {lordsAmount > 0 && (
          <span className={`ml-1 text-xs ${lordsDifferencePercentage >= 0 ? "text-green" : "text-red"}`}>
            ({lordsDifferencePercentage > 0 ? "+" : ""}
            {formatNumber(lordsDifferencePercentage, 4)}%)
          </span>
        )}
      </div>

      <div className="flex">
        <div>{divideByPrecision(resourceAmount).toLocaleString()}</div>
        <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" />
        {resourceAmount > 0 && (
          <span className={`ml-1 text-xs ${resourceDifferencePercentage >= 0 ? "text-green" : "text-red"}`}>
            ({resourceDifferencePercentage > 0 ? "+" : ""}
            {formatNumber(resourceDifferencePercentage, 4)}%)
          </span>
        )}
      </div>

      {totalValueDifferenceInLords !== 0 && (
        <div className="flex mt-1">
          <span className={`text-xs ${totalValueDifferenceInLords >= 0 ? "text-green" : "text-red"}`}>
            {totalValueDifferenceInLords >= 0 ? "+" : "-"}
            {formatNumber(Math.abs(totalValueDifferenceInLords), 4)} Lords (uPNL)
          </span>
        </div>
      )}
    </div>
  );
};

const InputResourcesPrice = ({ marketManager }: { marketManager: MarketManager }) => {
  const { setup } = useDojo();
  const inputResources = configManager.resourceInputs[marketManager.resourceId];
  const outputAmount = configManager.resourceOutput[marketManager.resourceId].amount;

  if (!inputResources?.length) return null;
  const totalPrice =
    inputResources.reduce((sum, resource) => {
      const price = new MarketManager(
        setup,
        marketManager.bankEntityId,
        marketManager.player,
        resource.resource,
      ).getMarketPrice();
      return sum + Number(price) * resource.amount;
    }, 0) / outputAmount;
  return (
    <div className="p-2 w-full flex flex-col items-center justify-center bg-brown/70 rounded-lg shadow-xl">
      <div className="flex items-center justify-center">
        {inputResources.map(({ resource }, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="mx-1">+</span>}
            <ResourceIcon key={resource} resource={ResourcesIds[resource]} size="sm" />
          </React.Fragment>
        ))}
      </div>
      <div className="flex flex-row text-xxs text-gold w-full items-center justify-between mt-1">
        <span className="mr-1 whitespace-nowrap">production cost:</span>
        <div className="flex items-center space-x-1">
          <span className="font-semibold ">{formatNumber(totalPrice, 4)}</span>
          <ResourceIcon resource="Lords" size="xs" />
        </div>
      </div>
    </div>
  );
};
