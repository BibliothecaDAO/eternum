import { useEffect, useState } from "react";
import { Notification } from "../elements/Notification";
import { ReactComponent as Checkmark } from "../assets/icons/common/checkmark.svg";
import { ReactComponent as CrossIcon } from "../assets/icons/common/cross.svg";
import { ReactComponent as DonkeyIcon } from "../assets/icons/units/donkey.svg";
import { OrderIcon } from "../elements/OrderIcon";
import clsx from "clsx";
import { Badge } from "../elements/Badge";
import Button from "../elements/Button";

type NotificationsComponentProps = {
  className?: string;
} & React.ComponentPropsWithRef<"div">;

export const NotificationsComponent = ({
  className,
}: NotificationsComponentProps) => {
  const [notifications, setNotifications] = useState<any>([]);

  const dummyNotifications = [
    {
      id: 1,
      type: "primary",
      time: "13:37",
      title: (
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
      ),
      content: (
        <div className="mt-2 items-center italic">
          Caravan arives in{" "}
          <div className="text-bold inline-block text-white">1h:12m</div> with{" "}
          <div className="text-gold inline-block">10'000'000</div> resources.
        </div>
      ),
    },
    {
      id: 2,
      type: "danger",
      time: "13:38",
      title: (
        <div className="flex items-center">
          <Badge size="lg" type="danger" className="mr-2">
            <CrossIcon className="fill-current mr-1" />
            Error 404
          </Badge>
        </div>
      ),
      content: (
        <div className="mt-2 items-center italic">
          <div className="inline-block text-order-giants">
            Internet Connection interrupted.
          </div>{" "}
          Please refresh the page or try again later.
        </div>
      ),
    },
    {
      id: 3,
      type: "success",
      time: "13:38",
      title: (
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
      ),
      content: (
        <div className="mt-2 items-center italic">
          You received{" "}
          <div className="text-brilliance inline-block">10'000'000</div>{" "}
          Resources.
        </div>
      ),
    },
  ];

  useEffect(() => {
    setNotifications(dummyNotifications);
  }, []);

  return (
    <div
      className={clsx("flex flex-col space-y-2 absolute right-0", className)}
    >
      <Button
        variant="primary"
        onClick={() =>
          setNotifications([
            ...notifications,
            {
              ...dummyNotifications[
                Math.floor(Math.random() * dummyNotifications.length)
              ],
              id: Math.random() * 10000,
            },
          ])
        }
      >
        Add notifications
      </Button>
      {notifications.map((notification: any) => (
        <Notification
          key={notification.id}
          type={notification.type}
          time={notification.time}
          onClose={() =>
            setNotifications(
              notifications.filter((n: any) => n.id !== notification.id),
            )
          }
        >
          {notification.title}
          {notification.content}
        </Notification>
      ))}
    </div>
  );
};
