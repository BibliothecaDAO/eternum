import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import Button from "@/ui/design-system/atoms/button";
import { SpectateButton } from "@/ui/features/progression";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { Loader2 } from "lucide-react";

const mintUrl = "https://empire.realms.world";

interface AccountPanelProps {
  onConnect: () => void;
  onSpectate: () => void;
  isConnecting: boolean;
  isBootstrapRunning: boolean;
  bootstrapProgress: number;
}

export const AccountPanel = ({
  onConnect,
  onSpectate,
  isConnecting,
  isBootstrapRunning,
  bootstrapProgress,
}: AccountPanelProps) => {
  const mode = useGameModeConfig();

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gold">Welcome to Eternum</h2>
        <p className="text-sm text-gold/60 mt-1">Connect your wallet to begin your conquest</p>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="space-y-4">
          <Button
            className="w-full rounded-md shadow-md !h-14"
            size="lg"
            forceUppercase={false}
            variant="gold"
            onClick={onConnect}
            disabled={isConnecting}
          >
            <div className="flex items-center justify-center w-full">
              {isConnecting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CartridgeSmall className="w-5 h-5 mr-2 fill-black" />
              )}
              <span>{isConnecting ? "Connecting..." : "Login"}</span>
            </div>
          </Button>

          <SpectateButton className="w-full rounded-md shadow-md !h-14" onClick={onSpectate} />

          {mode.ui.showMintCta && (
            <a className="w-full cursor-pointer block" href={mintUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full rounded-md shadow-md !h-14" size="lg" forceUppercase={false}>
                <div className="flex items-center justify-center w-full">
                  <TreasureChest className="w-5 h-5 mr-2 fill-gold" />
                  <span>Mint Season Pass</span>
                </div>
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Background bootstrap status */}
      {isBootstrapRunning && (
        <div className="mt-6 pt-4 border-t border-gold/20">
          <div className="flex items-center justify-between text-xs text-gold/60 mb-2">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Preparing world...
            </span>
            <span>{bootstrapProgress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gold/10">
            <div
              className="h-1.5 rounded-full bg-gold/40 transition-all duration-300"
              style={{ width: `${bootstrapProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
