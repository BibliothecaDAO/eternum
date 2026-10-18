import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUISound } from "@/audio";
import { useConfirmsLoss } from "@/hooks/helpers/use-confirm-for";
import { HudButton, HudConfirm, HudIconButton, HudNotice, HudRow } from "@/ui/design-system/kit/hud-elements";
import { PopoverPanel } from "@/ui/design-system/molecules/popover";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourceBar } from "@/ui/features/economy/banking/resource-bar";
import { TravelInfo } from "@/ui/features/economy/resources";
import { formatNumber, knownBalance } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  configManager,
  divideByPrecision,
  getBalance,
  getClosestBank,
  getEntityIdFromKeys,
  isMilitaryResource,
  MarketManager,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, ID, Resources, resources, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export const ResourceSwap = ({ entityId, listResourceId }: { entityId: ID; listResourceId: number }) => {
  const mode = useGameModeConfig();
  const {
    account: { account },
    setup: { store, systemCalls },
  } = useGame();

  const revision = useNativeRevision([
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "Market",
    "Liquidity",
    "Structure",
  ]);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const playTradeExecuteSound = useUISound("ui.trade_execute");

  const [isBuyResource, setIsBuyResource] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<ResourcesIds>(ResourcesIds.Wood);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [canCarry, setCanCarry] = useState(false);
  const [openConfirmation, setOpenConfirmation] = useState(false);
  const confirmsLoss = useConfirmsLoss();

  const ownerFee = lordsAmount * configManager.getAdminBankOwnerFee();
  const lpFee = (isBuyResource ? lordsAmount : resourceAmount) * configManager.getAdminBankLpFee();

  const marketManager = useMemo(
    () => new MarketManager(store, ContractAddress(account.address), resourceId),
    [store, resourceId, account.address, revision],
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
    () => getBalance(entityId, ResourcesIds.Lords, currentDefaultTick, store).balance,
    [entityId, currentDefaultTick, store, revision],
  );
  const resourceBalance = useMemo(
    () => getBalance(entityId, resourceId, currentDefaultTick, store).balance,
    [entityId, resourceId, currentDefaultTick, store, revision],
  );

  const hasEnough = useMemo(() => {
    const amount = isBuyResource ? lordsAmount + ownerFee : resourceAmount;
    const balance = isBuyResource ? lordsBalance : resourceBalance;
    return balance !== undefined && multiplyByPrecision(amount) <= balance;
  }, [isBuyResource, lordsAmount, resourceAmount, resourceBalance, lordsBalance, ownerFee]);

  const amountsBiggerThanZero = lordsAmount > 0 && resourceAmount > 0;

  const canSwap = useMemo(() => amountsBiggerThanZero && hasEnough, [lordsAmount, resourceAmount, hasEnough]);

  const onInvert = useCallback(() => setIsBuyResource((prev) => !prev), []);

  const onSwap = useCallback(async () => {
    const operation = isBuyResource ? systemCalls.buy_resources : systemCalls.sell_resources;
    const closestBank = getClosestBank(entityId, store);
    if (!closestBank) return;
    setIsLoading(true);
    const performSwap = () => {
      return operation({
        signer: account,
        bank_entity_id: closestBank.bankId,
        entity_id: entityId,
        resource_type: resourceId,
        amount: multiplyByPrecision(Number(resourceAmount.toFixed(2))),
      });
    };

    await performSwap()
      .catch((error) => console.error("Failed to swap", error))
      .finally(() => {
        playTradeExecuteSound();
        setIsLoading(false);
        setOpenConfirmation(false);
      });
  }, [
    isBuyResource,
    account,
    store,
    entityId,
    lordsAmount,
    ownerFee,
    playTradeExecuteSound,
    resourceAmount,
    resourceId,
    systemCalls.buy_resources,
    systemCalls.sell_resources,
  ]);

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
          max={isLords ? (knownBalance(lordsBalance) ?? 0) : Infinity}
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

  const closestBank = getClosestBank(entityId, store);
  const isVillageAndMilitaryResource =
    store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.base.category ===
      StructureType.Village && isMilitaryResource(resourceId);
  const swapLabel = `Swap ${isBuyResource ? "Lords" : chosenResourceName} for ${isBuyResource ? chosenResourceName : "Lords"}`;
  // The swap acts at once; in Frontier it asks first, with what it takes and gives.
  const pressSwap = () => (confirmsLoss ? setOpenConfirmation(true) : onSwap());

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      <div className="flex flex-col gap-1">
        {isBuyResource ? renderResourceBar(false, true) : renderResourceBar(false, false)}
        <span className="flex justify-center">
          <HudIconButton icon="refresh" label="Swap sides" kind="secondary" size="sm" onClick={onInvert} />
        </span>
        {isBuyResource ? renderResourceBar(true, false) : renderResourceBar(true, true)}
      </div>
      <div className="flex flex-col gap-1">
        <HudRow
          title="Price"
          trail={`1 ${chosenResourceName} = ${formatNumber(marketManager.getMarketPrice(), 4)} LORDS`}
        />
        <HudRow
          title="Slippage"
          trail={
            <span className="text-hud-bad">
              -
              {formatNumber(
                marketManager.slippage(
                  isBuyResource
                    ? multiplyByPrecision(Math.abs(lordsAmount - lpFee))
                    : multiplyByPrecision(Math.abs(resourceAmount - lpFee)),
                  isBuyResource,
                ) || 0,
                4,
              )}
              %
            </span>
          }
        />
        <HudRow
          title={`Bank Owner Fee (${configManager.getAdminBankOwnerFee() * 100}%)`}
          trail={<span className="text-hud-bad">{formatNumber(-ownerFee, 4)} Lords</span>}
        />
        <HudRow
          title={`LP Fee (${configManager.getAdminBankLpFee() * 100}%)`}
          trail={
            <span className="text-hud-bad">
              {formatNumber(-lpFee, 4)} {isBuyResource ? "Lords" : chosenResourceName}
            </span>
          }
        />
      </div>
      {closestBank && (
        <TravelInfo
          entityId={entityId}
          resources={
            isBuyResource
              ? [{ resourceId: Number(resourceId), amount: resourceAmount }]
              : [{ resourceId: ResourcesIds.Lords, amount: lordsAmount }]
          }
          bankId={closestBank.bankId}
          setCanCarry={setCanCarry}
          isAmm={true}
        />
      )}
      {isVillageAndMilitaryResource && (
        <HudNotice tone="bad" line="Military resources cannot be traded from village structures." />
      )}
      {canSwap && !canCarry && (
        <HudNotice
          tone="bad"
          line={`Warning: not enough donkeys to transport ${isBuyResource ? chosenResourceName : "Lords"}`}
        />
      )}
      {!amountsBiggerThanZero && <HudNotice tone="warn" line="Enter an amount to swap" />}
      {!hasEnough && <HudNotice tone="bad" line="Insufficient balance" />}
      <HudButton
        kind="primary"
        busy={isLoading ? "Swapping…" : undefined}
        disabled={!canSwap || !canCarry || isVillageAndMilitaryResource || !closestBank}
        onClick={pressSwap}
      >
        {swapLabel}
      </HudButton>
      {openConfirmation && (
        <PopoverPanel
          id="confirm"
          ariaLabel="Confirm Swap"
          anchor="top-center"
          onDismiss={() => setOpenConfirmation(false)}
        >
          <HudConfirm
            question="Confirm Swap"
            verb={swapLabel}
            onConfirm={onSwap}
            onBack={() => setOpenConfirmation(false)}
          >
            <SwapSummary
              gives={{
                resourceId: isBuyResource ? ResourcesIds.Lords : resourceId,
                amount: isBuyResource ? lordsAmount + ownerFee : resourceAmount,
              }}
              gets={{
                resourceId: isBuyResource ? resourceId : ResourcesIds.Lords,
                amount: isBuyResource ? resourceAmount : lordsAmount,
              }}
            />
          </HudConfirm>
        </PopoverPanel>
      )}
    </div>
  );
};

/** What a swap takes, in the bad tone, and what it gives, in the good. */
const SwapSummary = ({
  gives,
  gets,
}: {
  gives: { resourceId: ResourcesIds; amount: number };
  gets: { resourceId: ResourcesIds; amount: number };
}) => (
  <span className="flex items-center justify-center gap-2 text-hud-strong">
    <span className="flex items-center text-hud-bad">
      -{gives.amount.toLocaleString()}
      <ResourceIcon resource={gives.resourceId} size="md" />
    </span>
    <span>→</span>
    <span className="flex items-center text-hud-good">
      +{gets.amount.toLocaleString()}
      <ResourceIcon resource={gets.resourceId} size="md" />
    </span>
  </span>
);
