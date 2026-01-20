import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { useGameSelector } from "@/hooks/helpers/use-game-selector";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Button } from "@/ui/design-system/atoms";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { Controller } from "@/ui/modules/controller/controller";
import { useAccount } from "@starknet-react/core";
import { useNavigate } from "react-router-dom";

// Served from client/public/images/landing/wooden-panel.png
const LANDING_PANEL_IMAGE = "/borders/landing-frame-1.png";

export const LandingWelcome = () => {
  const navigate = useNavigate();
  const { activeWorld, selectGame } = useGameSelector();
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const setModal = useUIStore((state) => state.setModal);

  const handleSelectGame = async () => {
    await selectGame({ navigateAfter: true, navigateTo: "/play" });
  };

  const handleEnterBlitz = () => {
    const hasAccount = Boolean(account) || isConnected;

    if (!hasAccount) {
      setModal(<SignInPromptModal />, true);
      return;
    }

    navigate("/play");
  };

  const buttonClasses = "h-9 px-4 min-w-[96px] w-full sm:w-auto";

  return (
    <section className="flex w-full items-center justify-center px-3 sm:px-4 lg:px-6 -mt-8 sm:-mt-14 pb-4">
      <div className="flex flex-col items-center justify-center w-full max-w-2xl sm:max-w-3xl 2xl:max-w-4xl">
        <div className="relative sm:flex flex-col sm:items-center justify-center w-full">
          <img
            alt=""
            aria-hidden="true"
            src={LANDING_PANEL_IMAGE}
            loading="lazy"
            className="mx-auto w-full max-h-[60vh] max-w-[640px] select-none object-contain pointer-events-none md:max-h-[65vh] md:max-w-full 2xl:max-h-none hidden sm:block"
          />

          <div className="sm:absolute inset-0 flex flex-col items-center justify-center px-4 py-8 text-center text-gold sm:px-8 sm:py-10">
            <EternumWordsLogo className="mx-auto lg:w-72 xl:w-[360px]" />
            {/* Buttons */}
            <div className="mt-10 px-10 sm:px-0 sm:mt-14 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Button
                variant={activeWorld ? "opaque" : "default"}
                className={`${buttonClasses} hidden sm:block`}
                onClick={handleSelectGame}
              >
                {activeWorld ? "Change Game" : "Select Game"}
              </Button>
              {activeWorld && (
                <Button className={buttonClasses} onClick={handleEnterBlitz}>
                  Enter Blitz
                </Button>
              )}
              <Controller className={buttonClasses} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
