import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import type { NativeFacts } from "./use-native-facts";

const factsByStore = new WeakMap<object, Map<number, NativeFacts>>();

/**
 * use-native-facts for a test that mocks the game context: the store its useGame gives, at the revision the test reads
 * (0 when it never changes), one value per store and revision as the hook keeps. A test's factory returns it:
 * vi.mock("@/hooks/helpers/use-native-facts", async () => (await import("./native-facts-mock")).nativeFactsMock()).
 */
export const nativeFactsMock = (revision: () => number = () => 0) => ({
  useNativeRevision: () => revision(),
  useNativeFacts: (): NativeFacts => {
    const store = useGame().setup.store as NativeFactStore;
    const now = revision();
    const byRevision = factsByStore.get(store) ?? new Map<number, NativeFacts>();
    factsByStore.set(store, byRevision);
    const facts = byRevision.get(now) ?? { store, revision: now };
    byRevision.set(now, facts);
    return facts;
  },
});
