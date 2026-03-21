import { cn } from "@/ui/design-system/atoms/lib/utils";

import { useFactoryV2DeveloperLookup } from "../hooks/use-factory-v2-developer-lookup";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryGameMode, FactoryLaunchChain } from "../types";

function resolveContractSuggestionLabel(contractSuggestion: string) {
  if (contractSuggestion === "s1_eternum-prize_distribution_systems") {
    return "Prize address";
  }

  return contractSuggestion;
}

export const FactoryV2DeveloperTools = ({
  mode,
  chain,
  environmentLabel,
  draftGameName,
  selectedRunName,
}: {
  mode: FactoryGameMode;
  chain: FactoryLaunchChain;
  environmentLabel: string;
  draftGameName: string;
  selectedRunName: string | null;
}) => {
  const appearance = resolveFactoryModeAppearance(mode);
  const developerLookup = useFactoryV2DeveloperLookup({
    chain,
    draftGameName,
    selectedRunName,
  });

  return (
    <div className="px-1 pt-2 md:px-0 md:pt-4">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={developerLookup.registerRevealTap}
          className="rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] text-black/32 transition-colors hover:text-black/50"
        >
          fv2/dev
        </button>
      </div>

      {developerLookup.isVisible ? (
        <div className="mt-3 md:mt-4">
          <div className={cn("rounded-[26px] border px-4 py-4 md:px-5 md:py-5", appearance.featureSurfaceClassName)}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42">
                    Developer tools
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-black/80">Resolve contract address</h3>
                  <p className="mt-1 text-sm leading-6 text-black/48">
                    Look up a Factory-deployed contract address from the selected environment without touching the game
                    indexer.
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/56",
                    appearance.quietSurfaceClassName,
                  )}
                >
                  {environmentLabel} · {chain}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">
                    Game name
                  </span>
                  <input
                    type="text"
                    value={developerLookup.gameName}
                    onChange={(event) => developerLookup.setGameName(event.target.value)}
                    placeholder="etrn-sunrise-01"
                    className={cn(
                      "mt-2 block h-11 w-full rounded-[18px] border bg-white/80 px-3 text-[13px] text-black outline-none transition-colors placeholder:text-black/25",
                      appearance.listItemClassName,
                    )}
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">
                    Contract target
                  </span>
                  <select
                    value={developerLookup.selectedTargetId}
                    onChange={(event) =>
                      developerLookup.setSelectedTargetId(event.target.value as typeof developerLookup.selectedTargetId)
                    }
                    className={cn(
                      "mt-2 block h-11 w-full rounded-[18px] border bg-white/80 px-3 text-[13px] font-medium text-black outline-none transition-colors",
                      appearance.listItemClassName,
                    )}
                  >
                    {developerLookup.targetOptions.map((targetOption) => (
                      <option key={targetOption.id} value={targetOption.id}>
                        {targetOption.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {developerLookup.usesCustomContractInput ? (
                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">
                    Manifest contract
                  </span>
                  <input
                    type="text"
                    value={developerLookup.customContractName}
                    onChange={(event) => developerLookup.setCustomContractName(event.target.value)}
                    placeholder="prize_distribution_systems"
                    className={cn(
                      "mt-2 block h-11 w-full rounded-[18px] border bg-white/80 px-3 text-[13px] text-black outline-none transition-colors placeholder:text-black/25",
                      appearance.listItemClassName,
                    )}
                  />
                  <p className="mt-2 text-[12px] leading-5 text-black/42">
                    Accepts raw names like <code>prize_distribution_systems</code>, wrapped values like{" "}
                    <code>{"{prize_distribution_systems}"}</code>, or full manifest tags.
                  </p>
                </label>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void developerLookup.submitLookup();
                  }}
                  disabled={!developerLookup.canSubmit}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    appearance.primaryButtonClassName,
                  )}
                >
                  {developerLookup.isSubmitting ? "Resolving..." : "Resolve address"}
                </button>
                <span className="text-[12px] leading-5 text-black/42">
                  Default target: <span className="font-medium text-black/60">Prize address</span>
                </span>
              </div>

              {developerLookup.lookupFailure ? (
                <div className="space-y-3 rounded-[20px] border border-rose-500/18 bg-rose-500/6 px-4 py-3">
                  <p className="text-sm leading-6 text-rose-800">{developerLookup.lookupFailure.message}</p>

                  {developerLookup.lookupFailure.worldSuggestions?.length ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-800/70">
                        World suggestions
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {developerLookup.lookupFailure.worldSuggestions.map((worldSuggestion) => (
                          <button
                            key={worldSuggestion}
                            type="button"
                            onClick={() => {
                              void developerLookup.applyWorldSuggestion(worldSuggestion);
                            }}
                            className="rounded-full border border-rose-600/18 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-rose-900 transition-colors hover:bg-white"
                          >
                            {worldSuggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {developerLookup.lookupFailure.contractSuggestions?.length ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-800/70">
                        Contract suggestions
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {developerLookup.lookupFailure.contractSuggestions.map((contractSuggestion) => (
                          <button
                            key={contractSuggestion}
                            type="button"
                            onClick={() => {
                              void developerLookup.applyContractSuggestion(contractSuggestion);
                            }}
                            className="rounded-full border border-rose-600/18 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-rose-900 transition-colors hover:bg-white"
                          >
                            {resolveContractSuggestionLabel(contractSuggestion)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {developerLookup.lookupResult ? (
                <div className={cn("rounded-[20px] border px-4 py-4", appearance.quietSurfaceClassName)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/42">
                        {developerLookup.selectedTarget.label}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-black/82">
                        {developerLookup.lookupResult.contractAddress}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void developerLookup.copyResolvedAddress();
                      }}
                      className={cn(
                        "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors",
                        appearance.secondaryButtonClassName,
                      )}
                    >
                      {developerLookup.copyStatus === "copied"
                        ? "Copied"
                        : developerLookup.copyStatus === "error"
                          ? "Copy failed"
                          : "Copy address"}
                    </button>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm text-black/58 md:grid-cols-3">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">World</dt>
                      <dd className="mt-1 font-medium text-black/72">{developerLookup.lookupResult.worldName}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">Tag</dt>
                      <dd className="mt-1 break-all font-medium text-black/72">
                        {developerLookup.lookupResult.resolvedTag}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
                        World address
                      </dt>
                      <dd className="mt-1 break-all font-medium text-black/72">
                        {developerLookup.lookupResult.worldAddress}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
