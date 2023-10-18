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
import { Resource } from "../../../../types";
import { HyperStructureInterface, useHyperstructure } from "../../../../hooks/helpers/useHyperstructure";
import useUIStore from "../../../../hooks/store/useUIStore";

type CaravanProps = {
  caravan: CaravanInterface;
  hyperstructureData: HyperStructureInterface;
  idleOnly?: boolean;
  selectedCaravan?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const HyperStructureCaravan = ({ caravan, hyperstructureData, ...props }: CaravanProps) => {
  const { isMine, owner, arrivalTime, capacity } = caravan;
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const hyperstructures = useUIStore((state) => state.hyperstructures);
  const setHyperstructures = useUIStore((state) => state.setHyperstructures);
  const { getHyperstructure } = useHyperstructure();

  const [isLoading, setIsLoading] = useState(false);
  const hasArrived = arrivalTime !== undefined && nextBlockTimestamp !== undefined && arrivalTime <= nextBlockTimestamp;
  const isInitialized = hyperstructureData.initialized;

  const {
    account: { account },
    setup: {
      systemCalls: { initialize_hyperstructure_and_travel_back, feed_hyperstructure_and_travel_back },
      components: { Resource, CaravanMembers, HomePosition, ForeignKey },
    },
  } = useDojo();

  const returnPosition = useMemo(() => {
    const caravanMembers = getComponentValue(CaravanMembers, getEntityIdFromKeys([BigInt(caravan.caravanId)]));
    if (caravanMembers && caravanMembers.count > 0) {
      let entity_id = getEntityIdFromKeys([BigInt(caravan.caravanId), BigInt(caravanMembers.key), BigInt(0)]);
      let foreignKey = getComponentValue(ForeignKey, entity_id);
      if (foreignKey) {
        // @note: temp fix until we don't use entity_id as field name in foreign key
        let homePosition = getComponentValue(HomePosition, getEntityIdFromKeys([BigInt(caravan.caravanId - 2)]));
        // let homePosition = getComponentValue(HomePosition, getEntityIdFromKeys([BigInt(foreignKey.entity_id)]));
        return homePosition;
      }
    }
  }, [caravan]);

  const transferAndReturn = async () => {
    if (isInitialized) {
      await feed_hyperstructure_and_travel_back({
        signer: account,
        entity_id: caravan.caravanId,
        hyperstructure_id: hyperstructureData.hyperstructureId,
        resources: resources.flatMap((resource) => Object.values(resource)),
        destination_coord_x: returnPosition?.x || 0,
        destination_coord_y: returnPosition?.y || 0,
      });
    } else {
      await initialize_hyperstructure_and_travel_back({
        signer: account,
        entity_id: caravan.caravanId,
        hyperstructure_id: hyperstructureData.hyperstructureId,
        destination_coord_x: returnPosition?.x || 0,
        destination_coord_y: returnPosition?.y || 0,
      });
    }
  };

  const updateHyperStructure = () => {
    const newHyperstructure = getHyperstructure(hyperstructureData.orderId, hyperstructureData.uiPosition);
    hyperstructures[hyperstructureData.orderId - 1] = newHyperstructure;
    setHyperstructures([...hyperstructures]);
  };

  const onClick = async () => {
    setIsLoading(true);
    await transferAndReturn();
    updateHyperStructure();
    setIsLoading(false);
  };

  const resources = useMemo(() => {
    return Array(22)
      .fill(0)
      .map((_, i: number) => {
        const resource = getComponentValue(Resource, getEntityIdFromKeys([BigInt(caravan.caravanId), BigInt(i + 1)]));
        if (resource && resource.balance > 0) {
          return {
            resourceId: i + 1,
            amount: resource?.balance,
          };
        }
      })
      .filter(Boolean) as Resource[];
  }, [caravan]);

  // capacity
  let resourceWeight = useMemo(() => {
    return getTotalResourceWeight([...resources]);
  }, [resources]);

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
          {resources &&
            resources.map(
              (resource) =>
                resource && (
                  <ResourceCost
                    key={resource.resourceId}
                    className="!text-gold !w-5 mt-0.5"
                    type="vertical"
                    resourceId={resource.resourceId}
                    amount={resource.amount}
                  />
                ),
            )}
        </div>
        {!isLoading && isMine && (
          <Button
            onClick={onClick}
            disabled={!hasArrived}
            variant={hasArrived ? "success" : "danger"}
            className="ml-auto mt-auto p-2 !h-4 text-xxs !rounded-md"
          >
            {hasArrived ? (isInitialized ? `Transfer And Return` : `Initialize And Return`) : "On the way"}
          </Button>
        )}
        {isLoading && isMine && (
          <Button
            isLoading={true}
            onClick={() => {}}
            variant="danger"
            className="ml-auto mt-auto p-2 !h-4 text-xxs !rounded-md"
          >
            {}
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
