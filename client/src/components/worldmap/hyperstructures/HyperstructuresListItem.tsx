import { OrderIcon } from "../../../elements/OrderIcon";
import Button from "../../../elements/Button";
import { ReactComponent as Map } from "../../../assets/icons/common/map.svg";
import { orderNameDict, orders } from "../../../constants/orders";
import useUIStore from "../../../hooks/store/useUIStore";
import ProgressBar from "../../../elements/ProgressBar";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import clsx from "clsx";

type HyperstructuresListItemProps = {
  order: number;
  coords: { x: number; y: number };
  onFeed?: () => void;
};

export const HyperstructuresListItem = ({ order, coords, onFeed = undefined }: HyperstructuresListItemProps) => {
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);

  const { getHyperstructure } = useHyperstructure();

  const hyperstructure = getHyperstructure(order, coords);

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center">
        <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
          {<OrderIcon order={orderNameDict[order + 1]} size="xs" className="mr-1" />}
          {orders[order].fullOrderName}
        </div>

        <div className=" text-gold flex ml-auto ">
          <Button
            onClick={() =>
              moveCameraToTarget({
                x: coords.x,
                y: 0.528415243525413,
                z: coords.y,
              })
            }
            variant="outline"
            className="p-1 !h-4 text-xxs !rounded-md"
          >
            <Map className="mr-1 fill-current" />
            Show on map
          </Button>
        </div>
      </div>
      <div className="flex flex-col w-full mt-3">
        <ProgressBar rounded progress={hyperstructure?.progress || 0} className="bg-white" />
        <div className="flex items-center mt-2">
          <div
            className={clsx(
              "ml-1 italic ",
              !hyperstructure?.initialized && "text-white/70",
              hyperstructure?.completed && "text-order-brilliance",
              hyperstructure && hyperstructure?.progress >= 0 && !hyperstructure?.completed ? "text-gold" : "",
            )}
          >
            {hyperstructure?.completed
              ? "Completed"
              : hyperstructure?.initialized
              ? `Building in progress ${hyperstructure?.progress}%`
              : "Not initialized"}
          </div>

          {onFeed && (
            <Button className="!px-[6px] !py-[2px] text-xxs ml-auto" variant="outline" onClick={onFeed}>
              Manage
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
