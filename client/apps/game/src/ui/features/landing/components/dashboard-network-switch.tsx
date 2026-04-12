import { cn } from "@/ui/design-system/atoms/lib/utils";
import { getChainLabel } from "@/ui/utils/network-switch";
import type { Chain } from "@contracts";
import { useCallback, useMemo, useState } from "react";

import { useLandingNetworkState } from "../hooks/use-landing-network-state";
import type { LandingNetworkChain, LandingNetworkStatus } from "../lib/landing-network-state";

const DASHBOARD_CHAIN_OPTIONS: LandingNetworkChain[] = ["slot", "mainnet"];

const resolveIndicatorTone = (status: LandingNetworkStatus) => {
  switch (status) {
    case "matched":
      return "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.45)]";
    case "mismatched":
      return "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.4)]";
    case "unsupported":
      return "bg-rose-300 shadow-[0_0_10px_rgba(253,164,175,0.35)]";
    case "detecting":
      return "bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.35)]";
    case "disconnected":
    default:
      return "bg-white/40";
  }
};

const resolveWalletStatusLabel = ({
  connectedChain,
  status,
}: {
  connectedChain: Chain | null;
  status: LandingNetworkStatus;
}) => {
  if (status === "disconnected") {
    return "No Wallet";
  }

  if (status === "detecting") {
    return "Detecting";
  }

  if (status === "unsupported") {
    return "Wallet Unsupported";
  }

  return connectedChain ? `Wallet ${getChainLabel(connectedChain)}` : "Wallet Other";
};

const resolveWalletStatusTone = (status: LandingNetworkStatus) => {
  switch (status) {
    case "matched":
      return "text-emerald-200/85";
    case "mismatched":
      return "text-amber-200/90";
    case "unsupported":
      return "text-rose-200/90";
    case "detecting":
      return "text-sky-200/90";
    case "disconnected":
    default:
      return "text-gold/45";
  }
};

export const DashboardNetworkSwitch = ({ className }: { className?: string }) => {
  const { connectedChain, hasConnectedWallet, preferredChain, status, selectPreferredChain, switchToPreferredChain } =
    useLandingNetworkState();
  const [pendingChain, setPendingChain] = useState<LandingNetworkChain | null>(null);
  const displayedPreferredChain = pendingChain ?? preferredChain;
  const renderedStatus = hasConnectedWallet && pendingChain ? "detecting" : status;
  const indicatorTone = useMemo(() => resolveIndicatorTone(renderedStatus), [renderedStatus]);
  const walletStatusLabel = useMemo(
    () =>
      pendingChain
        ? `Switching ${getChainLabel(pendingChain)}`
        : resolveWalletStatusLabel({
            connectedChain,
            status,
          }),
    [connectedChain, pendingChain, status],
  );
  const walletStatusTone = useMemo(() => resolveWalletStatusTone(renderedStatus), [renderedStatus]);

  const handleSelectChain = useCallback(
    async (nextChain: LandingNetworkChain) => {
      if (nextChain === preferredChain || pendingChain) {
        return;
      }

      if (!hasConnectedWallet) {
        selectPreferredChain(nextChain);
        return;
      }

      setPendingChain(nextChain);
      try {
        await switchToPreferredChain(nextChain);
      } finally {
        setPendingChain(null);
      }
    },
    [hasConnectedWallet, pendingChain, preferredChain, selectPreferredChain, switchToPreferredChain],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl border border-gold/20 bg-black/35 px-1.5 py-1 text-gold backdrop-blur-md",
        className,
      )}
      title={`Preferred: ${getChainLabel(preferredChain)} • ${walletStatusLabel}`}
    >
      <div className="flex items-center gap-1.5 px-1.5">
        <span className={cn("h-2 w-2 rounded-full border border-black/20", indicatorTone)} />
        <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-gold/55">Pref</span>
        <span className={cn("text-[9px] font-medium uppercase tracking-[0.12em]", walletStatusTone)}>
          {walletStatusLabel}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {DASHBOARD_CHAIN_OPTIONS.map((chain) => {
          const isSelected = displayedPreferredChain === chain;

          return (
            <button
              key={chain}
              type="button"
              onClick={() => void handleSelectChain(chain)}
              disabled={pendingChain !== null}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                isSelected
                  ? "bg-gold/18 text-gold shadow-[inset_0_0_0_1px_rgba(223,170,84,0.18)]"
                  : "text-gold/55 hover:bg-gold/8 hover:text-gold",
                pendingChain !== null && "cursor-wait opacity-70",
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
