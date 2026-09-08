import { useUIStore } from "@/hooks/store/use-ui-store";
import { isExplicitSpectateSession } from "./spectator-session";

/** Shared order gate; React surfaces can subscribe with useUIStore(canIssueOrders). */
export function canIssueOrders(state: { isSpectating: boolean } = useUIStore.getState()): boolean {
  return !state.isSpectating && !isExplicitSpectateSession();
}
