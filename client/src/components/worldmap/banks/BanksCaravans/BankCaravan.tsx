import React, { useMemo, useState } from "react";
import clsx from "clsx";
import { CaravanInterface } from "../../../../hooks/graphql/useGraphQLQueries";
import { ReactComponent as Pen } from "../../../../assets/icons/common/pen.svg";
import { ReactComponent as CaretDownFill } from "../../../../assets/icons/common/caret-down-fill.svg";
import { ReactComponent as DonkeyIcon } from "../../../../assets/icons/units/donkey-circle.svg";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { getTotalResourceWeight } from "../../../cityview/realm/trade/TradeUtils";
import { displayAddress, divideByPrecision, getEntityIdFromKeys, numberToHex } from "../../../../utils/utils";
import { formatSecondsInHoursMinutes } from "../../../cityview/realm/labor/laborUtils";
import { ResourceCost } from "../../../../elements/ResourceCost";
import ProgressBar from "../../../../elements/ProgressBar";
import { Dot } from "../../../../elements/Dot";
import { CAPACITY_PER_DONKEY } from "@bibliothecadao/eternum";
import { getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../../../DojoContext";
import Button from "../../../../elements/Button";
import { BANK_AUCTION_DECAY, BankInterface, targetPrices } from "../../../../hooks/helpers/useBanks";
import { useResources } from "../../../../hooks/helpers/useResources";
import { getLordsAmountFromBankAuction } from "../utils";

type BankCaravanProps = {
  caravan: CaravanInterface;
  bank: BankInterface;
  idleOnly?: boolean;
  selectedCaravan?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const BankCaravan = ({ caravan, bank, ...props }: BankCaravanProps) => {
  const { isMine, owner, arrivalTime, capacity } = caravan;
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const [isLoading, setIsLoading] = useState(false);
  const hasArrived = arrivalTime !== undefined && nextBlockTimestamp !== undefined && arrivalTime <= nextBlockTimestamp;

  const {
    account: { account },
    setup: {
      systemCalls: { swap_bank_and_travel_back },
      components: { CaravanMembers, EntityOwner, ForeignKey, Position },
    },
  } = useDojo();

  const { getResourcesFromInventory } = useResources();

  const returnPosition = useMemo(() => {
    const caravanMembers = getComponentValue(CaravanMembers, getEntityIdFromKeys([BigInt(caravan.caravanId)]));
    if (caravanMembers && caravanMembers.count > 0) {
      let entity_id = getEntityIdFromKeys([BigInt(caravan.caravanId), BigInt(caravanMembers.key), BigInt(0)]);
      let foreignKey = getComponentValue(ForeignKey, entity_id);
      if (foreignKey) {
        // @note: temp fix until we don't use entity_id as field name in foreign key
        let ownerRealmEntityId = getComponentValue(EntityOwner, getEntityIdFromKeys([BigInt(caravan.caravanId - 2)]));
        let homePosition = ownerRealmEntityId
          ? getComponentValue(Position, getEntityIdFromKeys([BigInt(ownerRealmEntityId.entity_owner_id)]))
          : undefined;
        return homePosition;
      }
    }
  }, [caravan]);

  const resourcesGive = getResourcesFromInventory(caravan.caravanId);

  const lordsAmountFromWheat = useMemo(() => {
    return bank.wheatLaborAuction && nextBlockTimestamp
      ? getLordsAmountFromBankAuction(
          resourcesGive.resources.find((resource) => {
            return resource.resourceId === 254;
          })?.amount || 0,
          targetPrices[254],
          BANK_AUCTION_DECAY,
          bank.wheatLaborAuction.per_time_unit,
          bank.wheatLaborAuction.start_time,
          nextBlockTimestamp,
          bank.wheatLaborAuction.sold,
          bank.wheatLaborAuction.price_update_interval,
        )
      : 0;
  }, [resourcesGive, bank]);

  const lordsAmountFromFish = useMemo(() => {
    return bank.fishLaborAuction && nextBlockTimestamp
      ? getLordsAmountFromBankAuction(
          resourcesGive.resources.find((resource) => {
            return resource.resourceId === 255;
          })?.amount || 0,
          targetPrices[255],
          BANK_AUCTION_DECAY,
          bank.fishLaborAuction.per_time_unit,
          bank.fishLaborAuction.start_time,
          nextBlockTimestamp,
          bank.fishLaborAuction.sold,
          bank.fishLaborAuction.price_update_interval,
        )
      : 0;
  }, [resourcesGive, bank]);

  const [resource_types, indices, resource_amounts] = useMemo(() => {
    if (lordsAmountFromWheat > 0 && lordsAmountFromFish > 0) {
      return [
        [253, 253],
        [0, 1],
        [lordsAmountFromWheat, lordsAmountFromFish],
      ];
    } else {
      if (lordsAmountFromWheat > 0 && lordsAmountFromFish === 0) {
        return [[253], [0], [lordsAmountFromWheat]];
      } else if (lordsAmountFromWheat === 0 && lordsAmountFromFish > 0) {
        return [[253], [1], [lordsAmountFromFish]];
      } else {
        return [[], [], []];
      }
    }
  }, [lordsAmountFromFish, lordsAmountFromWheat]);

  const transferAndReturn = async () => {
    await swap_bank_and_travel_back({
      signer: account,
      sender_id: caravan.caravanId,
      bank_id: bank.bankId,
      inventoryIndex: 0,
      resource_types,
      indices,
      // lords amount
      resource_amounts: resource_amounts.map((amount) => Math.floor(amount * 1000)),
      destination_coord_x: returnPosition?.x || 0,
      destination_coord_y: returnPosition?.y || 0,
    });
  };

  const onClick = async () => {
    setIsLoading(true);
    await transferAndReturn();
    setIsLoading(false);
  };

  // capacity
  let resourceWeight = useMemo(() => {
    return getTotalResourceWeight([...resourcesGive.resources]);
  }, [resourcesGive]);

  return (
    <div
      className={clsx("flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold", props.className)}
    >
      <div className="flex items-center text-xxs">
        <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
          {isMine ? "You" : displayAddress(owner || numberToHex(0))}
        </div>
        <div className="flex items-center ml-1 -mt-2">
          {capacity && resourceWeight !== undefined && capacity && (
            <div className="flex items-center ml-1 text-gold">
              {divideByPrecision(resourceWeight)}
              <div className="mx-0.5 italic text-light-pink">/</div>
              {`${capacity / 1000} kg`}
              <CaretDownFill className="ml-1 fill-current" />
            </div>
          )}
        </div>
        {hasArrived && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Has Arrived
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {arrivalTime && !hasArrived && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsInHoursMinutes(arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex mt-1">
        <div className="flex justify-center items-center space-x-2 flex-wrap mt-2">
          {resourcesGive &&
            resourcesGive.resources.map(
              (resource) =>
                resource && (
                  <ResourceCost
                    key={resource.resourceId}
                    className="!text-gold !w-5 mt-0.5 mr-1"
                    type="vertical"
                    resourceId={resource.resourceId}
                    amount={divideByPrecision(resource.amount)}
                  />
                ),
            )}
        </div>
        {caravan.isMine && (
          <div className="flex ml-auto justify-end items-center space-x-2 flex-wrap mt-2">
            <div className="flex flex-row">
              <div className="flex flex-col">
                {
                  <ResourceCost
                    type="vertical"
                    color="text-order-brilliance"
                    className="!w-5 mt-0.5"
                    resourceId={253}
                    amount={lordsAmountFromWheat + lordsAmountFromFish}
                  />
                }
              </div>
            </div>
          </div>
        )}
        {isMine && (
          <Button
            onClick={onClick}
            isLoading={isLoading}
            disabled={!hasArrived}
            variant={hasArrived ? "success" : "danger"}
            className="ml-auto mt-auto p-2 !h-4 text-xxs !rounded-md"
          >
            {hasArrived ? `Swap And Return` : "On the way"}
          </Button>
        )}
      </div>
      <div className="flex mt-2">
        <div className="grid w-full grid-cols-1 gap-5">
          <div className="flex flex-col">
            <div className="grid grid-cols-12 gap-0.5">
              <ProgressBar containerClassName="col-span-12" rounded progress={100} />
            </div>
            <div className="flex items-center justify-between mt-[6px] text-xxs">
              <DonkeyIcon />
              <div className="flex items-center space-x-[6px]">
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-green" />
                  <div className="mt-1 text-green">{(capacity || 0) / CAPACITY_PER_DONKEY}</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-yellow" />
                  <div className="mt-1 text-dark">{0}</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-orange" />
                  <div className="mt-1 text-orange">{0}</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-red" />
                  <div className="mt-1 text-red">{0}</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-light-pink" />
                  <div className="mt-1 text-dark">{0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
