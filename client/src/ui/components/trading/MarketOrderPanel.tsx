import { useDojo } from "@/hooks/context/DojoContext";
import { useTravel } from "@/hooks/helpers/useTravel";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useMarketStore from "@/hooks/store/useMarketStore";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import TextInput from "@/ui/elements/TextInput";
import { currencyFormat, divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import {
  EternumGlobalConfig,
  MarketInterface,
  ONE_MONTH,
  Resources,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { getTotalResourceWeight } from "../cityview/realm/trade/utils";
import { useProductionManager } from "@/hooks/helpers/useResources";
import { Headline } from "@/ui/elements/Headline";

export const MarketResource = ({
  entityId,
  resource,
  active,
  onClick,
  askPrice,
  bidPrice,
  depth,
}: {
  entityId: bigint;
  resource: Resources;
  active: boolean;
  onClick: (value: number) => void;
  askPrice: string;
  bidPrice: string;
  depth: number;
}) => {
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
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
      className={`w-full border border-gold/5 h-8 p-1 cursor-pointer flex gap-1 hover:bg-gold/10  hover:clip-angled-sm clip-angled-sm group ${
        active ? "bg-gold/10  " : ""
      }`}
    >
      <ResourceIcon size="sm" resource={resource.trait} withTooltip={false} />
      <div className="truncate text-xs self-center">{resource.trait}</div>

      <div className="text-xs text-gold/70 group-hover:text-green self-center">
        [{currencyFormat(balance ? Number(balance) : 0, 0)}]
      </div>

      <div className="ml-auto flex gap-6 w-3/6 justify-between font-bold">
        <div className="text-red w-5/12">{bidPrice}</div>
        <div className="text-green text-left  w-5/12">{askPrice}</div>
        <div className="text-blueish  w-2/12">{depth}</div>
      </div>
    </div>
  );
};

export const MarketOrderPanel = ({
  resourceId,
  entityId,
  resourceAskOffers,
  resourceBidOffers,
}: {
  resourceId: number;
  entityId: bigint;
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

export const MarketOrders = ({
  resourceId,
  entityId,
  isBuy = false,
  offers,
}: {
  resourceId: number;
  entityId: bigint;
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
        className={`text-xl flex clip-angled-sm font-bold  justify-between p-1 px-8 border-gold/10 border ${
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

      <div className="p-1 bg-white/5  flex-col flex gap-1 clip-angled-sm flex-grow border-gold/10 border">
        <OrderRowHeader isBuy={isBuy} resourceId={resourceId} />

        <div className="flex-col flex gap-1 flex-grow overflow-y-auto">
          {offers.map((offer, index) => (
            <OrderRow key={index} offer={offer} entityId={entityId} isBuy={isBuy} />
          ))}
        </div>
      </div>

      <OrderCreation initialBid={lowestPrice} resourceId={resourceId} entityId={entityId} isBuy={isBuy} />
    </div>
  );
};

export const OrderRowHeader = ({ isBuy, resourceId }: { isBuy: boolean; resourceId: number }) => {
  return (
    <div className="grid grid-cols-5 gap-2 p-2 uppercase text-xs font-bold ">
      <div>qty.</div>
      <div>dist.</div>
      <div className="flex">
        <ResourceIcon size="xs" resource={"Lords"} />
        per/
        <ResourceIcon size="xs" resource={findResourceById(resourceId)?.trait || ""} />
      </div>
      <div className="flex">cost</div>
      <div className="ml-auto">Action</div>
    </div>
  );
};

export const OrderRow = ({ offer, entityId, isBuy }: { offer: MarketInterface; entityId: bigint; isBuy: boolean }) => {
  const { computeTravelTime } = useTravel();
  const {
    account: { account },
    setup: {
      systemCalls: { cancel_order, accept_order },
    },
  } = useDojo();

  // TODO: Do we need this?
  const deleteTrade = useMarketStore((state) => state.deleteTrade);

  // TODO Distance
  const travelTime = useMemo(
    () => computeTravelTime(entityId, offer.makerId, EternumGlobalConfig.speed.donkey),
    [entityId, offer],
  );

  const returnResources = useMemo(() => {
    return isBuy
      ? [ResourcesIds.Lords, offer.takerGets[0].amount]
      : [offer.takerGets[0].resourceId, offer.takerGets[0].amount];
  }, []);

  const [loading, setLoading] = useState(false);

  const onAccept = async () => {
    setLoading(true);
    await accept_order({
      signer: account,
      taker_id: entityId,
      trade_id: offer.tradeId,
      maker_gives_resources: [offer.takerGets[0].resourceId, offer.takerGets[0].amount],
      taker_gives_resources: [offer.makerGets[0].resourceId, offer.makerGets[0].amount],
    })
      .then(() => {
        deleteTrade(offer.tradeId);
      })
      .catch((error) => {
        // Add failure indicator in UI
        console.error("Failed to accept order", error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const isSelf = useMemo(() => {
    return entityId === offer.makerId;
  }, [entityId, offer.makerId, offer.tradeId]);

  const getsDisplay = useMemo(() => {
    return isBuy ? currencyFormat(offer.makerGets[0].amount, 0) : currencyFormat(offer.takerGets[0].amount, 0);
  }, [entityId, offer.makerId, offer.tradeId]);

  const getDisplayResource = useMemo(() => {
    return isBuy ? offer.makerGets[0].resourceId : offer.takerGets[0].resourceId;
  }, [entityId, offer.makerId, offer.tradeId]);

  const getTotalLords = useMemo(() => {
    return isBuy ? offer.takerGets[0].amount : offer.makerGets[0].amount;
  }, [entityId, offer.makerId, offer.tradeId]);

  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
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
    return Math.ceil(divideByPrecision(orderWeight) / EternumGlobalConfig.carryCapacity.donkey);
  }, [orderWeight]);

  const donkeyProductionManager = useProductionManager(entityId, ResourcesIds.Donkey);

  const donkeyProduction = useMemo(() => {
    return donkeyProductionManager.getProduction();
  }, []);

  const donkeyBalance = useMemo(() => {
    return donkeyProductionManager.balance(currentDefaultTick);
  }, [donkeyProductionManager, donkeyProduction, currentDefaultTick]);

  const enoughDonkeys = useMemo(() => {
    return donkeyBalance > donkeysNeeded;
  }, [donkeyBalance, donkeysNeeded]);

  const canAccept = useMemo(() => {
    return (isBuy ? offer.takerGets[0].amount < balance : offer.makerGets[0].amount < balance) && enoughDonkeys;
  }, [productionManager, production, currentDefaultTick, entityId, offer.makerId, offer.tradeId, enoughDonkeys]);

  return (
    <div
      key={offer.tradeId}
      className={`flex flex-col p-1  px-2 clip-angled-sm hover:bg-white/15 duration-150 border-gold/10 border  text-xs ${
        isSelf ? "bg-blueish/10" : "bg-white/10"
      }`}
    >
      <div className="grid grid-cols-5 gap-2">
        <div className={`flex gap-1 font-bold ${isBuy ? "text-red" : "text-green"} `}>
          {!enoughDonkeys && (
            <div className="bg-red rounded-full animate-pulse">
              <ResourceIcon withTooltip={false} size="xs" resource={"Donkeys"} />
            </div>
          )}
          <ResourceIcon withTooltip={false} size="xs" resource={findResourceById(getDisplayResource)?.trait || ""} />{" "}
          {getsDisplay}
        </div>
        <div>{travelTime}hrs</div>
        <div className="flex gap-1">{offer.perLords.toFixed(2)}</div>
        <div className={`flex gap-1 font-bold ${isBuy ? "text-green" : "text-red"}`}>
          <ResourceIcon withTooltip={false} size="xs" resource={"Lords"} />
          {currencyFormat(getTotalLords, 0)}
        </div>
        {!isSelf ? (
          canAccept ? (
            <Button isLoading={loading} onClick={onAccept} size="xs" className="self-center flex flex-grow">
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
      </div>
    </div>
  );
};

export const OrderCreation = ({
  initialBid,
  entityId,
  resourceId,
  isBuy = false,
}: {
  initialBid: number;
  entityId: bigint;
  resourceId: number;
  isBuy?: boolean;
}) => {
  const [loading, setLoading] = useState(false);
  const [resource, setResource] = useState(1000);
  const [lords, setLords] = useState(100);
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
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
      { resourceId: isBuy ? resourceId : ResourcesIds.Lords, amount: resource },
    ]);
    return multiplyByPrecision(totalWeight);
  }, [resource, lords]);

  const donkeysNeeded = useMemo(() => {
    return Math.ceil(divideByPrecision(orderWeight) / EternumGlobalConfig.carryCapacity.donkey);
  }, [orderWeight]);

  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
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
    <div className="flex justify-between p-4 text-xl flex-wrap mt-auto clip-angled-sm bg-gold/5 border-gold/10 border">
      <div className="flex w-full gap-8">
        <div className="w-1/3 gap-1 flex flex-col">
          <div className="uppercase text-sm flex gap-2 font-bold">
            <ResourceIcon withTooltip={false} size="xs" resource={findResourceById(resourceId)?.trait || ""} />{" "}
            {isBuy ? "Buy" : "Sell"}
          </div>
          {/* {!isBuy ? ( */}
          <TextInput value={resource.toString()} onChange={(value) => setResource(Number(value))} />
          {/* // ) : (
          //   <TextInput value={lords.toString()} onChange={(value) => setLords(Number(value))} />
          // )} */}

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
          {/* {!isBuy ? ( */}
          <TextInput value={lords.toString()} onChange={(value) => setLords(Number(value))} />
          {/* // ) : (
          //   <TextInput value={resource.toString()} onChange={(value) => setResource(Number(value))} />
          // )} */}

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
          className="mt-4"
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
