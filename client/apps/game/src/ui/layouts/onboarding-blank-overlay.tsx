import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import Button from "@/ui/design-system/atoms/button";
import { SpectateButton } from "@/ui/features/progression";
import { mintUrl, OnboardingContainer, StepContainer } from "@/ui/layouts/onboarding";
import { getIsBlitz } from "@bibliothecadao/eternum";

interface OnboardingBlankOverlayProps {
  backgroundImage: string;
  onConnect: () => void;
  onSpectate: () => void;
}

export const OnboardingBlankOverlay = ({ backgroundImage, onConnect, onSpectate }: OnboardingBlankOverlayProps) => {
  const isBlitz = getIsBlitz();

  return (
    <OnboardingContainer backgroundImage={backgroundImage}>
      <div className="flex h-full w-full">
        <div className="pointer-events-none flex flex-1 items-center pl-16">
          <EternumWordsLogo className="w-56 fill-brown sm:w-48 lg:w-72 xl:w-[360px]" />
        </div>
        <div className="flex flex-1 justify-end">
          <StepContainer showLogo={false}>
            <div className="mt-2 flex flex-col justify-wrap space-y-4">
              <Button className="w-full" variant="gold" onClick={onConnect}>
                <div className="flex items-center justify-center">
                  <CartridgeSmall className="mr-2 h-5 w-5 fill-black" />
                  <span>Login</span>
                </div>
              </Button>
              <SpectateButton onClick={onSpectate} />

              {!isBlitz && (
                <a className="mt-auto w-full cursor-pointer" href={mintUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full" size="lg">
                    <div className="flex w-full items-center justify-start">
                      <TreasureChest className="mr-1 h-5 w-5 fill-gold text-gold md:mr-2" />
                      <span className="flex-grow text-center">Mint Season Pass</span>
                    </div>
                  </Button>
                </a>
              )}
            </div>
          </StepContainer>
        </div>
      </div>
    </OnboardingContainer>
  );
};

export default OnboardingBlankOverlay;
