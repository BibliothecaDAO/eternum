import { ResourcesIds } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** The game's relic rules, before they have arrived from the shard. */
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRow: () => undefined }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/eternum")>();
  vi.spyOn(actual.configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(actual.configManager, "getRelicActivation").mockImplementation(() => {
    throw new Error("RelicRules is not synchronized");
  });
  return actual;
});

import { HeldRelic } from "./relic-activation-shared";

describe("a held relic", () => {
  it("draws its chip before the relic rules arrive, with no hover line yet", () => {
    const html = renderToStaticMarkup(<HeldRelic relicId={ResourcesIds.ProductionRelic1} held="2" />);
    expect(html).toContain("×2");
    expect(html).not.toContain("data-tip");
  });
});
