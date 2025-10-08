import { ReactNode } from "react";

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

const baseButtonClasses = "w-full rounded-md shadow-md";

const renderButtonContent = (icon: ReactNode, label: string) => (
  <div className="flex w-full items-center justify-start">
    {icon}
    <span className="flex-grow text-center">{label}</span>
  </div>
);

export const OnboardingActions = ({ onConnect, onSpectate, showMintCta }: OnboardingActionsProps) => (
  <div className="flex flex-col space-y-4">
    <Button
      className={`${baseButtonClasses} !h-14`}
      size="lg"
      forceUppercase={false}
      variant="gold"
      onClick={onConnect}
    >
      {renderButtonContent(<CartridgeSmall className="mr-2 h-5 w-5 fill-black" />, "Login")}
    </Button>
    <SpectateButton onClick={onSpectate} />
    {showMintCta && (
      <a className="w-full cursor-pointer" href={mintUrl} target="_blank" rel="noopener noreferrer">
        <Button className={baseButtonClasses} size="lg" forceUppercase={false}>
          {renderButtonContent(<TreasureChest className="mr-2 h-5 w-5 fill-gold" />, "Mint Season Pass")}
        </Button>
      </a>
    )}
  </div>
);
