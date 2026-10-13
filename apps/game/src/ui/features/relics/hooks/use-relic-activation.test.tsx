import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { configManager, formatTime } from "@bibliothecadao/eternum";
import { useRelicMetadata } from "./use-relic-activation";

const facts = vi.hoisted(() => ({ seconds: 60n }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({
  useNativeRow: (model: string) =>
    model === "SliceRules"
      ? { tick_config: { armies_tick_in_seconds: facts.seconds } }
      : { rules: Array.from({ length: 18 }, (_, index) => ({ uses: index < 2 ? 3 : 0, duration: index < 2 ? 0 : 3 })) },
}));
afterEach(() => vi.restoreAllMocks());

it("advertises the active preset's full duration for stamina and every timed relic family", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const Caption = ({ id }: { id: number }) => <output>{useRelicMetadata(id).relicInfo?.duration}</output>;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    for (const seconds of [60n, 120n]) {
      facts.seconds = seconds;
      for (const id of [39, 41, 43, 47, 49, 51, 53, 55]) {
        act(() => root.render(<Caption id={id} />));
        expect(host.textContent).toBe(formatTime(Number(seconds) * 3));
      }
    }
  } finally {
    act(() => root.unmount());
  }
});
