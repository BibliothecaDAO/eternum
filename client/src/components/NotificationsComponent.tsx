import React from "react";
import { Notification } from "../elements/Notification";
import { ReactComponent as Checkmark } from "../assets/icons/common/checkmark.svg";
import { ReactComponent as CrossIcon } from "../assets/icons/common/cross.svg";
import { ReactComponent as DonkeyIcon } from "../assets/icons/units/donkey.svg";
import { OrderIcon } from "../elements/OrderIcon";
import clsx from "clsx";
import { Badge } from "../elements/Badge";

type NotificationsComponentProps = {
  className?: string;
} & React.ComponentPropsWithRef<"div">;

export const NotificationsComponent = ({
  className,
}: NotificationsComponentProps) => (
  <div className={clsx("flex flex-col space-y-2", className)}>
    <Notification type="primary" time="13:37" onClose={() => {}}>
      <div className="flex items-center">
        <Badge size="lg" type="primary" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          Order Accepted
        </Badge>
        <div className="flex items-center">
          by <OrderIcon size="xs" className="mx-2" order="brilliance" />{" "}
          <div className="inline-block text-gold">Stolsi</div>
        </div>
      </div>
      <div className="mt-2 items-center italic">
        Caravan arives in{" "}
        <div className="text-bold inline-block text-white">1h:12m</div> with{" "}
        <div className="text-gold inline-block">10'000'000</div> resources.
      </div>
    </Notification>
    <Notification type="danger" time="13:38" onClose={() => {}}>
      <div className="flex items-center">
        <Badge size="lg" type="danger" className="mr-2">
          <CrossIcon className="fill-current mr-1" />
          Error 404
        </Badge>
      </div>
      <div className="mt-2 items-center italic">
        <div className="inline-block text-order-giants">
          Internet Connection interrupted.
        </div>{" "}
        Please refresh the page or try again later.
      </div>
    </Notification>
    <Notification type="success" time="13:38" onClose={() => {}}>
      <div className="flex items-center">
        <Badge size="lg" type="success" className="mr-2">
          <DonkeyIcon className="fill-current w-3 h-3 mr-1" />
          Caravan Arrived
        </Badge>
        <div className="flex items-center">
          from <OrderIcon size="xs" className="mx-2" order="brilliance" />{" "}
          <div className="inline-block text-gold">Stolsi</div>
        </div>
      </div>
      <div className="mt-2 items-center italic">
        You received{" "}
        <div className="text-brilliance inline-block">10'000'000</div>{" "}
        Resources.
      </div>
    </Notification>
  </div>
);
