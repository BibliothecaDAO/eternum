import { type FactoryWorld } from "@/hooks/use-factory-worlds";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import type { Chain } from "@contracts";

const CHAIN_OPTIONS: Chain[] = ["mainnet", "slot"];

interface LandingWorldSelectorProps {
  selectedChain: Chain;
  selectedWorld: string | null;
  availableWorlds: FactoryWorld[];
  isLoading: boolean;
  isCheckingAvailability?: boolean;
  onChainChange: (chain: Chain) => void;
  onWorldChange: (worldName: string | null) => void;
}

export const LandingWorldSelector = ({
  selectedChain,
  selectedWorld,
  availableWorlds,
  isLoading,
  isCheckingAvailability = false,
  onChainChange,
  onWorldChange,
}: LandingWorldSelectorProps) => {
  const handleWorldChange = (value: string) => {
    if (value === "__default__") {
      onWorldChange(null);
    } else {
      onWorldChange(value);
    }
  };

  const isLoadingAny = isLoading || isCheckingAvailability;
  const loadingText = isLoading ? "Loading worlds..." : isCheckingAvailability ? "Checking availability..." : "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/60">Chain:</span>
        <div className="flex gap-1">
          {CHAIN_OPTIONS.map((chain) => (
            <button
              key={chain}
              type="button"
              onClick={() => onChainChange(chain)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/70 ${
                selectedChain === chain
                  ? "border border-gold/60 bg-gold/30 text-gold"
                  : "border border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
              }`}
            >
              {chain}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-white/60">World:</span>
        <Select value={selectedWorld ?? "__default__"} onValueChange={handleWorldChange} disabled={isLoadingAny}>
          <SelectTrigger className="h-8 min-w-[160px] rounded-xl border border-white/15 bg-white/5 text-xs">
            <SelectValue placeholder={isLoadingAny ? loadingText : "Select world"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Default</SelectItem>
            {availableWorlds.map((world) => (
              <SelectItem key={world.name} value={world.name}>
                {world.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLoadingAny && <span className="text-xs text-white/50">{loadingText}</span>}
      </div>
    </div>
  );
};
