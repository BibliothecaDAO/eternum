import { displayAddress } from "@/ui/utils/utils";
import { useFactoryV2DeployerWallet } from "../hooks/use-factory-v2-deployer-wallet";
import type { FactoryLaunchChain } from "../types";

interface FactoryV2DeployerWalletCardProps {
  chain: FactoryLaunchChain;
  environmentLabel: string;
}

export const FactoryV2DeployerWalletCard = ({ chain, environmentLabel }: FactoryV2DeployerWalletCardProps) => {
  const wallet = useFactoryV2DeployerWallet(chain);

  return (
    <section className="rounded-[20px] border border-white/10 bg-black/8 px-3 py-3 backdrop-blur-xl md:px-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.28em] text-white/48">Deployer wallet</p>
            <div className="text-[0.8rem] font-semibold text-white">
              {environmentLabel} deployer <span className="text-white/55">· {displayAddress(wallet.address)}</span>
            </div>
            <p className="break-all font-mono text-[0.62rem] leading-4 text-white/56">{wallet.address}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                void wallet.copyAddress();
              }}
              className="rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/80 transition hover:bg-white/12"
            >
              {resolveCopyActionLabel(wallet.copyState)}
            </button>
            <button
              type="button"
              onClick={() => {
                void wallet.refreshBalances();
              }}
              disabled={wallet.isRefreshing}
              className="rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/80 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {wallet.isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {wallet.balances.map((balance) => (
            <article key={balance.symbol} className="rounded-2xl border border-white/8 bg-black/14 px-2.5 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-white/45">
                  {balance.symbol}
                </p>
                <p className="text-sm font-semibold text-white">{balance.isLoading ? "..." : balance.displayBalance}</p>
              </div>
              <p className="mt-1 text-[0.65rem] text-white/42">{balance.error ?? ``}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

function resolveCopyActionLabel(copyState: "idle" | "copied" | "error") {
  switch (copyState) {
    case "copied":
      return "Copied";
    case "error":
      return "Copy failed";
    default:
      return "Copy";
  }
}
