import clsx from "clsx";
import { HTMLAttributes } from "react";

type KbdVariant = "default" | "modifier" | "accent";

interface KbdKeyProps extends HTMLAttributes<HTMLElement> {
  variant?: KbdVariant;
  size?: "xs" | "sm" | "md";
}

const baseClass = "inline-flex items-center justify-center rounded border font-medium uppercase";

const variantClassMap: Record<KbdVariant, string> = {
  default: "bg-gold/20 border-gold text-gold",
  modifier: "bg-brown/20 border-gold/20 text-gold/90",
  accent: "bg-gold text-brown border-transparent",
};

const sizeClassMap = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-1 text-xxs",
  md: "px-2.5 py-1.5 text-xs",
};

export const KbdKey = ({
  children,
  className,
  variant = "modifier",
  size = "sm",
  ...props
}: KbdKeyProps) => (
  <kbd className={clsx(baseClass, variantClassMap[variant], sizeClassMap[size], className)} {...props}>
    {children}
  </kbd>
);

export default KbdKey;
