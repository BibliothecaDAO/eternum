import clsx from "clsx";
import React from "react";

type OnlineStatusProps = {
  status: "online" | "recently" | "offline";
} & React.HTMLAttributes<HTMLDivElement>;

const COLORS = {
  online: "bg-order-brilliance",
  recently: "bg-gold",
  offline: "bg-danger",
};
export const OnlineStatus = ({ status, className, ...props }: OnlineStatusProps) => (
  <div className={clsx(" w-2 h-2 rounded-full", COLORS[status], className)} {...props} />
);
