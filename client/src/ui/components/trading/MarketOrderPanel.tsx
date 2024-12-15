import { ResourceManager } from "@/dojo/modelManager/ResourceManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { useResourceManager } from "@/hooks/helpers/useResources";
import { useIsResourcesLocked } from "@/hooks/helpers/useStructures";
import { useTravel } from "@/hooks/helpers/useTravel";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import {
  calculateDonkeysNeeded,
  currencyFormat,
  divideByPrecision,
  formatNumber,
  getTotalResourceWeight,
  multiplyByPrecision,
} from "@/ui/utils/utils";
import {
  DONKEY_ENTITY_TYPE,
  ONE_MONTH,
  ResourcesIds,
  findResourceById,
  type ID,
  type MarketInterface,
} from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmationPopup } from "../bank/ConfirmationPopup";

export const MarketResource = ({
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
  const { currentDefaultTick } = useNextBlockTimestamp();
  const resourceManager = useResourceManager(entityId, resourceId);

  const production = useMemo(() => {
    return resourceManager.getProduction();
  }, []);

  const balance = useMemo(() => {
    return resourceManager.balance(currentDefaultTick);
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
        active ? "bg-gold/10" : ""
      }`}
    >
      <div className="flex items-center gap-2 col-span-2">
        <ResourceIcon size="sm" resource={resource?.trait || ""} withTooltip={false} />
        <div className="truncate text-xs">{resource?.trait || ""}</div>
        <div className="text-xs text-gold/70 group-hover:text-green">
          [{currencyFormat(balance ? Number(balance) : 0, 0)}]
        </div>
      </div>

      <div className="text-green font-bold flex items-center justify-center text-xs">{formatNumber(bidPrice, 4)}</div>
      <div className="text-red font-bold flex items-center justify-center text-xs">{formatNumber(askPrice, 4)}</div>
      <div className="text-blueish font-bold flex items-center justify-center text-xs">{formatNumber(ammPrice, 4)}</div>
    </div>
  );
};

export const MarketOrderPanel = ({
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

  const isResourcesLocked = useIsResourcesLocked(entityId);

  return (
    <div className="order-book-selector grid grid-cols-2 gap-4 p-4 h-full">
      <MarketOrders
        offers={selectedResourceAskOffers}
        resourceId={resourceId}
        entityId={entityId}
        isResourcesLocked={isResourcesLocked}
      />
      <MarketOrders
        offers={selectedResourceBidOffers}
        resourceId={resourceId}
        entityId={entityId}
        isResourcesLocked={isResourcesLocked}
        isBuy
      />
    </div>
  );
};

const MarketOrders = ({
  resourceId,
  entityId,
  isBuy = false,
  offers,
  isResourcesLocked,
}: {
  resourceId: ResourcesIds;
  entityId: ID;
  isBuy?: boolean;
  offers: MarketInterface[];
  isResourcesLocked: boolean;
}) => {
  const [updateBalance, setUpdateBalance] = useState(false);

  const lowestPrice = useMemo(() => {
    const price = offers.reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);
    return price === Infinity ? 0 : price;
  }, [offers]);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Market Price */}
      <div
        className={`text-2xl flex  font-bold  justify-between py-4 px-8 border-gold/10 border rounded-xl ${
          !isBuy ? "bg-green/20 text-green" : "bg-red/20 text-red"
        }`}
      >
        <div className="self-center flex gap-4">
          <div className="flex flex-col">
            <div className="uppercase text-sm text-opacity-80">{findResourceById(resourceId)?.trait || ""}</div>
            <div className="flex gap-3">
              <ResourceIcon withTooltip={false} size="lg" resource={findResourceById(resourceId)?.trait || ""} />
              <div className="self-center">{formatNumber(lowestPrice, 4)}</div>
            </div>
          </div>
        </div>
        <div className="self-center">
          {offers.length} {isBuy ? "bid" : "ask"}
        </div>
      </div>

      <div
        className={`p-1 bg-brown  flex-col flex gap-1  flex-grow border-gold/10 border overflow-y-scroll h-auto rounded-xl ${
          isBuy ? "order-buy-selector" : "order-sell-selector"
        }`}
      >
        <OrderRowHeader resourceId={resourceId} isBuy={isBuy} />

        <div
          className={`flex-col flex gap-1 flex-grow overflow-y-auto h-96 relative ${
            isResourcesLocked ? "opacity-50" : ""
          }`}
        >
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
          {isResourcesLocked && (
            <div className="absolute inset-0 bg-brown/50 flex items-center justify-center text-xl text-bold">
              Resources locked in battle
            </div>
          )}
        </div>
      </div>

      <OrderCreation resourceId={resourceId} entityId={entityId} isBuy={isBuy} />
    </div>
  );
};

const OrderRowHeader = ({ resourceId, isBuy }: { resourceId?: number; isBuy: boolean }) => {
  return (
    <div className="grid grid-cols-5 gap-2 p-2 uppercase text-xs font-bold ">
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
};

const OrderRow = ({
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
  const { computeTravelTime } = useTravel();
  const dojo = useDojo();

  const { play: playLordsSound } = useUiSounds(soundSelector.addLords);

  const lordsManager = new ResourceManager(dojo.setup, entityId, ResourcesIds.Lords);
  const lordsBalance = useMemo(() => Number(lordsManager.getResource()?.balance || 0n), [entityId, updateBalance]);

  const resourceManager = useResourceManager(entityId, offer.makerGets[0].resourceId);

  const resourceBalance = useMemo(
    () => Number(resourceManager.getResource()?.balance || 0n),
    [entityId, updateBalance],
  );

  const { getRealmAddressName } = useRealm();

  const isMakerResourcesLocked = useIsResourcesLocked(offer.makerId);

  const [confirmOrderModal, setConfirmOrderModal] = useState(false);

  const travelTime = useMemo(
    () => computeTravelTime(entityId, offer.makerId, configManager.getSpeedConfig(DONKEY_ENTITY_TYPE), true),
    [entityId, offer],
  );

  const returnResources = useMemo(() => {
    return [offer.takerGets[0].resourceId, offer.takerGets[0].amount];
  }, [offer]);

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

  const { currentDefaultTick } = useNextBlockTimestamp();

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

  const orderWeight = useMemo(() => {
    const totalWeight = getTotalResourceWeight([
      {
        resourceId: offer.takerGets[0].resourceId,
        amount: isBuy ? calculatedLords : calculatedResourceAmount,
      },
    ]);
    return totalWeight;
  }, [entityId, calculatedResourceAmount, calculatedLords]);

  const donkeysNeeded = useMemo(() => {
    return calculateDonkeysNeeded(orderWeight);
  }, [orderWeight]);

  const donkeyProductionManager = useResourceManager(entityId, ResourcesIds.Donkey);

  const donkeyProduction = useMemo(() => {
    return donkeyProductionManager.getProduction();
  }, []);

  const donkeyBalance = useMemo(() => {
    return divideByPrecision(donkeyProductionManager.balance(currentDefaultTick));
  }, [donkeyProductionManager, donkeyProduction, currentDefaultTick]);

  const accountName = useMemo(() => {
    return getRealmAddressName(offer.makerId);
  }, [offer.originName]);

  const onAccept = async () => {
    try {
      setLoading(true);
      setConfirmOrderModal(false);

      await dojo.setup.systemCalls.accept_partial_order({
        signer: dojo.account.account,
        taker_id: entityId,
        trade_id: offer.tradeId,
        maker_gives_resources: [offer.takerGets[0].resourceId, offer.takerGets[0].amount],
        taker_gives_resources: [offer.makerGets[0].resourceId, offer.makerGets[0].amount],
        taker_gives_actual_amount: isBuy ? calculatedResourceAmount : calculatedLords,
      });
    } catch (error) {
      console.error("Failed to accept order", error);
    } finally {
      playLordsSound();
      setUpdateBalance(!updateBalance);
      setLoading(false);
    }
  };

  return (
    <div
      key={offer.tradeId}
      className={`flex flex-col p-1  px-2  hover:bg-white/15 duration-150 border-gold/10 border relative rounded text-sm ${
        isSelf ? "bg-blueish/10" : "bg-white/10"
      } ${isMakerResourcesLocked ? "opacity-50" : ""}`}
    >
      {isMakerResourcesLocked && (
        <div className="absolute inset-0 bg-brown/50 flex items-center justify-center text-lg">
          Resources locked in battle
        </div>
      )}
      <div className="grid grid-cols-5 gap-1">
        <div className={`flex gap-1 font-bold ${isBuy ? "text-red" : "text-green"} `}>
          <ResourceIcon withTooltip={false} size="sm" resource={findResourceById(getDisplayResource)?.trait || ""} />{" "}
          {getsDisplay}
        </div>
        {travelTime && (
          <div>
            {Math.floor(travelTime / 60)} hrs {travelTime % 60} mins
          </div>
        )}
        <div className="flex gap-1 text-green">{formatNumber(offer.perLords, 4)}</div>
        <div className={`flex gap-1 font-bold ${isBuy ? "text-green" : "text-red"}`}>
          <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} />
          {currencyFormat(getTotalLords, 0)}
        </div>
        {!isSelf ? (
          <Button
            isLoading={loading}
            onClick={() => {
              setConfirmOrderModal(true);
            }}
            size="xs"
            className={`self-center flex flex-grow ${isMakerResourcesLocked ? "pointer-events-none" : ""}`}
          >
            {!isBuy ? "Buy" : "Sell"}
          </Button>
        ) : (
          <Button
            onClick={async () => {
              setLoading(true);
              await dojo.setup.systemCalls.cancel_order({
                signer: dojo.account.account,
                trade_id: offer.tradeId,
                return_resources: returnResources,
              });
              setLoading(false);
            }}
            variant="danger"
            size="xs"
            className={clsx("self-center", { disable: isMakerResourcesLocked })}
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
      {confirmOrderModal && (
        <ConfirmationPopup
          title="Confirm Trade"
          onConfirm={onAccept}
          disabled={donkeysNeeded > donkeyBalance || donkeyBalance === 0}
          onCancel={() => {
            setConfirmOrderModal(false);
          }}
        >
          <div className=" p-8 rounded">
            <div className="text-center text-lg">
              <div className="flex gap-3">
                <NumberInput
                  value={inputValue}
                  className="w-full col-span-3"
                  onChange={setInputValue}
                  max={divideByPrecision(getsDisplayNumber) * (isBuy ? resourceBalanceRatio : lordsBalanceRatio)}
                />
                <Button
                  onClick={() => {
                    setInputValue(
                      divideByPrecision(getsDisplayNumber) * (isBuy ? resourceBalanceRatio : lordsBalanceRatio),
                    );
                  }}
                >
                  Max
                </Button>
              </div>
              <span className={isBuy ? "text-red" : "text-green"}>{isBuy ? "Sell" : "Buy"}</span>{" "}
              <span className="font-bold">{inputValue} </span> {findResourceById(getDisplayResource)?.trait} for{" "}
              <span className="font-bold">{currencyFormat(calculatedLords, 2)}</span> Lords
            </div>

            <div className="flex justify-between mt-4">
              <div className="text-right">Donkeys Required for Transfer</div>
              <div className={`text-gold text-left ${donkeysNeeded > donkeyBalance ? "text-red" : "text-green"}`}>
                {donkeysNeeded} [{donkeyBalance}]
              </div>
            </div>
          </div>
        </ConfirmationPopup>
      )}
    </div>
  );
};

const OrderCreation = ({
  entityId,
  resourceId,
  isBuy = false,
}: {
  entityId: ID;
  resourceId: ResourcesIds;
  isBuy?: boolean;
}) => {
  const [loading, setLoading] = useState(false);
  const [resource, setResource] = useState(1000);
  const [lords, setLords] = useState(100);
  const [bid, setBid] = useState(String(lords / resource));
  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const { play: playLordsSound } = useUiSounds(soundSelector.addLords);

  const {
    account: { account },
    setup: {
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

  const createOrder = async () => {
    if (!nextBlockTimestamp) return;
    setLoading(true);

    await create_order({
      signer: account,
      maker_id: entityId,
      maker_gives_resources: makerGives,
      taker_id: 0,
      taker_gives_resources: takerGives,
      expires_at: nextBlockTimestamp + ONE_MONTH,
    }).finally(() => {
      playLordsSound();
      setLoading(false);
    });
  };

  const orderWeight = useMemo(() => {
    const totalWeight = getTotalResourceWeight([
      { resourceId: isBuy ? resourceId : ResourcesIds.Lords, amount: isBuy ? resource : lords },
    ]);
    return totalWeight;
  }, [resource, lords]);

  const donkeysNeeded = useMemo(() => {
    return calculateDonkeysNeeded(multiplyByPrecision(orderWeight));
  }, [orderWeight]);

  const { currentDefaultTick } = useNextBlockTimestamp();

  const donkeyProductionManager = useResourceManager(entityId, ResourcesIds.Donkey);

  const donkeyProduction = useMemo(() => {
    return donkeyProductionManager.getProduction();
  }, []);

  const donkeyBalance = useMemo(() => {
    return donkeyProductionManager.balance(currentDefaultTick);
  }, [donkeyProductionManager, donkeyProduction, currentDefaultTick]);

  const resourceProductionManager = useResourceManager(entityId, resourceId);

  const resourceProduction = useMemo(() => {
    return resourceProductionManager.getProduction();
  }, [resourceId]);

  const resourceBalance = useMemo(() => {
    return resourceProductionManager.balance(currentDefaultTick);
  }, [resourceProduction, currentDefaultTick, resourceId]);

  const lordsProductionManager = useResourceManager(entityId, ResourcesIds.Lords);

  const lordsProduction = useMemo(() => {
    return lordsProductionManager.getProduction();
  }, []);

  const lordsBalance = useMemo(() => {
    return lordsProductionManager.balance(currentDefaultTick);
  }, [lordsProductionManager, lordsProduction, currentDefaultTick]);

  const canBuy = useMemo(() => {
    return isBuy ? lordsBalance > lords : resourceBalance > resource;
  }, [resource, lords, donkeyBalance, lordsBalance, resourceBalance]);

  const enoughDonkeys = useMemo(() => {
    if (resourceId === ResourcesIds.Donkey) return true;
    return donkeyBalance > donkeysNeeded;
  }, [donkeyBalance, donkeysNeeded, resourceId]);

  return (
    <div
      className={`flex justify-between p-4 text-xl flex-wrap mt-auto  bg-gold/5 border-gold/10 border rounded-xl ${
        isBuy ? "order-create-buy-selector" : "order-create-sell-selector"
      }`}
    >
      <div className="flex w-full gap-8">
        <div className="w-1/3 gap-1 flex flex-col">
          <div className="uppercase text-sm flex gap-2 font-bold">
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

          <div className="text-sm font-bold text-gold/70">
            {currencyFormat(resourceBalance ? Number(resourceBalance) : 0, 0)} avail.
          </div>
        </div>
        <div className="flex w-1/3 justify-center px-3 text-center font-bold self-center">
          <div className="uppercase text-2xl">
            <NumberInput
              allowDecimals={true}
              value={Number(bid)}
              onChange={handleBidChange}
              className="w-full text-center"
              max={Infinity}
            />
            <div className="uppercase text-xs flex gap-1 mt-1 ">
              <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} />
              per / <ResourceIcon withTooltip={false} size="xs" resource={findResourceById(resourceId)?.trait || ""} />
            </div>
          </div>
        </div>
        <div className="w-1/3 gap-1 flex flex-col">
          <div className="uppercase text-sm flex gap-2 font-bold">
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

          <div className="text-sm font-bold text-gold/70">
            {currencyFormat(lordsBalance ? Number(lordsBalance) : 0, 0)} avail.
          </div>
        </div>
      </div>
      <div className="mt-8 ml-auto text-right w-auto font-bold text-lg">
        <div>
          <div className="donkeys-used-selector flex justify-between gap-8">
            <div>Donkeys Used</div>
            <div className="flex gap-2">
              {donkeysNeeded.toLocaleString()}{" "}
              <div className="text-green text-xs self-center">
                [{currencyFormat(donkeyBalance ? Number(donkeyBalance) : 0, 0).toLocaleString()} avail.]
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <div>Weight</div>
            <div className="flex gap-2">
              <div>{divideByPrecision(orderWeight).toLocaleString()} kgs</div>
            </div>
          </div>
        </div>

        <Button
          disabled={!enoughDonkeys || !canBuy}
          isLoading={loading}
          className="mt-4 h-8"
          onClick={createOrder}
          size="md"
          variant="primary"
        >
          Create {isBuy ? "Buy " : "Sell "} Order of {resource.toLocaleString()} {findResourceById(resourceId)?.trait}
        </Button>
      </div>
    </div>
  );
};
