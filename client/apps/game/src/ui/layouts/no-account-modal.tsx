import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { ModalContainer } from "@/ui/shared";

export const NoAccountModal = () => {
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setModal = useUIStore((state) => state.setModal);

  const handleHomeClick = () => {
    setModal(null, false);
    setShowBlankOverlay(true);
  };

  return (
    <ModalContainer>
      <div className="flex items-start justify-center pt-32">
        <div className="flex container max-w-lg mx-auto bg-brown/90 bg-hex-bg rounded-xl border border-gold/40">
          <div className="w-full p-8 prose prose-pink">
            <h3 className="text-center mb-6">Account Required</h3>
            <p className="text-center mb-8">
              You need to have a Cartridge Controller account to play this game. Please login or create an account to
              continue.
            </p>
            <div className="flex justify-center">
              <Button
                onClick={handleHomeClick}
                className="!bg-[#FCB843] !text-black border-none hover:!bg-[#FCB843]/80"
                variant="default"
              >
                <CartridgeSmall className="w-5 md:w-6 mr-1 md:mr-2 fill-black" />
                Log In with Cartridge
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
};
