import clsx from "clsx";
import React, { ComponentPropsWithRef } from "react";

type BadgeProps = {
  children?: React.ReactNode;
  size: "sm" | "md" | "lg" | "xl";
  type?: "danger" | "success" | "primary";
  bordered?: boolean;
} & ComponentPropsWithRef<"div">;

const sizes = {
  sm: "min-w-[0.5rem] h-2 p-1",
  md: "min-w-[1rem] h-4 p-1",
  lg: "min-w-[1.25rem] h-5 p-2",
  xl: "min-w-[1.5rem] h-6 p-2",
};

const STYLES = {
  base: "flex items-center justify-center rounded-full text-black",
  bordered: "border-2 border-black",
  danger: "bg-order-giants !text-white",
  success: "bg-order-brilliance",
  primary: "bg-gold",
};
export const Badge = ({
  children,
  size,
  className,
  type = "primary",
  bordered,
}: BadgeProps) => (
  <div
    className={clsx(
      STYLES.base,
      sizes[size],
      bordered && STYLES.bordered,
      STYLES[type],
      className,
    )}
  >
    {children}
  </div>
);
