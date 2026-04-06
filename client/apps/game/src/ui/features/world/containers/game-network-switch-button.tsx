import { env } from "../../../../../env";
import { resolveChain } from "@/runtime/world";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { useCallback, useMemo } from "react";

import {
  getChainLabel,
  resolveConnectedTxChainFromRuntime,
  switchWalletToChain,
  type WalletChainControllerLike,
} from "@/ui/utils/network-switch";

type GameNetworkSwitchPresentation = {
  buttonLabel: string;
  helperLabel: string;
  indicatorClassName: string;
};

const resolveGameNetworkSwitchPresentation = ({
  activeChain,
  connectedTxChain,
  hasConnectedWallet,
}: {
  activeChain: Chain;
  connectedTxChain: Chain | null;
  hasConnectedWallet: boolean;
}): GameNetworkSwitchPresentation => {
  const activeChainLabel = getChainLabel(activeChain);

  if (!hasConnectedWallet) {
    return {
      buttonLabel: activeChainLabel,
      helperLabel: "Connect wallet to switch",
      indicatorClassName: "bg-white/40",
    };
  }

  if (connectedTxChain === activeChain) {
    return {
      buttonLabel: activeChainLabel,
      helperLabel: "Wallet ready",
      indicatorClassName: "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.45)]",
    };
  }

  return {
    buttonLabel: `Switch to ${activeChainLabel}`,
    helperLabel: connectedTxChain ? `Wallet on ${getChainLabel(connectedTxChain)}` : "Wallet network unknown",
    indicatorClassName: "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.4)]",
  };
};

export const GameNetworkSwitchButton = () => {
  const activeChain = resolveChain(env.VITE_PUBLIC_CHAIN as Chain);
  const { address, chainId, connector } = useAccount();
  const controller = (connector as { controller?: WalletChainControllerLike } | undefined)?.controller;
  const connectedTxChain = useMemo(
    () => resolveConnectedTxChainFromRuntime({ chainId, controller }),
    [chainId, controller],
  );
  const presentation = useMemo(
    () =>
      resolveGameNetworkSwitchPresentation({
        activeChain,
        connectedTxChain,
        hasConnectedWallet: Boolean(address),
      }),
    [activeChain, address, connectedTxChain],
  );
  const canSwitchWalletNetwork = Boolean(address) && connectedTxChain !== activeChain;

  const handleSwitchNetwork = useCallback(() => {
    if (!canSwitchWalletNetwork) {
      return;
    }

    void switchWalletToChain({
      controller,
      targetChain: activeChain,
    });
  }, [activeChain, canSwitchWalletNetwork, controller]);

  return (
    <button
      type="button"
      onClick={handleSwitchNetwork}
      disabled={!canSwitchWalletNetwork}
      className="group flex min-w-[132px] shrink-0 items-center gap-2 rounded-xl border border-gold/35 bg-dark-wood/95 px-3 py-2 text-left text-gold shadow-2xl transition-all duration-150 enabled:hover:border-gold enabled:hover:bg-gold/10 disabled:cursor-default disabled:opacity-95"
      title={
        canSwitchWalletNetwork
          ? `Switch wallet to ${getChainLabel(activeChain)}`
          : address
            ? `Wallet already on ${getChainLabel(activeChain)}`
            : `Connect wallet to switch to ${getChainLabel(activeChain)}`
      }
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full border border-black/20 ${presentation.indicatorClassName}`} />
      <span className="flex min-w-0 flex-col">
        <span className="text-[9px] uppercase tracking-[0.18em] text-gold/55">Network</span>
        <span className="truncate text-[11px] font-semibold leading-tight text-gold group-hover:text-white">
          {presentation.buttonLabel}
        </span>
        <span className="truncate text-[10px] leading-tight text-gold/60">{presentation.helperLabel}</span>
      </span>
    </button>
  );
};
