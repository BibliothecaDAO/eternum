import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import Button from "@/ui/design-system/atoms/button";
import { SpectateButton } from "@/ui/features/progression";

import { mintUrl } from "../constants";

interface OnboardingActionsProps {
  onConnect: () => void;
  onSpectate: () => void;
  showMintCta: boolean;
}

const baseButtonClasses = "w-full rounded-md shadow-md !h-14";
const buttonSize = "lg";

export const OnboardingActions = ({ onConnect, onSpectate, showMintCta }: OnboardingActionsProps) => (
  <div className="flex flex-col space-y-4">
    <Button className={baseButtonClasses} size={buttonSize} forceUppercase={false} variant="gold" onClick={onConnect}>
      <div className="flex items-center justify-center w-full">
        <CartridgeSmall className="w-5 h-5 mr-2 fill-black" />
        <span>Login</span>
      </div>
    </Button>
    <SpectateButton className={baseButtonClasses} onClick={onSpectate} />
    {showMintCta && (
      <a className="w-full cursor-pointer" href={mintUrl} target="_blank" rel="noopener noreferrer">
        <Button className={baseButtonClasses} size={buttonSize} forceUppercase={false}>
          <div className="flex items-center justify-center w-full">
            <TreasureChest className="w-5 h-5 mr-2 fill-gold" />
            <span>Mint Season Pass</span>
          </div>
        </Button>
      </a>
    )}
  </div>
);
