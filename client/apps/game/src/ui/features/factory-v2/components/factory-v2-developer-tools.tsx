import { FactoryV2DeveloperContractLookup } from "./factory-v2-developer-contract-lookup";
import { FactoryV2DeveloperConfig } from "./factory-v2-developer-config";
import { useFactoryV2DeveloperPanelVisibility } from "../hooks/use-factory-v2-developer-panel-visibility";
import type { FactoryGameMode, FactoryLaunchChain } from "../types";

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
  const developerPanel = useFactoryV2DeveloperPanelVisibility();

  return (
    <div className="px-1 pt-2 md:px-0 md:pt-4">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={developerPanel.registerRevealTap}
          className="rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] text-black/32 transition-colors hover:text-black/50"
        >
          fv2/dev
        </button>
      </div>

      {developerPanel.isVisible ? (
        <div className="mt-3 space-y-4 md:mt-4">
          <div className="px-1 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42">
            Developer tools
          </div>

          <FactoryV2DeveloperContractLookup
            mode={mode}
            chain={chain}
            environmentLabel={environmentLabel}
            draftGameName={draftGameName}
            selectedRunName={selectedRunName}
          />

          <FactoryV2DeveloperConfig mode={mode} chain={chain} environmentLabel={environmentLabel} />
        </div>
      ) : null}
    </div>
  );
};
