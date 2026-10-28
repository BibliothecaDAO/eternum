import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUISound } from "@/audio";
import { useConfirmsLoss } from "@/hooks/helpers/use-confirm-for";
import { HudButton, HudConfirm, HudIconButton, HudNotice, HudRow } from "@/ui/design-system/kit/hud-elements";
import { priceEach } from "@/ui/design-system/kit/words";
import { PopoverPanel } from "@/ui/design-system/molecules/popover";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourceBar } from "@/ui/features/economy/banking/resource-bar";
import { TravelInfo } from "@/ui/features/economy/resources";
import { knownAmount } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  configManager,
  divideByPrecision,
  getBalance,
  getClosestBank,
  isMilitaryResource,
  MarketManager,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useLatest } from "@/hooks/use-latest";
import {
  ContractAddress,
  ID,
  Resources,
  resources,
  ResourcesIds,
  StructureType,
  formatCharge,
  LORDS,
  resourceName,
  formatPercent,
  formatFigure,
} from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";

export const ResourceSwap = ({ entityId, listResourceId }: { entityId: ID; listResourceId: number }) => {
  const mode = useGameModeConfig();
  const {
    account: { account },
    setup: { store, systemCalls },
  } = useGame();

  const facts = useNativeFacts([
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
    () => new MarketManager(facts.store, ContractAddress(account.address), resourceId),
    [facts, resourceId, account.address],
  );

  useEffect(() => {
    setResourceId(listResourceId);
  }, [listResourceId]);

  const lordsBalance = useMemo(
    () => getBalance(entityId, ResourcesIds.Lords, currentDefaultTick, facts.store).balance,
    [entityId, currentDefaultTick, facts],
  );
  const resourceBalance = useMemo(
    () => getBalance(entityId, resourceId, currentDefaultTick, facts.store).balance,
    [entityId, resourceId, currentDefaultTick, facts],
  );

  const hasEnough = useMemo(() => {
    const amount = isBuyResource ? lordsAmount + ownerFee : resourceAmount;
    const balance = isBuyResource ? lordsBalance : resourceBalance;
    return balance !== undefined && multiplyByPrecision(amount) <= balance;
  }, [isBuyResource, lordsAmount, resourceAmount, resourceBalance, lordsBalance, ownerFee]);

  const amountsBiggerThanZero = lordsAmount > 0 && resourceAmount > 0;

  const canSwap = amountsBiggerThanZero && hasEnough;

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
      .catch((error) => toast.failed(error, "The swap failed."))
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
    playTradeExecuteSound,
    resourceAmount,
    resourceId,
    systemCalls.buy_resources,
    systemCalls.sell_resources,
  ]);

  const chosenResourceName = resourceName(Number(resourceId));

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
        false,
      );
      setLordsAmount(calculatedLordsAmount);
    } else {
      const calculatedLordsAmount = divideByPrecision(
        marketManager.calculateLordsOutputForResourceInput(
          multiplyByPrecision(amount) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
        false,
      );
      const lordsAmountAfterFee = calculatedLordsAmount * (1 - configManager.getAdminBankOwnerFee());
      setLordsAmount(lordsAmountAfterFee);
    }
  };

  // A new resource quotes the side the player typed again, against its own market.
  const requote = useLatest(() =>
    isBuyResource ? handleResourceAmountChange(resourceAmount) : handleLordsAmountChange(lordsAmount),
  );
  useEffect(() => {
    requote.current();
  }, [resourceId, requote]);

  const orderedResources = useMemo(() => {
    return Object.values(mode.resources.getTiers())
      .flat()
      .map((id) => resources.find((r) => r.id === id))
      .filter((r): r is Resources => !!r)
      .filter((r) => !Number.isNaN(r.id));
  }, [mode.resources]);

  const renderResourceBar = (disableInput: boolean, isLords: boolean) => {
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
        max={isLords ? (knownAmount(lordsBalance) ?? 0) : Infinity}
      />
    );
  };

  const closestBank = getClosestBank(entityId, store);
  const isVillageAndMilitaryResource =
    store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.base.category ===
      StructureType.Village && isMilitaryResource(resourceId);
  const swapLabel = `Swap ${isBuyResource ? LORDS : chosenResourceName} for ${isBuyResource ? chosenResourceName : LORDS}`;
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
        <HudRow title="Price" trail={priceEach(formatFigure(marketManager.getMarketPrice()), LORDS)} />
        <HudRow
          title="Slippage"
          trail={
            <span className="text-hud-bad">
              {formatPercent(
                -(
                  marketManager.slippage(
                    isBuyResource
                      ? multiplyByPrecision(Math.abs(lordsAmount - lpFee))
                      : multiplyByPrecision(Math.abs(resourceAmount - lpFee)),
                    isBuyResource,
                  ) || 0
                ) / 100,
                { signed: true },
              )}
            </span>
          }
        />
        <HudRow
          title={`Bank Owner Fee (${formatPercent(configManager.getAdminBankOwnerFee())})`}
          trail={
            <span className="text-hud-bad">
              {formatCharge(-ownerFee)} {LORDS}
            </span>
          }
        />
        <HudRow
          title={`LP Fee (${formatPercent(configManager.getAdminBankLpFee())})`}
          trail={
            <span className="text-hud-bad">
              {formatCharge(-lpFee)} {isBuyResource ? LORDS : chosenResourceName}
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
      {isVillageAndMilitaryResource && <HudNotice tone="bad" line="Villages cannot trade military resources." />}
      {canSwap && !canCarry && (
        <HudNotice
          tone="bad"
          line={`Warning: not enough donkeys to transport ${isBuyResource ? chosenResourceName : LORDS}`}
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
      -{formatCharge(gives.amount)}
      <ResourceIcon resource={gives.resourceId} size="md" />
    </span>
    <span>→</span>
    <span className="flex items-center text-hud-good">
      +{formatCharge(gets.amount)}
      <ResourceIcon resource={gets.resourceId} size="md" />
    </span>
  </span>
);
