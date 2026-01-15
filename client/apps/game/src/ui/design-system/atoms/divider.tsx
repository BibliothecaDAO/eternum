import clsx from "clsx";
import { HTMLAttributes } from "react";

interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  spacing?: "none" | "xs" | "sm" | "md" | "lg";
  tint?: "subtle" | "strong";
  orientation?: "horizontal" | "vertical";
}

const spacingClassMap = {
  none: "",
  xs: "my-1",
  sm: "my-2",
  md: "my-4",
  lg: "my-6",
};

const tintClassMap = {
  subtle: "border-gold/20",
  strong: "border-gold/40",
};

export const Divider = ({
  spacing = "md",
  tint = "subtle",
  orientation = "horizontal",
  className,
  ...props
}: DividerProps) => (
  <div
    className={clsx(
      orientation === "horizontal" ? "border-b" : "border-l h-full",
      tintClassMap[tint],
      spacingClassMap[spacing],
      className,
    )}
    {...props}
  />
);

export default Divider;
