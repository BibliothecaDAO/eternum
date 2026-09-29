import { useAccountAddress } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { type FactView, readFactView } from "@/sync/fact-views";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useMemo } from "react";

/** Reads a view of the native store, again only when one of its facts, the account or the spectator state changes. */
export const useFactView = <T>(view: FactView<T>): T => {
  const {
    setup: { store },
  } = useGame();
  const viewer = useAccountAddress();
  // The spectate intent is latched outside any store; the HUD's spectating flag flips with it and re-renders here.
  const spectating = useUIStore((state) => state.isSpectating);
  const revision = useNativeRevision(view.models);
  return useMemo(() => readFactView(store, view, viewer), [view, store, viewer, spectating, revision]);
};
