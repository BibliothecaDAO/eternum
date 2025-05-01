import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { ConfirmationPopup } from "@/ui/components/bank/confirmation-popup";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { calculateArrivalTime, currencyFormat, formatArrivalTime, formatNumber } from "@/ui/utils/utils";
import {
  calculateDonkeysNeeded,
  computeTravelTime,
  configManager,
  divideByPrecision,
  getAddressNameFromEntity,
  getEntityIdFromKeys,
  getTotalResourceWeightKg,
  isMilitaryResource,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import {
  EntityType,
  findResourceById,
  ResourcesIds,
  StructureType,
  type ID,
  type MarketInterface,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

const ONE_MONTH = 2628000;

export const MarketResource = memo(
  ({
    entityId,
    resourceId,
    active,
    onClick,
    askPrice,
    bidPrice,
    ammPrice,
  }: {
    entityId: ID;
    resourceId: ResourcesIds;
    active: boolean;
    onClick: (value: number) => void;
    askPrice: number;
    bidPrice: number;
    ammPrice: number;
  }) => {
    const { currentDefaultTick } = useBlockTimestamp();
    const resourceManager = useResourceManager(entityId);

    const production = useMemo(() => {
      return resourceManager.getProduction(resourceId);
    }, []);

    const balance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, resourceId);
    }, [resourceManager, production, currentDefaultTick]);

    const resource = useMemo(() => {
      return findResourceById(resourceId);
    }, [resourceId]);

    return (
      <div
        onClick={() => {
          onClick(resourceId);
        }}
        className={`w-full border-gold/5 rounded-xl h-8 p-1 cursor-pointer grid grid-cols-5 gap-1 hover:bg-gold/10 hover:  group ${
          active ? "panel-gold" : ""
        }`}
      >
        <div className="flex items-center gap-2 col-span-2">
          <ResourceIcon size="sm" resource={resource?.trait || ""} withTooltip={false} />
          <div className="truncate text-xs">{resource?.trait || ""}</div>
          <div className="text-xs text-gold/70 group-hover:text-green">
            [{currencyFormat(balance ? Number(balance) : 0, 0)}]
          </div>
        </div>

        <div className="text-green  flex items-center justify-center text-xs">{formatNumber(bidPrice, 4)}</div>
        <div className="text-red  flex items-center justify-center text-xs">{formatNumber(askPrice, 4)}</div>
        <div className="text-blueish  flex items-center justify-center text-xs">{formatNumber(ammPrice, 4)}</div>
      </div>
    );
  },
);

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
    const selectedResourceBidOffers = useMemo(() => {
      return resourceBidOffers
        .filter((offer) => (resourceId ? offer.makerGets[0]?.resourceId === resourceId : true))
        .sort((a, b) => b.ratio - a.ratio);
    }, [resourceBidOffers, resourceId]);

    const selectedResourceAskOffers = useMemo(() => {
      return resourceAskOffers
        .filter((offer) => offer.takerGets[0].resourceId === resourceId)
        .sort((a, b) => b.ratio - a.ratio);
    }, [resourceAskOffers, resourceId]);

    return (
      <div className="order-book-selector grid grid-cols-2 p-4 h-full">
        <MarketOrders offers={selectedResourceAskOffers} resourceId={resourceId} entityId={entityId} />
        <MarketOrders offers={selectedResourceBidOffers} resourceId={resourceId} entityId={entityId} isBuy />
      </div>
    );
  },
);

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
    const [updateBalance, setUpdateBalance] = useState(false);

    const lowestPrice = useMemo(() => {
      const price = offers.reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);
      return price === Infinity ? 0 : price;
    }, [offers]);

    return (
      <div className="h-full flex flex-col ">
        {/* Market Price */}
        <div
          className={`text-2xl flex panel-wood    justify-between py-2 px-4 border-gold/10 rounded-xl ${
            !isBuy ? "bg-green/5 text-green" : "bg-red/5 text-red"
          }`}
        >
          <div className="self-center flex">
            <div className="flex flex-col">
              {/* <h5 className="">{findResourceById(resourceId)?.trait || ""}</h5> */}
              <div className="flex gap-3 self-center">
                <ResourceIcon withTooltip={true} size="lg" resource={findResourceById(resourceId)?.trait || ""} />
                <div className="self-center">{formatNumber(lowestPrice, 4)}</div>
              </div>
            </div>
          </div>
          <div className="self-center">
            {offers.length} {isBuy ? "bid" : "ask"}
          </div>
        </div>

        <div
          className={`p-1 panel-wood flex-col flex gap-1  flex-grow border-gold/10 border overflow-y-auto h-auto rounded-xl ${
            isBuy ? "order-buy-selector" : "order-sell-selector"
          }`}
        >
          <OrderRowHeader resourceId={resourceId} isBuy={isBuy} />

          <div className={`flex-col flex gap-1 flex-grow overflow-y-auto h-96 relative `}>
            {offers.map((offer, index) => (
              <OrderRow
                key={offer.tradeId}
                offer={offer}
                entityId={entityId}
                isBuy={isBuy}
                updateBalance={updateBalance}
                setUpdateBalance={setUpdateBalance}
              />
            ))}
          </div>
        </div>

        <OrderCreation resourceId={resourceId} entityId={entityId} isBuy={isBuy} />
      </div>
    );
  },
);

const OrderRowHeader = memo(({ resourceId, isBuy }: { resourceId?: number; isBuy: boolean }) => {
  return (
    <div className="grid grid-cols-5 gap-2 p-2 uppercase text-xs">
      <div>qty.</div>
      <div>dist.</div>
      <div className="flex">
        {resourceId && (
          <>
            {" "}
            <ResourceIcon size="xs" resource={"Lords"} />
            per/
            <ResourceIcon size="xs" resource={findResourceById(resourceId)?.trait || ""} />
          </>
        )}
      </div>
      <div className="flex">{isBuy ? "gain" : "cost"}</div>
      <div className="ml-auto">Action</div>
    </div>
  );
});

const OrderRow = memo(
  ({
    offer,
    entityId,
    isBuy,
    updateBalance,
    setUpdateBalance,
  }: {
    offer: MarketInterface;
    entityId: ID;
    isBuy: boolean;
    updateBalance: boolean;
    setUpdateBalance: (value: boolean) => void;
  }) => {
    const dojo = useDojo();

    const { play: playLordsSound } = useUiSounds(soundSelector.addLords);

    const { currentDefaultTick } = useBlockTimestamp();

    const resourceManager = useResourceManager(entityId);

    const lordsBalance = useMemo(() => Number(resourceManager.balance(ResourcesIds.Lords)), [entityId, updateBalance]);

    const resourceBalance = useMemo(
      () => Number(resourceManager.balanceWithProduction(currentDefaultTick, offer.makerGets[0].resourceId)),
      [entityId, updateBalance],
    );

    const [confirmOrderModal, setConfirmOrderModal] = useState(false);

    const travelTime = useMemo(
      () =>
        computeTravelTime(
          entityId,
          offer.makerId,
          configManager.getSpeedConfig(EntityType.DONKEY),
          dojo.setup.components,
          true,
        ),
      [entityId, offer],
    );

    const [loading, setLoading] = useState(false);

    const isSelf = useMemo(() => {
      return entityId === offer.makerId;
    }, [entityId, offer.makerId, offer.tradeId]);

    const getsDisplay = useMemo(() => {
      return isBuy ? currencyFormat(offer.makerGets[0].amount, 3) : currencyFormat(offer.takerGets[0].amount, 3);
    }, [entityId, offer.makerId, offer.tradeId, offer]);

    const getsDisplayNumber = useMemo(() => {
      return isBuy ? offer.makerGets[0].amount : offer.takerGets[0].amount;
    }, [entityId, offer.makerId, offer.tradeId]);

    const getDisplayResource = useMemo(() => {
      return isBuy ? offer.makerGets[0].resourceId : offer.takerGets[0].resourceId;
    }, [entityId, offer.makerId, offer.tradeId]);

    const getTotalLords = useMemo(() => {
      return isBuy ? offer.takerGets[0].amount : offer.makerGets[0].amount;
    }, [entityId, offer.makerId, offer.tradeId, offer]);

    const resourceBalanceRatio = useMemo(
      () => (resourceBalance < getsDisplayNumber ? resourceBalance / getsDisplayNumber : 1),
      [resourceBalance, getsDisplayNumber],
    );
    const lordsBalanceRatio = useMemo(
      () => (lordsBalance < getTotalLords ? lordsBalance / getTotalLords : 1),
      [lordsBalance, getTotalLords],
    );
    const [inputValue, setInputValue] = useState<number>(() => {
      return isBuy
        ? divideByPrecision(offer.makerGets[0].amount) * resourceBalanceRatio
        : divideByPrecision(offer.takerGets[0].amount) * lordsBalanceRatio;
    });

    useEffect(() => {
      setInputValue(
        isBuy
          ? divideByPrecision(offer.makerGets[0].amount) * resourceBalanceRatio
          : divideByPrecision(offer.takerGets[0].amount) * lordsBalanceRatio,
      );
    }, [resourceBalanceRatio, lordsBalanceRatio]);

    const calculatedResourceAmount = useMemo(() => {
      return multiplyByPrecision(inputValue);
    }, [inputValue, getsDisplay, getTotalLords]);

    const calculatedLords = useMemo(() => {
      return Math.ceil((inputValue / parseFloat(getsDisplay.replace(/,/g, ""))) * getTotalLords);
    }, [inputValue, getsDisplay, getTotalLords]);

    const orderWeightKg = useMemo(() => {
      const totalWeightKg = getTotalResourceWeightKg([
        {
          resourceId: offer.takerGets[0].resourceId,
          amount: isBuy ? calculatedLords : calculatedResourceAmount,
        },
      ]);
      return totalWeightKg;
    }, [entityId, calculatedResourceAmount, calculatedLords]);

    const donkeysNeeded = useMemo(() => {
      return calculateDonkeysNeeded(orderWeightKg);
    }, [orderWeightKg]);

    const donkeyProduction = useMemo(() => {
      return resourceManager.getProduction(ResourcesIds.Donkey);
    }, []);

    const donkeyBalance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey);
    }, [resourceManager, donkeyProduction, currentDefaultTick]);

    const accountName = useMemo(() => {
      return getAddressNameFromEntity(offer.makerId, dojo.setup.components);
    }, [offer.originName]);

    const onAccept = async () => {
      try {
        setLoading(true);
        setConfirmOrderModal(false);

        await dojo.setup.systemCalls.accept_order({
          signer: dojo.account.account,
          taker_id: entityId,
          trade_id: offer.tradeId,
          taker_buys_count: isBuy ? calculatedResourceAmount : calculatedLords,
        });
      } catch (error) {
        console.error("Failed to accept order", error);
      } finally {
        playLordsSound();
        setUpdateBalance(!updateBalance);
        setLoading(false);
      }
    };

    const onCancel = async () => {
      try {
        setLoading(true);
        await dojo.setup.systemCalls.cancel_order({
          signer: dojo.account.account,
          trade_id: offer.tradeId,
        });
      } catch (error) {
        console.error("Failed to cancel order", error);
      } finally {
        setLoading(false);
      }
    };

    const renderConfirmationPopup = useCallback(() => {
      const isVillageAndMilitaryResource =
        getComponentValue(dojo.setup.components.Structure, getEntityIdFromKeys([BigInt(entityId)]))?.category ===
          StructureType.Village &&
        (isMilitaryResource(offer.makerGets[0].resourceId) || isMilitaryResource(offer.takerGets[0].resourceId));

      return (
        <ConfirmationPopup
          title={isSelf ? "Confirm Cancel Order" : `Confirm ${isBuy ? "Sell" : "Buy"}`}
          onConfirm={isSelf ? onCancel : onAccept}
          onCancel={() => setConfirmOrderModal(false)}
          isLoading={loading}
          disabled={
            isSelf
              ? false
              : (!isBuy && donkeysNeeded > donkeyBalance) || inputValue === 0 || isVillageAndMilitaryResource
          }
        >
          {isSelf ? (
            <div className="p-4 text-center">
              <p>Are you sure you want to cancel this order?</p>
            </div>
          ) : (
            <div className="p-4 text-center">
              <div className="flex gap-3 mb-4">
                <NumberInput
                  value={inputValue}
                  className="w-full"
                  onChange={setInputValue}
                  max={divideByPrecision(getsDisplayNumber) * (isBuy ? resourceBalanceRatio : lordsBalanceRatio)}
                />
                <Button
                  onClick={() =>
                    setInputValue(
                      divideByPrecision(getsDisplayNumber) * (isBuy ? resourceBalanceRatio : lordsBalanceRatio),
                    )
                  }
                >
                  Max
                </Button>
              </div>
              <p className="mb-2">
                <span className={isBuy ? "text-red" : "text-green"}>{isBuy ? "Sell" : "Buy"}</span>{" "}
                <span className="">{inputValue} </span> {findResourceById(getDisplayResource)?.trait} for{" "}
                <span className="">{currencyFormat(calculatedLords, 2)}</span> Lords
              </p>
              <div className="flex justify-between mt-4">
                <div>Donkeys Required</div>
                <div className={donkeysNeeded > donkeyBalance ? "text-red" : "text-green"}>
                  {donkeysNeeded} [{donkeyBalance}]
                </div>
              </div>
            </div>
          )}
        </ConfirmationPopup>
      );
    }, [
      isSelf,
      isBuy,
      donkeysNeeded,
      donkeyBalance,
      loading,
      inputValue,
      getsDisplayNumber,
      resourceBalanceRatio,
      lordsBalanceRatio,
      getDisplayResource,
      calculatedLords,
      calculatedResourceAmount,
      onCancel,
      onAccept,
    ]);

    return (
      <div
        key={offer.tradeId}
        className={`flex flex-col p-1  px-2  hover:bg-white/15 duration-150 border-gold/10 border relative rounded text-sm ${
          isSelf ? "bg-blueish/10" : "bg-white/10"
        }`}
      >
        <div className="grid grid-cols-5 gap-1">
          <div className={`flex gap-1  ${isBuy ? "text-red" : "text-green"} `}>
            <ResourceIcon withTooltip={false} size="sm" resource={findResourceById(getDisplayResource)?.trait || ""} />{" "}
            {getsDisplay}
          </div>
          {travelTime && (
            <div className="flex flex-col">
              <div className="text-gold font-semibold">
                Estimated Arrival: {formatArrivalTime(calculateArrivalTime(travelTime))}
              </div>
            </div>
          )}
          <div className="flex gap-1 text-green">{formatNumber(offer.perLords, 4)}</div>
          <div className={`flex gap-1  ${isBuy ? "text-green" : "text-red"}`}>
            <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} />
            {currencyFormat(getTotalLords, 0)}
          </div>
          {!isSelf ? (
            <Button
              isLoading={loading}
              onClick={() => setConfirmOrderModal(true)}
              size="xs"
              className={`self-center flex flex-grow`}
            >
              {!isBuy ? "Buy" : "Sell"}
            </Button>
          ) : (
            <Button
              onClick={() => setConfirmOrderModal(true)}
              variant="danger"
              size="xs"
              className={`self-center flex flex-grow`}
            >
              {loading ? "cancelling" : "cancel"}
            </Button>
          )}
          <div className="col-span-2 text-xxs text-gold/50 uppercase">
            expire: {new Date(offer.expiresAt * 1000).toLocaleString()}
          </div>
          <div className="col-span-3 text-xxs uppercase text-right text-gold/50">
            {accountName} ({offer.originName})
          </div>
        </div>
        {confirmOrderModal && renderConfirmationPopup()}
      </div>
    );
  },
);

const OrderCreation = memo(
  ({ entityId, resourceId, isBuy = false }: { entityId: ID; resourceId: ResourcesIds; isBuy?: boolean }) => {
    const [loading, setLoading] = useState(false);
    const [resource, setResource] = useState(100);
    const [lords, setLords] = useState(100);
    const [bid, setBid] = useState(String(lords / resource));
    const [showConfirmation, setShowConfirmation] = useState(false);
    const { currentBlockTimestamp } = useBlockTimestamp();

    const { play: playLordsSound } = useUiSounds(soundSelector.addLords);

    const {
      account: { account },
      setup: {
        components,
        systemCalls: { create_order },
      },
    } = useDojo();

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

    const takerGives = useMemo(() => {
      return isBuy ? [resourceId, multiplyByPrecision(resource)] : [ResourcesIds.Lords, multiplyByPrecision(lords)];
    }, [resource, resourceId, lords]);

    const makerGives = useMemo(() => {
      return isBuy ? [ResourcesIds.Lords, multiplyByPrecision(lords)] : [resourceId, multiplyByPrecision(resource)];
    }, [resource, resourceId, lords]);

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
        playLordsSound();
      } catch (error) {
        console.error("Failed to create order:", error);
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
    }, [resource, lords]);

    const donkeysNeeded = useMemo(() => {
      return calculateDonkeysNeeded(orderWeightKg);
    }, [orderWeightKg]);

    const { currentDefaultTick } = useBlockTimestamp();

    const resourceManager = useResourceManager(entityId);

    const donkeyProduction = useMemo(() => {
      return resourceManager.getProduction(ResourcesIds.Donkey);
    }, []);

    const donkeyBalance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey);
    }, [resourceManager, donkeyProduction, currentDefaultTick]);

    const resourceProduction = useMemo(() => {
      return resourceManager.getProduction(resourceId);
    }, [resourceId]);

    const resourceBalance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, resourceId);
    }, [resourceManager, resourceProduction, currentDefaultTick]);

    const lordsProduction = useMemo(() => {
      return resourceManager.getProduction(ResourcesIds.Lords);
    }, []);

    const lordsBalance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Lords);
    }, [resourceManager, lordsProduction, currentDefaultTick]);

    const canBuy = useMemo(() => {
      return isBuy ? lordsBalance > lords : resourceBalance > resource;
    }, [resource, lords, donkeyBalance, lordsBalance, resourceBalance]);

    const enoughDonkeys = useMemo(() => {
      if (resourceId === ResourcesIds.Donkey) return true;
      return donkeyBalance >= donkeysNeeded;
    }, [donkeyBalance, donkeysNeeded, resourceId]);

    const renderConfirmationPopupCreateOrder = useCallback(() => {
      const isVillageAndMilitaryResource =
        getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]))?.category ===
          StructureType.Village && isMilitaryResource(resourceId);

      return (
        <ConfirmationPopup
          title={`Confirm ${isBuy ? "Buy" : "Sell"} Order`}
          onConfirm={createOrder}
          onCancel={() => setShowConfirmation(false)}
          isLoading={loading}
          disabled={isVillageAndMilitaryResource}
        >
          <div className="p-4 text-center">
            <p className="mb-4">
              Villages cannot buy or sell military resources. You can only transfer them with your connected realm.
            </p>
            <div className="flex flex-col gap-2">
              <div>
                Amount: {resource.toLocaleString()} {findResourceById(resourceId)?.trait}
              </div>
              <div>Price: {lords.toLocaleString()} Lords</div>
              <div>
                Rate: {Number(bid).toFixed(4)} Lords/{findResourceById(resourceId)?.trait}
              </div>
            </div>
          </div>
        </ConfirmationPopup>
      );
    }, [isBuy, createOrder, loading, setShowConfirmation]);

    return (
      <div
        className={`flex justify-between p-4 text-xl flex-wrap mt-auto  border-gold/10 panel-wood  ${
          isBuy ? "order-create-buy-selector" : "order-create-sell-selector"
        }`}
      >
        <div className="flex w-full gap-8">
          <div className="w-1/3 gap-1 flex flex-col">
            <div className="uppercase text-sm flex gap-2 ">
              <ResourceIcon withTooltip={false} size="xs" resource={findResourceById(resourceId)?.trait || ""} />{" "}
              {isBuy ? "Buy" : "Sell"}
            </div>
            <NumberInput
              value={resource}
              className="w-full col-span-3"
              onChange={(value) => {
                setResource(Number(value));
              }}
              max={!isBuy ? divideByPrecision(resourceBalance) : Infinity}
            />

            <div className="text-sm  text-gold/70">
              {currencyFormat(resourceBalance ? Number(resourceBalance) : 0, 0)} avail.
            </div>
          </div>
          <div className="flex flex-col w-1/3 justify-center text-center  self-center">
            <div className="">
              <div className="uppercase text-sm flex gap-2">
                <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} />
                per /{" "}
                <ResourceIcon withTooltip={false} size="xs" resource={findResourceById(resourceId)?.trait || ""} />
              </div>
              <NumberInput
                allowDecimals={true}
                value={Number(bid)}
                onChange={handleBidChange}
                className="w-full"
                max={Infinity}
              />
            </div>
            <div className="text-sm  text-gold/70 flex mt-1">
              {isBuy ? "Cost " : "Gain "}
              {Number(bid).toFixed(0)} Lords/{findResourceById(resourceId)?.trait}
            </div>
          </div>
          <div className="w-1/3 gap-1 flex flex-col">
            <div className="uppercase text-sm flex gap-2 ">
              <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} /> {isBuy ? "Cost" : "Gain"}
            </div>
            <NumberInput
              value={lords}
              className="w-full col-span-3"
              onChange={(value) => {
                setLords(Number(value));
              }}
              max={isBuy ? divideByPrecision(lordsBalance) : Infinity}
            />

            <div className="text-sm  text-gold/70">
              {currencyFormat(lordsBalance ? Number(lordsBalance) : 0, 0)} avail.
            </div>
          </div>
        </div>
        <div className="mt-8 ml-auto text-right w-auto  text-lg">
          <div>
            <div className="donkeys-used-selector flex justify-between gap-8">
              <h6>Donkeys Used</h6>
              <div className="flex gap-2">
                {donkeysNeeded.toLocaleString()}{" "}
                <div className="text-green text-xs self-center">
                  [{currencyFormat(donkeyBalance ? Number(donkeyBalance) : 0, 0).toLocaleString()} avail.]
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <h6>Weight</h6>
              <div className="flex gap-2">
                <div>{orderWeightKg.toLocaleString()} kgs</div>
              </div>
            </div>
          </div>

          <Button
            disabled={!enoughDonkeys || !canBuy}
            isLoading={loading}
            className="mt-4 h-8"
            onClick={() => setShowConfirmation(true)}
            size="md"
            variant="primary"
          >
            Create {isBuy ? "Buy " : "Sell "} Order of {resource.toLocaleString()} {findResourceById(resourceId)?.trait}
          </Button>
        </div>
        {showConfirmation && renderConfirmationPopupCreateOrder()}
      </div>
    );
  },
);
