import type { ResourceManager } from "@bibliothecadao/eternum";
import { EntityType, RelicRecipientType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ resources: { getTiers: () => ({}) } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1 }));
vi.mock("@/ui/features/relics/components/relic-activation-selector", () => ({ RelicActivationSelector: () => null }));
// A relic's activation, as the game's relic rules set it: Damage II costs 500 Essence and works for 30m.
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const eternum = await importOriginal<typeof import("@bibliothecadao/eternum")>();
  return {
    ...eternum,
    configManager: Object.assign(Object.create(eternum.configManager), {
      getRelicActivation: () => ({ essenceCost: 500, durationSeconds: 1_800 }),
    }),
  };
});
// The Essence the holder's home realm can pay an activation with.
const payer = vi.hoisted(() => ({ essence: undefined as number | undefined }));
vi.mock("@/ui/features/relics/hooks/use-relic-activation", () => ({ useRelicPayerEssence: () => payer.essence }));

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
      filter="relics"
    />,
  );
  expect(text(html)).toContain("|Stamina I|2|");
  expect(text(html)).toContain("|Damage II|1|");
});

it("dims a relic its holder cannot pay to activate, and says what it lacks; one it can pay for is ready", () => {
  const chip = (essence: number) => {
    payer.essence = essence;
    const markup = renderToStaticMarkup(
      <CompactEntityInventory
        resources={holding([[ResourcesIds.DamageRelic2, 1]])}
        recipientType={RelicRecipientType.Explorer}
        entityId={70}
        entityType={EntityType.ARMY}
        allowRelicActivation
      />,
    );
    return new DOMParser().parseFromString(markup, "text/html").querySelector("button")!;
  };
  const short = chip(200);
  expect(short.dataset.state).toBe("held");
  expect(short.getAttribute("data-tip")).toBe(
    "Activate · Damage II: Increases damage by 40% for 30m. Costs 500 Essence to activate; you have 200.",
  );
  const ready = chip(500);
  expect(ready.dataset.state).toBe("ready");
});
