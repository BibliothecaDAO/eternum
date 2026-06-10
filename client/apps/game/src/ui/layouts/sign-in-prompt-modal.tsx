import { useEffect } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { LandingEntryRouteState as SignInRedirectState } from "@/ui/features/landing/lib/landing-entry-state";
import { Controller } from "@/ui/modules/controller/controller";
import { DialogShell } from "@/ui/design-system/molecules/dialog-shell";
import { useLocation, useNavigate } from "react-router-dom";

interface SignInPromptModalProps {
  redirectTo?: string;
  redirectState?: SignInRedirectState;
}

export const SignInPromptModal = ({ redirectTo, redirectState }: SignInPromptModalProps) => {
  const setModal = useUIStore((state) => state.setModal);
  const account = useAccountStore((state) => state.account);
  const navigate = useNavigate();
  const location = useLocation();
  const resolvedRedirectTo = redirectTo ?? `${location.pathname}${location.search}`;

  const handleClose = () => {
    setModal(null, false);
  };

  useEffect(() => {
    if (!account?.address) {
      return;
    }

    setModal(null, false);
    navigate(resolvedRedirectTo, { replace: true, state: redirectState });
  }, [account?.address, navigate, redirectState, resolvedRedirectTo, setModal]);

  return (
    <DialogShell title="Sign in required" size="md" onClose={handleClose}>
      <div className="prose prose-pink max-w-none">
        <p className="text-center mb-4">You need to connect your Cartridge Controller account before entering Blitz.</p>
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
    </DialogShell>
  );
};
