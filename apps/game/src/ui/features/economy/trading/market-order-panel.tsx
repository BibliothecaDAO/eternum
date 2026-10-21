import { configManager } from "@bibliothecadao/eternum";
import { heldAgainstNeed } from "@/ui/design-system/kit/words";
import { useCurrentBlockTimestamp, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { useUISound } from "@/audio";
import { useConfirmsLoss } from "@/hooks/helpers/use-confirm-for";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import {
  HudButton,
  HudChip,
  HudConfirm,
  HudEmpty,
  HudNotice,
  HudNumberField,
  HudPanel,
  HudRow,
  HudTableHead,
  HudTableRow,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { PopoverPanel } from "@/ui/design-system/molecules/popover";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { knownAmount } from "@/ui/utils/utils";
import {
  calculateDonkeysNeeded,
  divideByPrecision,
  getTotalResourceWeightKg,
  isMilitaryResource,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useLatest } from "@/hooks/use-latest";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import {
  ResourcesIds,
  StructureType,
  type ID,
  type MarketInterface,
  formatAmount,
  formatCharge,
  formatExact,
  formatMoment,
  LORDS,
  resourceName,
  formatFigure,
} from "@bibliothecadao/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { resolveBestPrice } from "./best-prices";
import { toast } from "@/ui/features/event-feed/notify";

const ONE_MONTH = 2628000;
/** A table row's height, the sheet's control on the desk and its touch target on a phone (HUD_SHEET, HUD_PHONE): the
 * virtualizer positions rows from these numbers. */
const ORDER_ROW_HEIGHT_PX = { desktop: 36, compact: 44 } as const;
/** An offer's columns: how much, the price, the Lords total, and its verb. */
const ORDER_COLS = "1.2fr 1fr 1fr auto";
/** Text in a book side's tone: what buying gets green, what selling gets red. */
const sideTone = (good: boolean) => (good ? "text-hud-good" : "text-hud-bad");

/** The selected resource's two book sides in display order: the best offer leads each side. */
export const useSelectedResourceOffers = (
  resourceId: ResourcesIds,
  resourceAskOffers: MarketInterface[],
  resourceBidOffers: MarketInterface[],
) => {
  const bids = useMemo(
    () =>
      resourceBidOffers
        .filter((offer) => (resourceId ? offer.makerGets[0]?.resourceId === resourceId : true))
        .toSorted((a, b) => b.ratio - a.ratio),
    [resourceBidOffers, resourceId],
  );
  const asks = useMemo(
    () =>
      resourceAskOffers
        .filter((offer) => offer.takerGets[0].resourceId === resourceId)
        .toSorted((a, b) => b.ratio - a.ratio),
    [resourceAskOffers, resourceId],
  );
  return { asks, bids };
};

/** The desktop book: asks to buy from on the left, bids to sell to on the right. */
export const MarketOrderPanel = memo(
  ({
    resourceId,
    entityId,
    resourceAskOffers,
    resourceBidOffers,
  }: {
    resourceId: ResourcesIds;
    entityId: ID;
    resourceAskOffers: MarketInterface[];
    resourceBidOffers: MarketInterface[];
  }) => {
    const { asks, bids } = useSelectedResourceOffers(resourceId, resourceAskOffers, resourceBidOffers);

    return (
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <MarketOrders offers={asks} resourceId={resourceId} entityId={entityId} />
        <MarketOrders offers={bids} resourceId={resourceId} entityId={entityId} isBuy />
      </div>
    );
  },
);

export const VirtualizedOrderList = memo(
  ({ offers, entityId, isBuy }: { offers: MarketInterface[]; entityId: ID; isBuy: boolean }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const rowHeightPx = useOrderRowHeightPx();

    const virtualizer = useVirtualizer({
      count: offers.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => rowHeightPx,
      overscan: 5,
    });

    // The row estimate is not one of the virtualizer's memo keys, so a lane change re-measures explicitly.
    useEffect(() => {
      virtualizer.measure();
    }, [virtualizer, rowHeightPx]);

    return (
      <div ref={parentRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const offer = offers[virtualRow.index];
            return (
              <div
                key={offer.tradeId}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <OrderRow offer={offer} entityId={entityId} isBuy={isBuy} />
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

VirtualizedOrderList.displayName = "VirtualizedOrderList";

/** Order rows grow to a thumb-sized target on compact lanes. */
const useOrderRowHeightPx = () => (useCompactLane() ? ORDER_ROW_HEIGHT_PX.compact : ORDER_ROW_HEIGHT_PX.desktop);

const MarketOrders = memo(
  ({
    resourceId,
    entityId,
    isBuy = false,
    offers,
  }: {
    resourceId: ResourcesIds;
    entityId: ID;
    isBuy?: boolean;
    offers: MarketInterface[];
  }) => {
    return (
      <OrderBookSide resourceId={resourceId} isBuy={isBuy} offers={offers}>
        <div className="flex min-h-0 flex-1 flex-col">
          <OrderRowHeader resourceId={resourceId} isBuy={isBuy} />
          {offers.length === 0 ? (
            <EmptyBookSide isBuy={isBuy} />
          ) : (
            <VirtualizedOrderList offers={offers} entityId={entityId} isBuy={isBuy} />
          )}
        </div>
        <OrderCreation resourceId={resourceId} entityId={entityId} isBuy={isBuy} />
      </OrderBookSide>
    );
  },
);

/**
 * One book side: its headline (the best price on that side and how deep it is) over its offers. On a phone it folds,
 * and starts folded where the screen is shortest.
 */
export const OrderBookSide = ({
  resourceId,
  isBuy,
  offers,
  collapsible = false,
  defaultCollapsed = false,
  children,
}: {
  resourceId: ResourcesIds;
  isBuy: boolean;
  offers: MarketInterface[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: ReactNode;
}) => {
  // Asks: the cheapest one is the best buy. Bids: the highest one pays the most.
  const bestPrice = resolveBestPrice(offers, isBuy ? "bid" : "ask");
  return (
    <HudPanel
      kind="section"
      icon={resourceMeaning(resourceId)}
      title={
        <span>
          {isBuy ? "Sell to" : "Buy from"} <span className={sideTone(!isBuy)}>{formatFigure(bestPrice)}</span> {LORDS}
          each
        </span>
      }
      cue={`${offers.length} ${isBuy ? "bids" : "asks"}`}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
      className="flex min-h-0 flex-1 shrink flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col gap-2"
    >
      {children}
    </HudPanel>
  );
};

export const EmptyBookSide = ({ isBuy }: { isBuy: boolean }) => (
  <HudEmpty icon="trade" line={`No ${isBuy ? "buy" : "sell"} orders yet`} />
);

export const OrderRowHeader = memo(({ resourceId, isBuy }: { resourceId?: number; isBuy: boolean }) => (
  <HudTableHead cols={ORDER_COLS}>
    <span>Qty</span>
    <span className="flex items-center justify-center gap-0.5">
      {resourceId && (
        <>
          <ResourceIcon size="xs" resource={ResourcesIds.Lords} withTooltip={false} />
          <span>/</span>
          <ResourceIcon size="xs" resource={resourceId} withTooltip={false} />
        </>
      )}
    </span>
    <span className="text-center">{isBuy ? "Gain" : "Cost"}</span>
    <span className="w-14" />
  </HudTableHead>
));

export const OrderRow = memo(({ offer, entityId, isBuy }: { offer: MarketInterface; entityId: ID; isBuy: boolean }) => {
  const game = useGame();

  const playTradeExecuteSound = useUISound("ui.trade_execute");

  const currentDefaultTick = useCurrentDefaultTick();

  const resourceManager = useResourceManager(entityId);
  const [makerGets] = offer.makerGets;
  const [takerGets] = offer.takerGets;

  const lordsBalance = useMemo(() => {
    const balance = resourceManager.balance(ResourcesIds.Lords);
    return balance === undefined ? undefined : Number(balance);
  }, [resourceManager]);

  const resourceBalance = useMemo(
    () => resourceManager.balanceWithProduction(currentDefaultTick, makerGets.resourceId)?.balance,
    [resourceManager, currentDefaultTick, makerGets.resourceId],
  );

  const [confirmOrderModal, setConfirmOrderModal] = useState(false);
  const confirmsLoss = useConfirmsLoss();

  const [loading, setLoading] = useState(false);

  const isSelf = entityId === offer.makerId;
  const getsDisplayNumber = isBuy ? makerGets.amount : takerGets.amount;
  const getsDisplay = formatCharge(knownAmount(getsDisplayNumber));
  const getDisplayResource = isBuy ? makerGets.resourceId : takerGets.resourceId;
  const getTotalLords = isBuy ? takerGets.amount : makerGets.amount;

  const resourceBalanceRatio = useMemo(
    // A balance this client cannot see fills nothing.
    () =>
      resourceBalance === undefined ? 0 : resourceBalance < getsDisplayNumber ? resourceBalance / getsDisplayNumber : 1,
    [resourceBalance, getsDisplayNumber],
  );
  const lordsBalanceRatio = useMemo(
    () => (lordsBalance === undefined ? 0 : lordsBalance < getTotalLords ? lordsBalance / getTotalLords : 1),
    [lordsBalance, getTotalLords],
  );
  // The fill starts at the most the balance covers, and follows it.
  const coveredFill = divideByPrecision(getsDisplayNumber) * (isBuy ? resourceBalanceRatio : lordsBalanceRatio);
  const [inputValue, setInputValue] = useState(coveredFill);
  useEffect(() => {
    setInputValue(coveredFill);
  }, [coveredFill]);

  const calculatedResourceAmount = useMemo(() => multiplyByPrecision(inputValue), [inputValue]);

  // The Lords this fill takes: its share of the offer's total.
  const calculatedLords = useMemo(
    () => Math.ceil((inputValue / divideByPrecision(getsDisplayNumber, false)) * getTotalLords),
    [inputValue, getsDisplayNumber, getTotalLords],
  );

  const orderWeightKg = useMemo(() => {
    // divide by precision because getTotalResourceWeightKg is without precision
    const totalWeightKg = getTotalResourceWeightKg([
      {
        resourceId: takerGets.resourceId,
        amount: isBuy ? divideByPrecision(calculatedLords) : divideByPrecision(calculatedResourceAmount),
      },
    ]);
    return totalWeightKg;
  }, [takerGets.resourceId, isBuy, calculatedResourceAmount, calculatedLords]);

  const donkeysNeeded = useMemo(() => {
    return calculateDonkeysNeeded(orderWeightKg);
  }, [orderWeightKg]);

  const donkeyBalance = useMemo(() => {
    return knownAmount(resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey)?.balance);
  }, [resourceManager, currentDefaultTick]);

  const onAccept = async () => {
    try {
      setLoading(true);
      setConfirmOrderModal(false);

      const v = !isBuy ? calculatedResourceAmount : calculatedLords;
      const takerBuysCount = Math.ceil(v / offer.makerGivesMinResourceAmount);
      await game.setup.systemCalls.accept_order({
        signer: game.account.account,
        taker_id: entityId,
        trade_id: offer.tradeId,
        taker_buys_count: takerBuysCount,
      });
    } catch (error) {
      toast.failed(error, "The order could not be accepted.");
    } finally {
      playTradeExecuteSound();
      setLoading(false);
    }
  };

  const onCancel = async () => {
    try {
      setLoading(true);
      await game.setup.systemCalls.cancel_order({
        signer: game.account.account,
        trade_id: offer.tradeId,
      });
    } catch (error) {
      toast.failed(error, "The order could not be cancelled.");
    } finally {
      setLoading(false);
    }
  };

  const actionLabel = isSelf ? "Cancel" : isBuy ? "Sell" : "Buy";
  // Taking an offer asks how much; cancelling your own acts at once, but in Frontier, where a loss asks first.
  const pressAction = () => (isSelf && !confirmsLoss ? onCancel() : setConfirmOrderModal(true));

  return (
    <HudTableRow
      cols={ORDER_COLS}
      label={`${actionLabel} ${getsDisplay} at ${formatFigure(offer.perLords)} ${LORDS} each`}
      title={`Expires ${formatMoment(offer.expiresAt)}`}
      selected={isSelf}
    >
      <span className={`flex items-center gap-1 tabular-nums ${sideTone(!isBuy)}`}>
        <ResourceIcon withTooltip={false} size="xs" resource={getDisplayResource} />
        {getsDisplay}
      </span>
      <span className="text-center tabular-nums">{formatFigure(offer.perLords)}</span>
      <span className={`flex items-center justify-center gap-1 tabular-nums ${sideTone(isBuy)}`}>
        <ResourceIcon withTooltip={false} size="xs" resource={ResourcesIds.Lords} />
        {formatCharge(knownAmount(getTotalLords))}
      </span>
      <HudButton
        kind={isSelf ? "danger" : "secondary"}
        size="sm"
        busy={loading ? "…" : undefined}
        onClick={pressAction}
      >
        {actionLabel}
      </HudButton>
      {confirmOrderModal &&
        (isSelf ? (
          <OrderDialog title="Cancel this order?" onCancel={() => setConfirmOrderModal(false)}>
            <HudConfirm
              question="Cancel this order?"
              verb="Cancel order"
              back="Keep it"
              tone="bad"
              onConfirm={() => onCancel().finally(() => setConfirmOrderModal(false))}
              onBack={() => setConfirmOrderModal(false)}
            />
          </OrderDialog>
        ) : (
          <TakeOfferForm
            isBuy={isBuy}
            onConfirm={onAccept}
            onCancel={() => setConfirmOrderModal(false)}
            loading={loading}
            inputValue={inputValue}
            setInputValue={setInputValue}
            maxInputValue={divideByPrecision(getsDisplayNumber) * (isBuy ? resourceBalanceRatio : lordsBalanceRatio)}
            getDisplayResource={getDisplayResource}
            calculatedLords={calculatedLords}
            donkeysNeeded={donkeysNeeded}
            donkeyBalance={donkeyBalance}
            isVillageAndMilitaryResource={
              game.setup.store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.base
                .category === StructureType.Village &&
              (isMilitaryResource(offer.makerGets[0].resourceId) || isMilitaryResource(offer.takerGets[0].resourceId))
            }
          />
        ))}
    </HudTableRow>
  );
});

/** A market dialog over the window: centred, and gone when dismissed. */
const OrderDialog = ({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) => (
  <PopoverPanel id="confirm" ariaLabel={title} anchor="top-center" onDismiss={onCancel}>
    {children}
  </PopoverPanel>
);

/** Taking an offer: how much of it (up to what this structure can pay or deliver), what it costs, and its donkeys. */
const TakeOfferForm = memo(
  ({
    isBuy,
    onConfirm,
    onCancel,
    loading,
    inputValue,
    setInputValue,
    maxInputValue,
    getDisplayResource,
    calculatedLords,
    donkeysNeeded,
    donkeyBalance,
    isVillageAndMilitaryResource,
  }: {
    isBuy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
    inputValue: number;
    setInputValue: (value: number) => void;
    maxInputValue: number;
    getDisplayResource: number;
    calculatedLords: number;
    donkeysNeeded: number;
    donkeyBalance: number | undefined;
    isVillageAndMilitaryResource: boolean;
  }) => {
    const verb = isBuy ? "Sell" : "Buy";
    const name = resourceName(getDisplayResource);
    const shortOfDonkeys = donkeyBalance === undefined || donkeysNeeded > donkeyBalance;
    return (
      <OrderDialog title={`${verb} ${name}`} onCancel={onCancel}>
        <HudWindow title={`${verb} ${name}`} icon={resourceMeaning(getDisplayResource)} size="task" onClose={onCancel}>
          <HudWindowFoot>
            <HudButton kind="quiet" onClick={onCancel}>
              Cancel
            </HudButton>
            <HudButton
              kind="primary"
              busy={loading ? "Trading…" : undefined}
              disabled={(!isBuy && shortOfDonkeys) || inputValue === 0 || isVillageAndMilitaryResource}
              onClick={onConfirm}
            >
              {verb}
            </HudButton>
          </HudWindowFoot>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <HudNumberField
                label={`${name} to ${verb.toLowerCase()}`}
                value={inputValue}
                max={maxInputValue}
                onChange={setInputValue}
              />
              <HudButton kind="secondary" onClick={() => setInputValue(maxInputValue)}>
                Max
              </HudButton>
            </div>
            <p>
              <span className={sideTone(!isBuy)}>{verb}</span> {formatCharge(inputValue)} {name} for{" "}
              {formatCharge(knownAmount(calculatedLords))} {LORDS}
            </p>
            <HudRow
              title="Donkeys Required"
              trail={
                <span className={`tabular-nums ${sideTone(!shortOfDonkeys)}`}>
                  {heldAgainstNeed(donkeyBalance, donkeysNeeded)}
                </span>
              }
            />
            {isVillageAndMilitaryResource && <HudNotice tone="bad" line={VILLAGE_MILITARY_REFUSAL} />}
          </div>
        </HudWindow>
      </OrderDialog>
    );
  },
);

/** Why a village's order for troops is refused, wherever the market says so. */
const VILLAGE_MILITARY_REFUSAL =
  "Villages cannot buy or sell military resources. You can only transfer them with your connected realm.";

/** How the form lays out: three inputs in a row on the desk, two inputs plus a computed total on a phone. */
type OrderCreationLayout = "desktop" | "compact";

export const OrderCreation = memo(
  ({
    entityId,
    resourceId,
    isBuy = false,
    layout = "desktop",
    suggestedPrice,
  }: {
    entityId: ID;
    resourceId: ResourcesIds;
    isBuy?: boolean;
    layout?: OrderCreationLayout;
    /** The best price on the side being traded against; fills the price until the player types their own. */
    suggestedPrice?: number;
  }) => {
    const [loading, setLoading] = useState(false);
    const [resource, setResource] = useState(100);
    const [lords, setLords] = useState(100);
    const [bid, setBid] = useState(String(lords / resource));
    const [priceTouched, setPriceTouched] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const currentBlockTimestamp = useCurrentBlockTimestamp();

    const playTradePlaceSound = useUISound("ui.trade_place");

    const {
      account: { account },
      setup: {
        store,
        systemCalls: { create_order },
      },
    } = useGame();

    useEffect(() => {
      setBid(String(lords / resource));
    }, [resource, lords]);

    const updateLords = useCallback((newBid: number, newResource: number) => {
      setLords(Number(newBid * newResource));
    }, []);

    const handleBidChange = (newBid: number) => {
      const numericBid = Number(newBid);
      if (!isNaN(numericBid) && numericBid > 0) {
        setBid(String(newBid));
        updateLords(numericBid, resource);
      }
    };

    const typePrice = (newBid: number) => {
      setPriceTouched(true);
      handleBidChange(newBid);
    };

    // The market's best price stands in until the player types one; a typed price survives side and resource changes.
    // It prices the amount standing then; a new amount keeps the Lords and moves the price instead.
    const standingAmount = useLatest(resource);
    useEffect(() => {
      if (priceTouched || suggestedPrice === undefined || suggestedPrice <= 0) return;
      setBid(String(suggestedPrice));
      updateLords(suggestedPrice, standingAmount.current);
    }, [suggestedPrice, priceTouched, updateLords, standingAmount]);

    const takerGives = useMemo(() => {
      return isBuy ? [resourceId, multiplyByPrecision(resource)] : [ResourcesIds.Lords, multiplyByPrecision(lords)];
    }, [isBuy, resource, resourceId, lords]);

    const makerGives = useMemo(() => {
      return isBuy ? [ResourcesIds.Lords, multiplyByPrecision(lords)] : [resourceId, multiplyByPrecision(resource)];
    }, [isBuy, resource, resourceId, lords]);

    const createOrderParams = useMemo(() => {
      const maxDecimalPlaces = 7;
      let pow10 = 0;
      let rate = takerGives[1] / makerGives[1];
      if (!Number.isInteger(rate)) {
        // get the number of decimal places in rate
        const rateStr = rate.toString();
        let decimalPlaces = 0;

        if (rateStr.includes(".")) {
          decimalPlaces = rateStr.split(".")[1]?.length || 0;
        } else if (rateStr.includes("e-")) {
          // Handle scientific notation like 1e-6
          decimalPlaces = parseInt(rateStr.split("e-")[1], 10);
        }

        decimalPlaces = Math.min(decimalPlaces, maxDecimalPlaces);

        // convert the rate to an integer
        rate = Math.floor(rate * 10 ** decimalPlaces);
        pow10 = decimalPlaces;
      }
      const makerGivesMinResourceAmount = 1 * 10 ** pow10;
      const makerGivesMaxCount = BigInt(makerGives[1]) / BigInt(makerGivesMinResourceAmount);
      const takerPaysMinResourceAmount = rate;

      return {
        makerGivesMinResourceAmount,
        makerGivesMaxCount,
        takerPaysMinResourceAmount,
      };
    }, [takerGives, makerGives]);

    const createOrder = async () => {
      if (!currentBlockTimestamp) return;
      setLoading(true);

      const calldata = {
        signer: account,
        maker_id: entityId,
        maker_gives_resource_type: makerGives[0],
        taker_pays_resource_type: takerGives[0],
        maker_gives_min_resource_amount: createOrderParams.makerGivesMinResourceAmount,
        maker_gives_max_count: createOrderParams.makerGivesMaxCount,
        taker_id: 0,
        taker_pays_min_resource_amount: createOrderParams.takerPaysMinResourceAmount,
        expires_at: currentBlockTimestamp + ONE_MONTH,
      };
      try {
        await create_order(calldata);
        playTradePlaceSound();
      } catch (error) {
        toast.failed(error, "The order could not be placed.");
      } finally {
        setLoading(false);
        setShowConfirmation(false);
      }
    };

    const orderWeightKg = useMemo(() => {
      const totalWeight = getTotalResourceWeightKg([
        {
          resourceId: isBuy ? resourceId : ResourcesIds.Lords,
          amount: isBuy ? resource : lords,
        },
      ]);
      return totalWeight;
    }, [isBuy, resourceId, resource, lords]);

    const donkeysNeeded = useMemo(() => {
      return calculateDonkeysNeeded(orderWeightKg);
    }, [orderWeightKg]);

    const currentDefaultTick = useCurrentDefaultTick();

    const resourceManager = useResourceManager(entityId);

    // divide to get the number of donkeys without precision
    const donkeyBalance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey)?.balance;
    }, [resourceManager, currentDefaultTick]);

    const resourceBalance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, resourceId)?.balance;
    }, [resourceManager, currentDefaultTick, resourceId]);

    const lordsBalance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Lords)?.balance;
    }, [resourceManager, currentDefaultTick]);

    const canBuy = useMemo(() => {
      // A balance this client cannot see never covers an order.
      const balance = isBuy ? lordsBalance : resourceBalance;
      return balance !== undefined && balance > (isBuy ? lords : resource);
    }, [isBuy, resource, lords, lordsBalance, resourceBalance]);

    const enoughDonkeys = useMemo(() => {
      if (resourceId === ResourcesIds.Donkey) return true;
      return donkeyBalance !== undefined && donkeyBalance >= donkeysNeeded;
    }, [donkeyBalance, donkeysNeeded, resourceId]);

    const isVillageAndMilitaryResource =
      store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.base.category ===
        StructureType.Village && isMilitaryResource(resourceId);
    const confirmsLoss = useConfirmsLoss();
    const name = resourceName(resourceId);
    // Placing an order acts at once; in Frontier it asks first, with the order spelled out.
    const placeOrder = () => (confirmsLoss ? setShowConfirmation(true) : createOrder());

    const confirmPlaceOrder = (
      <OrderDialog title={`Place this ${isBuy ? "buy" : "sell"} order?`} onCancel={() => setShowConfirmation(false)}>
        <HudConfirm
          question={`Place this ${isBuy ? "buy" : "sell"} order?`}
          verb={`${isBuy ? "Buy" : "Sell"} ${formatCharge(resource)} ${name}`}
          onConfirm={createOrder}
          onBack={() => setShowConfirmation(false)}
        >
          <span>
            {formatCharge(resource)} {name} for {formatCharge(lords)} {LORDS}, at {formatFigure(Number(bid))} {LORDS}{" "}
            each.
          </span>
        </HudConfirm>
      </OrderDialog>
    );

    const amountField = (
      <OrderField
        label={isBuy ? "Buy" : "Sell"}
        icon={resourceId}
        available={formatAmount(knownAmount(resourceBalance))}
      >
        <HudNumberField
          label={`${name} to ${isBuy ? "buy" : "sell"}`}
          value={resource}
          onChange={setResource}
          max={!isBuy ? (knownAmount(resourceBalance) ?? 0) : Infinity}
        />
      </OrderField>
    );
    const priceField = (
      <OrderField label={`${LORDS} / ${name}`} icon={ResourcesIds.Lords}>
        <HudNumberField
          label={`${LORDS} per ${name}`}
          value={Number(bid)}
          onChange={typePrice}
          max={Infinity}
          decimals
        />
      </OrderField>
    );
    const lordsField = (
      <OrderField
        label={isBuy ? "Cost" : "Gain"}
        icon={ResourcesIds.Lords}
        available={formatAmount(knownAmount(lordsBalance))}
      >
        <HudNumberField
          label={`${LORDS} to ${isBuy ? "pay" : "gain"}`}
          value={lords}
          onChange={setLords}
          max={isBuy ? (knownAmount(lordsBalance) ?? 0) : Infinity}
        />
      </OrderField>
    );
    const logisticsChips = (
      <div className="flex items-center gap-1.5">
        <span title="Donkeys available / needed">
          <HudChip tone={enoughDonkeys ? undefined : "bad"}>
            <ResourceIcon resource={ResourcesIds.Donkey} size="xs" withTooltip={false} />
            {heldAgainstNeed(knownAmount(donkeyBalance), donkeysNeeded)}
          </HudChip>
        </span>
        <span title="Weight">
          <HudChip>{formatExact(orderWeightKg)} kg</HudChip>
        </span>
      </div>
    );
    const submitButton = (
      <HudButton
        kind="primary"
        busy={loading ? "…" : undefined}
        disabled={!enoughDonkeys || !canBuy || isVillageAndMilitaryResource}
        onClick={placeOrder}
      >
        {`${isBuy ? "Buy" : "Sell"} ${formatCharge(resource)} ${name}`}
      </HudButton>
    );

    return (
      <div className="flex flex-col gap-2 border-t border-hud-divider pt-2">
        {layout === "compact" ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {amountField}
              {priceField}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LordsTotal isBuy={isBuy} lords={lords} available={formatAmount(knownAmount(lordsBalance))} />
              {logisticsChips}
            </div>
            {submitButton}
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
              {amountField}
              {priceField}
              {lordsField}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {logisticsChips}
              {submitButton}
            </div>
          </>
        )}
        {isVillageAndMilitaryResource && <HudNotice tone="bad" line={VILLAGE_MILITARY_REFUSAL} />}
        {showConfirmation && confirmPlaceOrder}
      </div>
    );
  },
);

/** The compact form's third value as a line instead of an input: the Lords the order costs or gains. */
const LordsTotal = ({ isBuy, lords, available }: { isBuy: boolean; lords: number; available: string }) => (
  <span className="flex items-center gap-1 text-hud-label" title={`${isBuy ? "Cost" : "Gain"} / Lords available`}>
    <ResourceIcon withTooltip={false} size="xs" resource={ResourcesIds.Lords} />
    <span className="text-hud-muted">{isBuy ? "Cost" : "Gain"}</span>
    <span className="text-hud-strong">{formatCharge(lords)}</span>
    <span className="text-hud-muted">/ {available}</span>
  </span>
);

const OrderField = ({
  label,
  icon,
  available,
  children,
}: {
  label: string;
  icon: ResourcesIds;
  available?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="flex items-center gap-1 text-hud-label text-hud-muted">
      <ResourceIcon withTooltip={false} size="xs" resource={icon} />
      {label}
    </span>
    {children}
    {available !== undefined && <span className="text-hud-label text-hud-muted">{available} avail.</span>}
  </div>
);
