import clsx from "clsx";
import React from "react";

type SortPanelProps = {
  children?: React.ReactNode;
} & React.ComponentPropsWithRef<"div">;

export const SortPanel = ({ children, className }: SortPanelProps) => {
  return <div className={clsx("flex flex-wrap border-b border-gray-gold", className)}>{children}</div>;
};
