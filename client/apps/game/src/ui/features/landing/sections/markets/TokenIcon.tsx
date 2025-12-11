import React, { useMemo, useState } from "react";

import type { RegisteredToken } from "@pm/sdk";

import { cn } from "@/ui/design-system/atoms/lib/utils";

type TokenLike = Pick<RegisteredToken, "symbol"> | RegisteredToken | { symbol?: string };

export function TokenIcon({
  token,
  className,
  ...props
}: { token?: TokenLike } & React.ComponentProps<"span">) {
  const [broken, setBroken] = useState(false);
  const symbol = token?.symbol ?? "TKN";
  const imageSrc = useMemo(() => {
    if (!symbol) return null;
    return `/tokens/${symbol.toLowerCase()}.png`;
  }, [symbol]);

  return (
    <span
      title={symbol}
      className={cn("inline-flex h-6 w-6 items-center justify-center", className)}
      {...props}
    >
      {!broken && imageSrc ? (
        <img
          src={imageSrc}
          alt={symbol}
          className="h-6 w-6 rounded-full"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] uppercase text-white">
          {symbol.slice(0, 3)}
        </span>
      )}
    </span>
  );
}
