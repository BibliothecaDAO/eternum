import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { useProductionManager } from "@/hooks/helpers/useResources";
import { useTravel } from "@/hooks/helpers/useTravel";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat, divideByPrecision, getTotalResourceWeight, multiplyByPrecision } from "@/ui/utils/utils";
import {
  EternumGlobalConfig,
  ID,
  MarketInterface,
  ONE_MONTH,
  Resources,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { ConfirmationPopup } from "../bank/ConfirmationPopup";

export const MarketResource = ({
  entityId,
  resource,
  active,
  onClick,
  askPrice,
  bidPrice,
  depth,
}: {
  entityId: ID;
  resource: Resources;
  active: boolean;
  onClick: (value: number) => void;
  askPrice: string;
  bidPrice: string;
  depth: number;
}) => {
  const currentDefaultTick = useUIStore((state) => state.currentDefaultTick);
  const productionManager = useProductionManager(entityId, resource.id);

  const production = useMemo(() => {
    return productionManager.getProduction();
  }, []);

  const balance = useMemo(() => {
    return productionManager.balance(currentDefaultTick);
  }, [productionManager, production, currentDefaultTick]);

  return (
    <div
      onClick={() => onClick(resource.id)}
      className={`w-full border border-gold/5 h-8 p-1 cursor-pointer grid grid-cols-5 gap-1 hover:bg-gold/10 hover:  group ${
        active ? "bg-gold/10" : ""
      }`}
    >
      <div className="flex items-center gap-2 col-span-2">
        <ResourceIcon size="sm" resource={resource.trait} withTooltip={false} />
        <div className="truncate text-xs">{resource.trait}</div>
        <div className="text-xs text-gold/70 group-hover:text-green">
          [{currencyFormat(balance ? Number(balance) : 0, 0)}]
        </div>
      </div>

      <div className="text-red font-bold flex items-center justify-center">{bidPrice}</div>
      <div className="text-green font-bold flex items-center justify-center">{askPrice}</div>
      <div className="text-blueish font-bold flex items-center justify-center">{depth}</div>
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

  return (
    <div className="grid grid-cols-2 gap-4 p-4 h-full">
      <MarketOrders offers={selectedResourceAskOffers} resourceId={resourceId} entityId={entityId} />
      <MarketOrders offers={selectedResourceBidOffers} resourceId={resourceId} entityId={entityId} isBuy />
    </div>
  );
};

const MarketOrders = ({
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
  const lowestPrice = useMemo(() => {
    const price = offers.reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);
    return price === Infinity ? 0 : price;
  }, [offers]);

  return (
    <div className=" h-full flex flex-col gap-4">
      {/* Market Price */}
      <div
        className={`text-xl flex  font-bold  justify-between p-1 px-8 border-gold/10 border ${
          !isBuy ? "bg-green/20" : "bg-red/20"
        }`}
      >
        <div className="self-center flex gap-4">
          <ResourceIcon withTooltip={false} size="lg" resource={findResourceById(resourceId)?.trait || ""} />
          <div className="self-center">{lowestPrice.toFixed(2)}</div>
        </div>
        <div>
          {offers.length} {isBuy ? "bid" : "ask"}
        </div>
      </div>

      <div className="p-1 bg-white/5  flex-col flex gap-1  flex-grow border-gold/10 border overflow-y-scroll h-auto">
        <OrderRowHeader resourceId={resourceId} />

        <div className="flex-col flex gap-1 flex-grow overflow-y-auto h-96">
          {offers.map((offer, index) => (
            <OrderRow key={index} offer={offer} entityId={entityId} isBuy={isBuy} />
          ))}
        </div>
      </div>

      <OrderCreation initialBid={lowestPrice} resourceId={resourceId} entityId={entityId} isBuy={isBuy} />
    </div>
  );
};

const OrderRowHeader = ({ resourceId }: { resourceId?: number }) => {
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
      <div className="flex">cost</div>
      <div className="ml-auto">Action</div>
    </div>
  );
};

const OrderRow = ({ offer, entityId, isBuy }: { offer: MarketInterface; entityId: ID; isBuy: boolean }) => {
  const { computeTravelTime } = useTravel();
  const {
    account: { account },
    setup: {
      systemCalls: { cancel_order, accept_partial_order, accept_order },
    },
  } = useDojo();

  const { getRealmAddressName } = useRealm();

  const [inputValue, setInputValue] = useState<number>(() => {
    return isBuy
      ? offer.makerGets[0].amount / EternumGlobalConfig.resources.resourcePrecision
      : offer.takerGets[0].amount / EternumGlobalConfig.resources.resourcePrecision;
  });

  const [confirmOrderModal, setConfirmOrderModal] = useState(false);

  // TODO Distance
  const travelTime = useMemo(
    () => computeTravelTime(entityId, offer.makerId, EternumGlobalConfig.speed.donkey, true),
    [entityId, offer],
  );

  const returnResources = useMemo(() => {
    return isBuy
      ? [ResourcesIds.Lords, offer.takerGets[0].amount]
      : [offer.takerGets[0].resourceId, offer.takerGets[0].amount];
  }, []);

  const [loading, setLoading] = useState(false);

  const isSelf = useMemo(() => {
    return entityId === offer.makerId;
  }, [entityId, offer.makerId, offer.tradeId]);

  const getsDisplay = useMemo(() => {
    return isBuy ? currencyFormat(offer.makerGets[0].amount, 2) : currencyFormat(offer.takerGets[0].amount, 2);
  }, [entityId, offer.makerId, offer.tradeId]);

  const getsDisplayNumber = useMemo(() => {
    return isBuy ? offer.makerGets[0].amount : offer.takerGets[0].amount;
  }, [entityId, offer.makerId, offer.tradeId]);

  const getDisplayResource = useMemo(() => {
    return isBuy ? offer.makerGets[0].resourceId : offer.takerGets[0].resourceId;
  }, [entityId, offer.makerId, offer.tradeId]);

  const getTotalLords = useMemo(() => {
    return isBuy ? offer.takerGets[0].amount : offer.makerGets[0].amount;
  }, [entityId, offer.makerId, offer.tradeId]);

  const currentDefaultTick = useUIStore((state) => state.currentDefaultTick);
  const productionManager = useProductionManager(entityId, offer.makerGets[0].resourceId);

  const production = useMemo(() => {
    return productionManager.getProduction();
  }, [entityId, offer.makerId, offer.tradeId]);

  const balance = useMemo(() => {
    return productionManager.balance(currentDefaultTick);
  }, [productionManager, production, currentDefaultTick, entityId, offer.makerId, offer.tradeId]);

  const orderWeight = useMemo(() => {
    const totalWeight = getTotalResourceWeight([
      {
        resourceId: isBuy ? offer.takerGets[0].resourceId : offer.makerGets[0].resourceId,
        amount: isBuy ? offer.takerGets[0].amount : offer.makerGets[0].amount,
      },
    ]);
    return multiplyByPrecision(totalWeight);
  }, [entityId, offer.makerId, offer.tradeId]);

  const donkeysNeeded = useMemo(() => {
    return Math.ceil(divideByPrecision(orderWeight) / EternumGlobalConfig.carryCapacityGram.donkey);
  }, [orderWeight]);

  const donkeyProductionManager = useProductionManager(entityId, ResourcesIds.Donkey);

  const donkeyProduction = useMemo(() => {
    return donkeyProductionManager.getProduction();
  }, []);

  const donkeyBalance = useMemo(() => {
    return divideByPrecision(donkeyProductionManager.balance(currentDefaultTick));
  }, [donkeyProductionManager, donkeyProduction, currentDefaultTick]);

  const enoughDonkeys = useMemo(() => {
    return donkeyBalance > donkeysNeeded;
  }, [donkeyBalance, donkeysNeeded]);

  const canAccept = useMemo(() => {
    return enoughDonkeys;
  }, [productionManager, production, currentDefaultTick, entityId, offer.makerId, offer.tradeId, enoughDonkeys]);

  const accountName = useMemo(() => {
    return getRealmAddressName(offer.makerId);
  }, [offer.originName]);

  console.log(inputValue, getsDisplay, getTotalLords, EternumGlobalConfig.resources.resourcePrecision);

  const calculatedResourceAmount = useMemo(() => {
    return inputValue * EternumGlobalConfig.resources.resourcePrecision;
  }, [inputValue, getsDisplay, getTotalLords]);

  const calculatedLords = useMemo(() => {
    return Math.ceil((inputValue / parseFloat(getsDisplay.replace(/,/g, ""))) * getTotalLords);
  }, [inputValue, getsDisplay, getTotalLords]);

  console.log("calculatedLords", calculatedLords);

  const onAccept = async () => {
    try {
      setLoading(true);
      setConfirmOrderModal(false);

      await accept_partial_order({
        signer: account,
        taker_id: entityId,
        trade_id: offer.tradeId,
        maker_gives_resources: [offer.takerGets[0].resourceId, offer.takerGets[0].amount],
        taker_gives_resources: [offer.makerGets[0].resourceId, offer.makerGets[0].amount],
        taker_gives_actual_amount: isBuy ? calculatedResourceAmount : calculatedLords,
      });
    } catch (error) {
      console.error("Failed to accept order", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div
      key={offer.tradeId}
      className={`flex flex-col p-1  px-2  hover:bg-white/15 duration-150 border-gold/10 border  text-xs ${
        isSelf ? "bg-blueish/10" : "bg-white/10"
      }`}
    >
      <div className="grid grid-cols-5 gap-1">
        <div className={`flex gap-1 font-bold ${isBuy ? "text-red" : "text-green"} `}>
          {!enoughDonkeys && (
            <div className="bg-red rounded-full animate-pulse">
              <ResourceIcon withTooltip={false} size="xs" resource={"Donkeys"} />
            </div>
          )}
          <ResourceIcon withTooltip={false} size="xs" resource={findResourceById(getDisplayResource)?.trait || ""} />{" "}
          {getsDisplay}
        </div>
        {travelTime && (
          <div>
            {Math.floor(travelTime / 60)} hrs {travelTime % 60} mins
          </div>
        )}
        <div className="flex gap-1 text-green">{offer.perLords.toFixed(2)}</div>
        <div className={`flex gap-1 font-bold ${isBuy ? "text-green" : "text-red"}`}>
          <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} />
          {currencyFormat(getTotalLords, 0)}
        </div>
        {!isSelf ? (
          canAccept ? (
            <Button
              isLoading={loading}
              onClick={() => setConfirmOrderModal(true)}
              size="xs"
              className="self-center flex flex-grow"
            >
              {!isBuy ? "Buy" : "Sell"}
            </Button>
          ) : (
            <div className="text-xs text-center">no funds</div>
          )
        ) : (
          <Button
            onClick={async () => {
              setLoading(true);
              await cancel_order({
                signer: account,
                trade_id: offer.tradeId,
                return_resources: returnResources,
              });
              setLoading(false);
            }}
            variant="danger"
            size="xs"
            className="self-center"
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
        <ConfirmationPopup title="Confirm Trade" onConfirm={onAccept} onCancel={() => setConfirmOrderModal(false)}>
          <div className=" p-8 rounded">
            <div className="text-center text-lg">
              <div className="flex gap-3">
                <NumberInput
                  value={inputValue}
                  className="w-full col-span-3"
                  onChange={setInputValue}
                  max={getsDisplayNumber / EternumGlobalConfig.resources.resourcePrecision}
                />
                <Button
                  onClick={() => setInputValue(getsDisplayNumber / EternumGlobalConfig.resources.resourcePrecision)}
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
  initialBid,
  entityId,
  resourceId,
  isBuy = false,
}: {
  initialBid: number;
  entityId: ID;
  resourceId: ResourcesIds;
  isBuy?: boolean;
}) => {
  const [loading, setLoading] = useState(false);
  const [resource, setResource] = useState(1000);
  const [lords, setLords] = useState(100);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);
  const {
    account: { account },
    setup: {
      systemCalls: { create_order },
    },
  } = useDojo();

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
      setLoading(false);
    });
  };

  const bid = useMemo(() => {
    return (lords / resource).toFixed(2);
  }, [resource, lords]);

  const orderWeight = useMemo(() => {
    const totalWeight = getTotalResourceWeight([
      { resourceId: isBuy ? resourceId : ResourcesIds.Lords, amount: isBuy ? resource : lords },
    ]);
    return multiplyByPrecision(totalWeight);
  }, [resource, lords]);

  const donkeysNeeded = useMemo(() => {
    return Math.ceil(divideByPrecision(orderWeight) / EternumGlobalConfig.carryCapacityGram.donkey);
  }, [orderWeight]);

  const currentDefaultTick = useUIStore((state) => state.currentDefaultTick);
  const donkeyProductionManager = useProductionManager(entityId, ResourcesIds.Donkey);

  const donkeyProduction = useMemo(() => {
    return donkeyProductionManager.getProduction();
  }, []);

  const donkeyBalance = useMemo(() => {
    return donkeyProductionManager.balance(currentDefaultTick);
  }, [donkeyProductionManager, donkeyProduction, currentDefaultTick]);

  const resourceProductionManager = useProductionManager(entityId, resourceId);

  const resourceProduction = useMemo(() => {
    return resourceProductionManager.getProduction();
  }, [resourceId]);

  const resourceBalance = useMemo(() => {
    return resourceProductionManager.balance(currentDefaultTick);
  }, [resourceProduction, resourceProduction, currentDefaultTick, resourceId]);

  const lordsProductionManager = useProductionManager(entityId, ResourcesIds.Lords);

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
    <div className="flex justify-between p-4 text-xl flex-wrap mt-auto  bg-gold/5 border-gold/10 border">
      <div className="flex w-full gap-8">
        <div className="w-1/3 gap-1 flex flex-col">
          <div className="uppercase text-sm flex gap-2 font-bold">
            <ResourceIcon withTooltip={false} size="xs" resource={findResourceById(resourceId)?.trait || ""} />{" "}
            {isBuy ? "Buy" : "Sell"}
          </div>
          <NumberInput
            value={resource}
            className="w-full col-span-3"
            onChange={(value) => setResource(Number(value))}
            max={!isBuy ? resourceBalance / EternumGlobalConfig.resources.resourcePrecision : Infinity}
          />

          <div className="text-sm font-bold text-gold/70">
            {currencyFormat(resourceBalance ? Number(resourceBalance) : 0, 0)} avail.
          </div>
        </div>
        <div className="flex w-1/3 justify-center px-3 text-center font-bold self-center">
          <div className="uppercase text-2xl">
            {bid.toString()}
            <div className="uppercase text-xs flex gap-1 mt-1 ">
              <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} />
              per / <ResourceIcon withTooltip={false} size="xs" resource={findResourceById(resourceId)?.trait || ""} />
            </div>
          </div>
        </div>
        <div className="w-1/3 gap-1 flex flex-col">
          <div className="uppercase text-sm flex gap-2 font-bold">
            <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} /> Cost
          </div>
          <NumberInput
            value={lords}
            className="w-full col-span-3"
            onChange={(value) => setLords(Number(value))}
            max={isBuy ? lordsBalance / EternumGlobalConfig.resources.resourcePrecision : Infinity}
          />

          <div className="text-sm font-bold text-gold/70">
            {currencyFormat(lordsBalance ? Number(lordsBalance) : 0, 0)} avail.
          </div>
        </div>
      </div>
      <div className="mt-8 ml-auto text-right w-auto font-bold text-lg">
        <div>
          <div className="flex justify-between gap-8">
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
          Create {isBuy ? "Buy " : `Sell `} Order of {resource.toLocaleString()} {findResourceById(resourceId)?.trait}
        </Button>
      </div>
    </div>
  );
};
