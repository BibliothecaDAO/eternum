import clsx from "clsx";
import React, { ComponentPropsWithRef } from "react";
import { ReactComponent as CloseIcon } from "../assets/icons/common/cross-circle.svg";

type NotificationProps = {
  children?: React.ReactNode;
  time?: string;
  type?: "danger" | "success" | "primary";
  onClose?: () => void;
} & ComponentPropsWithRef<"div">;

const STYLES = {
  base: "flex flex-col w-[330px] min-h-[50px] rounded-xl relative p-2 text-light-pink bg-black border-2 text-xxs",
  danger: "border-order-giants",
  success: "border-order-brilliance",
  primary: "border-gold",
};
export const Notification = ({
  children,
  className,
  onClose,
  time,
  type = "primary",
}: NotificationProps) => (
  <div className={clsx(" p-", STYLES.base, STYLES[type], className)}>
    {onClose && (
      <CloseIcon
        className="w-4 h-4 absolute top-2 right-2 cursor-pointer fill-white opacity-30"
        onClick={onClose}
      />
    )}
    {time && (
      <div className="absolute bottom-2 right-2 fill-white opacity-30">
        {time}
      </div>
    )}
    {children}
  </div>
);
