import { RegisteredToken } from "@pm/sdk";
import cn from "clsx";
import React from "react";

type TokenIconProps = {
  token: RegisteredToken;
  size?: number;
} & React.ComponentProps<"div">;

export function TokenIcon({ token, size = 24, className, style, ...props }: TokenIconProps) {
  const dimension = `${size}px`;
  const mergedStyle = {
    width: dimension,
    height: dimension,
    minWidth: dimension,
    minHeight: dimension,
    ...(style || {}),
  };

  return (
    <span
      title={token?.symbol}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={mergedStyle}
      {...props}
    >
      <img src={`/tokens/${token?.symbol.toLowerCase()}.png`} alt={token?.symbol} className="h-full w-full rounded-full object-contain" />
    </span>
  );
}
