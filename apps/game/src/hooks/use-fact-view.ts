import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { type FactView, NO_ACCOUNT, readFactView } from "@/sync/fact-views";
import { useGame, useNativeRevision } from "@bibliothecadao/react";
import { useMemo } from "react";

/** Reads a view of the native store, again only when one of its facts, the account or the spectator state changes. */
export const useFactView = <T>(view: FactView<T>): T => {
  const {
    setup: { store },
  } = useGame();
  const account = useAccountStore((state) => state.account?.address ?? NO_ACCOUNT);
  const spectating = useUIStore((state) => state.isSpectating);
  const revision = useNativeRevision(view.models);
  return useMemo(() => readFactView(store, view, account), [view, store, account, spectating, revision]);
};
