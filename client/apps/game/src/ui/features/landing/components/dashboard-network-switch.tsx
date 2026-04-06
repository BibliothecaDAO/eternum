import { env } from "../../../../../env";
import { resolveChain, setSelectedChain } from "@/runtime/world";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { useCallback, useMemo } from "react";

import {
  getChainLabel,
  resolveConnectedTxChainFromRuntime,
  switchWalletToChain,
  type WalletChainControllerLike,
} from "@/ui/utils/network-switch";

const DASHBOARD_CHAIN_OPTIONS: Chain[] = ["slot", "mainnet"];

const resolvePreferredDashboardChain = (chain: Chain): Chain => {
  return chain === "mainnet" ? "mainnet" : "slot";
};

const resolveIndicatorTone = ({
  preferredChain,
  connectedTxChain,
  hasConnectedWallet,
}: {
  preferredChain: Chain;
  connectedTxChain: Chain | null;
  hasConnectedWallet: boolean;
}) => {
  if (!hasConnectedWallet) {
    return "bg-white/40";
  }

  return connectedTxChain === preferredChain
    ? "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.45)]"
    : "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.4)]";
};

export const DashboardNetworkSwitch = ({ className }: { className?: string }) => {
  const preferredChain = resolvePreferredDashboardChain(resolveChain(env.VITE_PUBLIC_CHAIN as Chain));
  const { address, chainId, connector } = useAccount();
  const controller = (connector as { controller?: WalletChainControllerLike } | undefined)?.controller;
  const connectedTxChain = useMemo(
    () => resolveConnectedTxChainFromRuntime({ chainId, controller }),
    [chainId, controller],
  );
  const indicatorTone = useMemo(
    () =>
      resolveIndicatorTone({
        preferredChain,
        connectedTxChain,
        hasConnectedWallet: Boolean(address),
      }),
    [address, connectedTxChain, preferredChain],
  );

  const handleSelectChain = useCallback(
    (nextChain: Chain) => {
      if (nextChain === preferredChain) {
        return;
      }

      setSelectedChain(nextChain);

      if (!address) {
        return;
      }

      void switchWalletToChain({
        controller,
        targetChain: nextChain,
      });
    },
    [address, controller, preferredChain],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl border border-gold/20 bg-black/35 px-1.5 py-1 text-gold backdrop-blur-md",
        className,
      )}
      title={`Preferred network: ${getChainLabel(preferredChain)}`}
    >
      <div className="flex items-center gap-1 px-1.5">
        <span className={cn("h-2 w-2 rounded-full border border-black/20", indicatorTone)} />
        <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-gold/55">Net</span>
      </div>
      <div className="flex items-center gap-1">
        {DASHBOARD_CHAIN_OPTIONS.map((chain) => {
          const isSelected = preferredChain === chain;

          return (
            <button
              key={chain}
              type="button"
              onClick={() => handleSelectChain(chain)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                isSelected
                  ? "bg-gold/18 text-gold shadow-[inset_0_0_0_1px_rgba(223,170,84,0.18)]"
                  : "text-gold/55 hover:bg-gold/8 hover:text-gold",
              )}
              aria-pressed={isSelected}
            >
              {getChainLabel(chain)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
