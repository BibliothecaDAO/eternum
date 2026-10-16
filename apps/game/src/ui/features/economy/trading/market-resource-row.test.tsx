import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 0 }));
vi.mock("@/hooks/helpers/use-resources", () => ({
  useResourceManager: () => ({ balanceWithProduction: () => ({ balance: 0 }) }),
}));

import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { MarketResourceRow } from "./market-resource-row";

/** Relic names carry Roman numerals ("Stamina Relic I"), which no painting is keyed by: the row draws them by id. */
const RELICS = [ResourcesIds.StaminaRelic1, ResourcesIds.TroopProductionRelic2];

describe("a market row", () => {
  it.each(RELICS)("draws relic %s with its painting", (resourceId) => {
    const html = renderToStaticMarkup(
      <MarketResourceRow
        entityId={1}
        resourceId={resourceId}
        active={false}
        onClick={() => undefined}
        buyPrice={1}
        sellPrice={1}
        ammPrice={1}
      />,
    );
    expect(html).toContain(`data-icon="${resourceMeaning(resourceId)}"`);
  });
});
