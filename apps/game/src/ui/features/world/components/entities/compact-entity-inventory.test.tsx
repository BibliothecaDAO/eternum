import type { ResourceManager } from "@bibliothecadao/eternum";
import { RelicRecipientType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ resources: { getTiers: () => ({}) } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1 }));
vi.mock("@/ui/features/relics/components/relic-activation-selector", () => ({ RelicActivationSelector: () => null }));

import { CompactEntityInventory } from "./compact-entity-inventory";

/** An army's inventory holding these relics, in whole units. */
const holding = (relics: [ResourcesIds, number][]) =>
  ({
    balances: () => relics.map(([resourceId, amount]) => ({ resourceId, amount: amount * RESOURCE_PRECISION })),
  }) as unknown as ResourceManager;

it("names each relic on its chip beside its count, not only in a tooltip", () => {
  const text = (html: string) => html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
  const html = renderToStaticMarkup(
    <CompactEntityInventory
      resources={holding([
        [ResourcesIds.StaminaRelic1, 2],
        [ResourcesIds.DamageRelic2, 1],
      ])}
      recipientType={RelicRecipientType.Explorer}
      variant="tight"
      filter="relics"
    />,
  );
  expect(text(html)).toContain("|2|Stamina I|");
  expect(text(html)).toContain("|1|Damage II|");
});
