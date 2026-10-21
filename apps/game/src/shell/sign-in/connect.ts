import { useCallback } from "react";
import { create } from "zustand";

/**
 * Asking to connect: the one way any surface opens the Connect window (connect-flow.tsx) over the page the player is
 * on. `next` is where a signed-in player goes once connected (Play free's season); without it they stay where they are.
 */
type ConnectStore = {
  request: { next: string | null } | null;
  /** A new account's name step was closed: it opens again only when asked, or on the next visit. */
  nameDismissed: boolean;
  open: (next: string | null) => void;
  close: () => void;
};

export const useConnectStore = create<ConnectStore>()((set) => ({
  request: null,
  nameDismissed: false,
  open: (next) => set({ request: { next }, nameDismissed: false }),
  close: () => set({ request: null, nameDismissed: true }),
}));

/** Opens Connect; once connected the player goes to `next`, or stays on the page they asked from. */
export const useRequestSignIn = () => {
  const open = useConnectStore((state) => state.open);
  return useCallback((next?: string) => open(next ?? null), [open]);
};
