import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import {
  HudButton,
  HudNotice,
  HudRow,
  HudSlider,
  HudTableRow,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { PopoverPanel } from "@/ui/design-system/molecules/popover";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { LIQUIDITY_COLS } from "./liquidity-table";
import { TravelInfo } from "@/ui/features/economy/resources";
import { knownAmount } from "@/ui/utils/utils";
import {
  MarketManager,
  configManager,
  divideByPrecision,
  getClosestBank,
  isMilitaryResource,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import {
  ContractAddress,
  ID,
  ResourcesIds,
  StructureType,
  resources,
  formatAmount,
  formatCharge,
  formatPercent,
  LORDS,
  resourceName,
  formatFigure,
} from "@bibliothecadao/types";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import React, { useCallback, useMemo, useState } from "react";
import { storyPayloadId } from "@/utils/native-id";
import { toast } from "@/ui/features/event-feed/notify";

type LiquidityResourceRowProps = {
  playerStructureIds: ID[];
  entityId: ID;
  resourceId: ResourcesIds;
};

export const LiquidityResourceRow = ({ playerStructureIds, entityId, resourceId }: LiquidityResourceRowProps) => {
  const gameContext = useGame();
  const [isLoading, setIsLoading] = useState(false);
  const [canCarry, setCanCarry] = useState(false);
  const [openConfirmation, setOpenConfirmation] = useState(false);
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const [withdrawalPercentage, setWithdrawalPercentage] = useState(100);

  const facts = useNativeFacts(["Market", "Liquidity"]);
  const playerAddress = gameContext.account.account.address;
  const marketManager = useMemo(
    () => new MarketManager(facts.store, ContractAddress(playerAddress), resourceId),
    [facts, playerAddress, resourceId],
  );

  const resource = useMemo(() => resources.find((r) => r.id === resourceId), [resourceId]);

  const pair = useMemo(
    () => (
      <span className="flex items-center">
        <ResourceIcon resource={ResourcesIds.Lords} size="md" />
        {" / "}
        {resource && <ResourceIcon resource={resourceId} size="md" />}
      </span>
    ),
    [resource, resourceId],
  );

  const [totalLords, totalResource] = marketManager.getReserves();
  const [lordsAmount, resourceAmount] = marketManager.getMyLP();

  const myLiquidity = marketManager.getPlayerLiquidity();
  const canWithdraw = useMemo(
    () => (myLiquidity?.shares || 0) > 0 && (totalLords > 0 || totalResource > 0),
    [myLiquidity, totalLords, totalResource],
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

  const onWithdraw = useCallback(
    (percentage: number) => {
      const { withdrawShares } = calculateWithdrawAmounts(percentage);
      const closestBank = getClosestBank(entityId, gameContext.setup.store);
      if (!closestBank) return;
      setIsLoading(true);

      const calldata = {
        bank_entity_id: closestBank.bankId,
        entity_id: entityId,
        resource_type: BigInt(resourceId),
        shares: withdrawShares,
        signer: gameContext.account.account,
      };

      return gameContext.setup.systemCalls
        .remove_liquidity(calldata)
        .catch((error) => toast.failed(error, "The liquidity could not be withdrawn."))
        .finally(() => {
          setIsLoading(false);
          setOpenConfirmation(false);
        });
    },
    [gameContext, entityId, resourceId, calculateWithdrawAmounts],
  );

  const renderWithdrawForm = () => {
    const { lords, resource } = calculateWithdrawAmounts(withdrawalPercentage);

    const isVillageAndMilitaryResource =
      gameContext.setup.store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.base
        .category === StructureType.Village && isMilitaryResource(resourceId);

    const travelResources = [
      { amount: divideByPrecision(lords), resourceId: ResourcesIds.Lords },
      { amount: divideByPrecision(resource), resourceId: resourceId },
    ];

    const closestBank = getClosestBank(entityId, gameContext.setup.store);

    if (!closestBank) return null;

    return (
      <PopoverPanel id="confirm" ariaLabel="Withdraw" anchor="top-center" onDismiss={() => setOpenConfirmation(false)}>
        <HudWindow
          title="Withdraw"
          icon={resourceMeaning(resourceId)}
          size="task"
          onClose={() => setOpenConfirmation(false)}
        >
          <HudWindowFoot>
            <HudButton kind="quiet" onClick={() => setOpenConfirmation(false)}>
              Cancel
            </HudButton>
            <HudButton
              kind="primary"
              busy={isLoading ? "Withdrawing…" : undefined}
              disabled={!canCarry || isVillageAndMilitaryResource}
              onClick={() => onWithdraw(withdrawalPercentage)}
            >
              Withdraw
            </HudButton>
          </HudWindowFoot>
          <div className="flex flex-col gap-3">
            {isVillageAndMilitaryResource && <HudNotice tone="bad" line="Villages cannot trade military resources." />}
            <HudRow title="Withdrawal Amount" trail={`${withdrawalPercentage}%`} />
            <HudSlider
              label="Withdrawal amount, in percent"
              value={withdrawalPercentage}
              max={100}
              onChange={setWithdrawalPercentage}
            />
            <span className="flex items-center justify-center gap-2">
              {travelResources.map((cost, index) => (
                <ResourceCost key={index} withTooltip amount={cost.amount} resourceId={cost.resourceId} />
              ))}
            </span>
            <TravelInfo
              entityId={entityId}
              resources={travelResources}
              bankId={closestBank.bankId}
              setCanCarry={setCanCarry}
            />
            {!canCarry && <HudNotice tone="bad" line="Warning: not enough donkeys to transport resources" />}
          </div>
        </HudWindow>
      </PopoverPanel>
    );
  };

  return (
    <HudTableRow cols={LIQUIDITY_COLS} label={`${LORDS} / ${resourceName(resourceId)} pool`}>
      {pair}
      <span
        className="flex items-center"
        onMouseEnter={() =>
          setTooltip({ content: <InputResourcesPrice marketManager={marketManager} />, position: "top" })
        }
        onMouseLeave={() => setTooltip(null)}
      >
        {formatFigure(marketManager.getMarketPrice())} <ResourceIcon resource={ResourcesIds.Lords} size="sm" />
      </span>
      <TotalLiquidity totalLords={totalLords} totalResource={totalResource} resourceId={resourceId} />
      <MyLiquidity
        playerStructureIds={playerStructureIds}
        lordsAmount={lordsAmount}
        resourceAmount={resourceAmount}
        marketManager={marketManager}
      />
      <HudButton kind="secondary" size="sm" onClick={() => setOpenConfirmation(true)} disabled={!canWithdraw}>
        Withdraw
      </HudButton>
      {openConfirmation && renderWithdrawForm()}
    </HudTableRow>
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
    <div className="flex flex-col justify-center tabular-nums">
      <div className="flex">
        <div>{formatAmount(knownAmount(totalLords))}</div>
        <ResourceIcon resource={ResourcesIds.Lords} size="sm" />
      </div>

      <div className="flex">
        <div>{formatAmount(knownAmount(totalResource))}</div>
        <ResourceIcon resource={resourceId} size="sm" />
      </div>
    </div>
  );
};

const MyLiquidity = ({
  playerStructureIds,
  lordsAmount,
  resourceAmount,
  marketManager,
}: {
  playerStructureIds: ID[];
  lordsAmount: number;
  resourceAmount: number;
  marketManager: MarketManager;
}) => {
  const resourceId = marketManager.resourceId;

  const { data: history } = useStoryEvents(100, "BankLiquidity", `0x${marketManager.player.toString(16)}`);
  const playerLiquidityInfo = history.find(
    (event) =>
      event.storyPayload.add === true &&
      Number(event.storyPayload.resource_type) === resourceId &&
      playerStructureIds.includes(storyPayloadId(event.storyPayload.structure_id)),
  )?.storyPayload;

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
  }, [playerLiquidityInfo, lordsAmount, resourceAmount, marketManager]);

  return (
    <div className="flex flex-col tabular-nums">
      <div className="flex">
        <div>{formatAmount(knownAmount(lordsAmount))}</div>
        <ResourceIcon resource={ResourcesIds.Lords} size="sm" />
        {playerLiquidityInfo && lordsAmount > 0 && (
          <span className={`ml-1 text-hud-label ${lordsDifferencePercentage >= 0 ? "text-hud-good" : "text-hud-bad"}`}>
            ({formatPercent(lordsDifferencePercentage / 100, { signed: true })})
          </span>
        )}
      </div>

      <div className="flex">
        <div>{formatAmount(knownAmount(resourceAmount))}</div>
        <ResourceIcon resource={resourceId} size="sm" />
        {playerLiquidityInfo && resourceAmount > 0 && (
          <span
            className={`ml-1 text-hud-label ${resourceDifferencePercentage >= 0 ? "text-hud-good" : "text-hud-bad"}`}
          >
            ({formatPercent(resourceDifferencePercentage / 100, { signed: true })})
          </span>
        )}
      </div>

      {totalValueDifferenceInLords !== 0 && (
        <div className="flex mt-1">
          <span className={`text-hud-label ${totalValueDifferenceInLords >= 0 ? "text-hud-good" : "text-hud-bad"}`}>
            {totalValueDifferenceInLords >= 0 ? "+" : "-"}
            {formatCharge(Math.abs(totalValueDifferenceInLords))} Lords (uPNL)
          </span>
        </div>
      )}
    </div>
  );
};

const InputResourcesPrice = ({ marketManager }: { marketManager: MarketManager }) => {
  const { setup } = useGame();
  useNativeRevision(["Market"]);
  // Markets list resources this game may not produce; only a producible one has an input price.
  if (!configManager.producibleResources().includes(marketManager.resourceId)) return null;
  const inputResources = configManager.getRecipeInputs(marketManager.resourceId, false)!;
  const outputAmount = configManager.getRecipeOutput(marketManager.resourceId, false)!;

  if (!inputResources.length) return null;
  const totalPrice =
    inputResources.reduce((sum, resource) => {
      const price = new MarketManager(setup.store, marketManager.player, resource.resource).getMarketPrice();
      return sum + Number(price) * resource.amount;
    }, 0) / outputAmount;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center">
        {inputResources.map(({ resource }, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="mx-1">+</span>}
            <ResourceIcon key={resource} resource={resource} size="sm" />
          </React.Fragment>
        ))}
      </div>
      <div className="flex w-full items-center justify-between gap-1 text-hud-label">
        <span className="whitespace-nowrap">production cost:</span>
        <div className="flex items-center gap-1">
          <span className="text-hud-strong">{formatCharge(totalPrice)}</span>
          <ResourceIcon resource={ResourcesIds.Lords} size="xs" />
        </div>
      </div>
    </div>
  );
};
