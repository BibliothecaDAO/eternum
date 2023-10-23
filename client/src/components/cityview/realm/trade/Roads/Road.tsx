import { useMemo } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";
import { orderNameDict } from "@bibliothecadao/eternum";
import { RoadInterface } from "../../../../../hooks/helpers/useRoads";
import clsx from "clsx";

type RoadProps = {
  road: RoadInterface;
  onAddUsage: () => void;
};

export const Road = (props: RoadProps) => {
  const {
    road: { startRealmName, startRealmOrder, destinationRealmName, destinationRealmOrder, usageLeft },
    onAddUsage,
  } = props;

  const canBuild = useMemo(() => {
    return usageLeft === 0;
  }, [usageLeft]);

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center justify-between">
        {startRealmName && (
          <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            {/* // order of the order maker */}
            {startRealmOrder && <OrderIcon order={orderNameDict[startRealmOrder]} size="xs" className="mr-1" />}
            {startRealmName}
          </div>
        )}
        <div className="-mt-2 text-gold">Usages left: {usageLeft}</div>
      </div>
      <div className="flex items-center text-gold pt-2">
        {destinationRealmName && (
          <>
            Road to{" "}
            {destinationRealmOrder && (
              <OrderIcon order={orderNameDict[destinationRealmOrder]} size="xs" className="mx-1" />
            )}
            {destinationRealmName}
          </>
        )}
        <div className="flex flex-col items-end ml-auto">
          <Button
            onClick={onAddUsage}
            disabled={!canBuild}
            variant={!canBuild ? "danger" : "success"}
            className={clsx("ml-auto p-2 !h-4 text-xxs !rounded-md", !canBuild && "mb-0.5")}
          >{`Add Usage`}</Button>
          {!canBuild && (
            <div className="text-xxs text-order-giants/70 w-min whitespace-nowrap">Can only add when usage is 0</div>
          )}
        </div>
      </div>
    </div>
  );
};
