import { useEffect } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useAccount } from "@starknet-react/core";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Controller } from "@/ui/modules/controller/controller";
import { ModalContainer } from "@/ui/shared";
import { useNavigate } from "react-router-dom";

export const SignInPromptModal = () => {
  const setModal = useUIStore((state) => state.setModal);
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  const handleClose = () => {
    setModal(null, false);
  };

  useEffect(() => {
    if (!account && !isConnected) {
      return;
    }

    setModal(null, false);
    navigate("/play");
  }, [account, isConnected, navigate, setModal]);

  return (
    <ModalContainer>
      <div className="flex items-start justify-center pt-32">
        <div className="flex container max-w-lg mx-auto bg-brown/90 bg-hex-bg rounded-xl border border-gold/40">
          <div className="w-full p-8 prose prose-pink">
            <h3 className="text-center mb-6">Sign in required</h3>
            <p className="text-center mb-4">
              You need to connect your Cartridge Controller account before entering Blitz.
            </p>
            <p className="text-center mb-8 text-sm">Use the button below to sign in, then try again.</p>
            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-xs">
                <Controller className="w-full justify-center" />
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center justify-center rounded-md border border-gold/40 bg-brown/80 px-4 py-2 text-sm font-medium text-gold hover:bg-brown/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
};
