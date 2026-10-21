import { useAccountAddress } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { type FactView, readFactView } from "@/sync/fact-views";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { readSeatsRevision, subscribeSeats } from "@/utils/entity-ownership";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Reads a view of the native store, again only when one of its facts, the account, the spectator state or a watching
 * viewer's seats (`setOpenGameSeats`) change.
 */
export const useFactView = <T>(view: FactView<T>): T => {
  const viewer = useAccountAddress();
  // The spectate intent is latched outside any store; the HUD's spectating flag flips with it and re-renders here.
  const spectating = useUIStore((state) => state.isSpectating);
  const facts = useNativeFacts(view.models);
  const seats = useSyncExternalStore(subscribeSeats, readSeatsRevision, readSeatsRevision);
  return useMemo(
    () => readFactView(facts.store, view, viewer, { seats, spectating }),
    [view, viewer, spectating, facts, seats],
  );
};
