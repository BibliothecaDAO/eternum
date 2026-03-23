import { displayAddress } from "@/ui/utils/utils";
import type { FactoryLaunchChain } from "../types";
import { useFactoryV2DeployerWallet } from "../hooks/use-factory-v2-deployer-wallet";

interface FactoryV2DeployerWalletCardProps {
  chain: FactoryLaunchChain;
  environmentLabel: string;
}

export const FactoryV2DeployerWalletCard = ({ chain, environmentLabel }: FactoryV2DeployerWalletCardProps) => {
  const wallet = useFactoryV2DeployerWallet(chain);

  return (
    <section className="rounded-[26px] border border-white/12 bg-black/10 px-4 py-4 backdrop-blur-xl md:px-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-white/55">Deployer wallet</p>
              <h3 className="text-base font-semibold text-white">
                {environmentLabel} deployer · <span className="text-white/65">{displayAddress(wallet.address)}</span>
              </h3>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/45">Address</p>
              <p className="mt-2 break-all font-mono text-sm text-white/90">{wallet.address}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void wallet.copyAddress();
              }}
              className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/12"
            >
              {resolveCopyActionLabel(wallet.copyState)}
            </button>
            <button
              type="button"
              onClick={() => {
                void wallet.refreshBalances();
              }}
              disabled={wallet.isRefreshing}
              className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {wallet.isRefreshing ? "Refreshing..." : "Refresh balances"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {wallet.balances.map((balance) => (
            <article key={balance.symbol} className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/45">{balance.symbol}</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {balance.isLoading ? "..." : balance.displayBalance}
              </p>
              <p className="mt-1 text-xs text-white/45">{balance.error ?? `Available on ${chain}`}</p>
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
      return "Copy address";
  }
}
