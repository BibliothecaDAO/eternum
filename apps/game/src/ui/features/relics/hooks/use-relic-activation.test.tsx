import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { useRelicMetadata } from "./use-relic-activation";

vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRow: () => ({ rules: [] }) }));
afterEach(() => vi.restoreAllMocks());

it("words a relic's effect, duration and cost from the game's relic rules, not a fixed table", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const activation = vi.spyOn(configManager, "getRelicActivation");
  const Caption = ({ id }: { id: number }) => {
    const { relicInfo, essenceCost } = useRelicMetadata(id);
    return <output>{`${relicInfo?.effectLine} · ${essenceCost}`}</output>;
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    activation.mockReturnValue({ durationSeconds: 180, essenceCost: 750 });
    act(() => root.render(<Caption id={ResourcesIds.DamageRelic1} />));
    expect(host.textContent).toBe("Increases damage by 20% for 3m · 750");
    activation.mockReturnValue({ durationSeconds: 0, essenceCost: 1_000 });
    act(() => root.render(<Caption id={ResourcesIds.DamageRelic2} />));
    expect(host.textContent).toBe("Increases damage by 40% · 1000");
  } finally {
    act(() => root.unmount());
  }
});
