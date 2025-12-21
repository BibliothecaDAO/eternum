import type { RegisteredToken } from "@/pm/sdk";
import cn from "clsx";
import type React from "react";

interface TokenIconProps extends React.ComponentProps<"div"> {
  token: RegisteredToken;
  size?: number;
}

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
      <img
        src={`/tokens/${token?.symbol.toLowerCase()}.png`}
        alt={token?.symbol}
        className="h-full w-full rounded-full object-contain"
      />
    </span>
  );
}
