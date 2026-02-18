import { useEffect, useMemo, useState } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useAccount } from "@starknet-react/core";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { applyWorldSelection, resolveChain } from "@/runtime/world";
import { Controller } from "@/ui/modules/controller/controller";
import { ModalContainer } from "@/ui/shared";
import type { Chain } from "@contracts";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { env } from "../../../env";

type SignInSelection = {
  name: string;
  chain?: Chain;
  worldAddress?: string;
};

interface SignInPromptModalProps {
  selection?: SignInSelection;
}

export const SignInPromptModal = ({ selection }: SignInPromptModalProps) => {
  const setModal = useUIStore((state) => state.setModal);
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const [isPreparingSelection, setIsPreparingSelection] = useState(Boolean(selection));
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const fallbackChain = useMemo(() => resolveChain(env.VITE_PUBLIC_CHAIN as Chain), []);

  const handleClose = () => {
    setModal(null, false);
  };

  useEffect(() => {
    if (!selection) {
      setIsPreparingSelection(false);
      setSelectionError(null);
      return;
    }

    let isCancelled = false;

    const prepare = async () => {
      setIsPreparingSelection(true);
      setSelectionError(null);
      try {
        await applyWorldSelection(
          { name: selection.name, chain: selection.chain ?? fallbackChain, worldAddress: selection.worldAddress },
          fallbackChain,
        );
        if (!isCancelled) {
          setIsPreparingSelection(false);
        }
      } catch (error) {
        console.error("Failed to prepare world selection before sign-in:", error);
        if (!isCancelled) {
          setSelectionError("Unable to prepare game context. You can still try signing in.");
          setIsPreparingSelection(false);
        }
      }
    };

    void prepare();

    return () => {
      isCancelled = true;
    };
  }, [fallbackChain, selection]);

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
                {isPreparingSelection ? (
                  <div className="w-full h-9 rounded-md border border-gold/30 bg-brown/70 flex items-center justify-center gap-2 text-sm text-gold/80">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing game...
                  </div>
                ) : (
                  <Controller className="w-full justify-center" />
                )}
              </div>
              {selectionError && <p className="text-center text-xs text-red-300">{selectionError}</p>}
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
