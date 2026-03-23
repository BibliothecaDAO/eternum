import { SwitchNetworkPrompt } from "@/ui/components/switch-network-prompt";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { useFactoryV2DeveloperConfig } from "../hooks/use-factory-v2-developer-config";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryGameMode, FactoryLaunchChain } from "../types";

function resolveSectionCountLabel(itemCount: number | undefined) {
  if (typeof itemCount !== "number") {
    return "Core";
  }

  return itemCount === 1 ? "1" : String(itemCount);
}

function formatFactoryEntrypointLabel(entrypoint: string) {
  return entrypoint.replaceAll("_", " ");
}

function resolveSubmitButtonLabel({
  executionStatus,
  targetChainLabel,
}: {
  executionStatus: ReturnType<typeof useFactoryV2DeveloperConfig>["executionState"]["status"];
  targetChainLabel: string;
}) {
  if (executionStatus === "sending") {
    return "Sending multicall...";
  }

  return `Send multicall [${targetChainLabel}]`;
}

export const FactoryV2DeveloperConfig = ({
  mode,
  chain,
  environmentLabel,
}: {
  mode: FactoryGameMode;
  chain: FactoryLaunchChain;
  environmentLabel: string;
}) => {
  const appearance = resolveFactoryModeAppearance(mode);
  const developerConfig = useFactoryV2DeveloperConfig({ mode, chain });
  const submittedExecutionState =
    developerConfig.executionState.status === "submitted" || developerConfig.executionState.status === "confirmed"
      ? developerConfig.executionState
      : null;
  const errorExecutionState = developerConfig.executionState.status === "error" ? developerConfig.executionState : null;

  return (
    <>
      <div className={cn("rounded-[24px] border px-4 py-4 md:px-5", appearance.featureSurfaceClassName)}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42">Factory config</div>
              <h3 className="mt-1 text-base font-semibold text-black/80">One multicall</h3>
              <p className="mt-1 text-[13px] leading-5 text-black/48">
                Pick the factory setters and send one wallet call.
              </p>
            </div>
            <div
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/56",
                appearance.quietSurfaceClassName,
              )}
            >
              {environmentLabel} · {chain}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(120px,150px)_minmax(120px,160px)]">
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/42">Factory</span>
              <input
                type="text"
                value={developerConfig.draft.factoryAddress || "Not configured for this chain"}
                readOnly
                className={cn(
                  "mt-1.5 block h-10 w-full rounded-[16px] border bg-white/60 px-3 text-[12px] text-black/60 outline-none",
                  appearance.listItemClassName,
                )}
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/42">Version</span>
              <input
                type="text"
                value={developerConfig.draft.version}
                onChange={(event) => developerConfig.setVersion(event.target.value)}
                className={cn(
                  "mt-1.5 block h-10 w-full rounded-[16px] border bg-white/80 px-3 text-[12px] font-medium text-black outline-none transition-colors",
                  appearance.listItemClassName,
                )}
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/42">
                Namespace
              </span>
              <input
                type="text"
                value={developerConfig.draft.namespace}
                readOnly
                className={cn(
                  "mt-1.5 block h-10 w-full rounded-[16px] border bg-white/60 px-3 text-[12px] text-black/60 outline-none",
                  appearance.listItemClassName,
                )}
              />
            </label>
          </div>

          {developerConfig.isVersionCustomized ? (
            <div className="rounded-[18px] border border-amber-500/24 bg-amber-500/8 px-3 py-2.5">
              <p className="text-[12px] leading-5 text-amber-900/84">
                This version differs from the default for {mode}.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/42">Setters</div>
                <p className="mt-1 text-[12px] leading-5 text-black/48">
                  {developerConfig.selectedSections.length} selected · one wallet multicall
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={developerConfig.selectAllSections}
                  className={cn(
                    "inline-flex h-8 items-center justify-center rounded-full px-3 text-[12px] font-semibold transition-colors",
                    appearance.secondaryButtonClassName,
                  )}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={developerConfig.clearSections}
                  className={cn(
                    "inline-flex h-8 items-center justify-center rounded-full px-3 text-[12px] font-semibold transition-colors",
                    appearance.secondaryButtonClassName,
                  )}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {developerConfig.draft.sections.map((section) => {
                const isSelected = developerConfig.selectedSectionIds.includes(section.id);

                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => developerConfig.toggleSection(section.id)}
                    className={cn(
                      "rounded-[18px] border px-3 py-3 text-left transition-all",
                      appearance.listItemClassName,
                      isSelected
                        ? "border-black/35 bg-white/78 shadow-[0_10px_22px_rgba(39,25,16,0.11)]"
                        : "border-black/10 bg-white/38 opacity-80",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">
                          {section.label}
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-black/62">
                          {formatFactoryEntrypointLabel(section.entrypoint)}
                        </div>
                      </div>
                      <div className="rounded-full border border-black/10 bg-white/60 px-2 py-0.5 text-[10px] font-medium text-black/58">
                        {resolveSectionCountLabel(section.itemCount)}
                      </div>
                    </div>

                    <p className="mt-2 text-[12px] leading-5 text-black/50">{section.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {developerConfig.isManifestLoading ? (
            <div
              className={cn(
                "rounded-[18px] border px-3 py-2.5 text-[12px] text-black/56",
                appearance.quietSurfaceClassName,
              )}
            >
              Loading factory manifest...
            </div>
          ) : null}

          {developerConfig.manifestErrorMessage ? (
            <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/6 px-3 py-2.5">
              <p className="text-[12px] leading-5 text-rose-800">{developerConfig.manifestErrorMessage}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void developerConfig.submitMulticall();
              }}
              disabled={!developerConfig.canSubmit}
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                appearance.primaryButtonClassName,
              )}
            >
              {resolveSubmitButtonLabel({
                executionStatus: developerConfig.executionState.status,
                targetChainLabel: developerConfig.targetChainLabel,
              })}
            </button>
            <span className="text-[11px] leading-5 text-black/42">
              {!developerConfig.account
                ? "Connect your wallet to send factory setters."
                : developerConfig.canSubmitOnCurrentNetwork
                  ? "Uses your connected wallet."
                  : `Wallet chain will be switched to ${developerConfig.targetChainLabel}.`}
            </span>
          </div>

          {submittedExecutionState ? (
            <div className={cn("rounded-[18px] border px-3 py-3", appearance.quietSurfaceClassName)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/42">
                    {submittedExecutionState.status === "confirmed" ? "Multicall confirmed" : "Multicall submitted"}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-black/56">
                    {submittedExecutionState.status === "confirmed"
                      ? "Factory setters confirmed onchain."
                      : "Awaiting confirmation. You can track the transaction below."}
                  </div>
                  <div className="mt-2 break-all text-[12px] font-semibold text-black/82">
                    {submittedExecutionState.txHash}
                  </div>
                </div>
                {developerConfig.txExplorerUrl ? (
                  <a
                    href={developerConfig.txExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex h-9 items-center justify-center rounded-full px-3 text-[12px] font-semibold transition-colors",
                      appearance.secondaryButtonClassName,
                    )}
                  >
                    View transaction
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {errorExecutionState ? (
            <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/6 px-3 py-2.5">
              <p className="text-[12px] leading-5 text-rose-800">{errorExecutionState.message}</p>
              {errorExecutionState.txHash && developerConfig.txExplorerUrl ? (
                <a
                  href={developerConfig.txExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "mt-2 inline-flex h-8 items-center justify-center rounded-full px-3 text-[12px] font-semibold transition-colors",
                    appearance.secondaryButtonClassName,
                  )}
                >
                  View transaction
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <SwitchNetworkPrompt
        open={developerConfig.showSwitchNetworkPrompt}
        description="Your wallet is connected to another chain for this factory action."
        hint={`Switch to ${developerConfig.targetChainLabel} to send this multicall.`}
        switchLabel={`Switch To ${developerConfig.targetChainLabel}`}
        onClose={developerConfig.dismissSwitchNetworkPrompt}
        onSwitch={developerConfig.switchWalletToTargetChain}
      />
    </>
  );
};
