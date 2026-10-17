import type { ResourceManager } from "@bibliothecadao/eternum";
import { EntityType, RelicRecipientType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ resources: { getTiers: () => ({}) } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1 }));
vi.mock("@/ui/features/relics/components/relic-activation-selector", () => ({ RelicActivationSelector: () => null }));
// A relic's hover line reads the game's relic rules; relic-words is the one place that words it.
vi.mock("@/ui/features/relics/relic-words", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/features/relics/relic-words")>()),
  relicLine: (relicId: number, essenceHeld?: number) =>
    essenceHeld === undefined ? `relic ${relicId}` : `relic ${relicId}; you have ${essenceHeld}`,
  coversRelicCost: (_relicId: number, essenceHeld?: number) => essenceHeld !== undefined && essenceHeld >= 500,
}));
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
      variant="tight"
      filter="relics"
    />,
  );
  expect(text(html)).toContain("|2|Stamina I|");
  expect(text(html)).toContain("|1|Damage II|");
});

it("sizes a tight row's relic chips to what they hold, so a few relics stay within the card", () => {
  const chips = (variant: "tight" | "default") =>
    [
      ...new DOMParser()
        .parseFromString(
          renderToStaticMarkup(
            <CompactEntityInventory
              resources={holding([
                [ResourcesIds.StaminaRelic1, 1],
                [ResourcesIds.DamageRelic1, 1],
                [ResourcesIds.ExplorationRelic1, 1],
              ])}
              recipientType={RelicRecipientType.Explorer}
              variant={variant}
              filter="relics"
            />,
          ),
          "text/html",
        )
        .querySelectorAll("[data-tip]"),
    ].map((chip) => chip.classList.contains("h-full"));
  // A layout engine stretches an h-full chip to an unrelated ancestor's height; jsdom lays nothing out, so the class is
  // what is checked: grid cells share their row's height, tight chips never stretch.
  expect(chips("tight")).toEqual([false, false, false]);
  expect(chips("default")).toEqual([true, true, true]);
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
  expect(short.className).toContain("opacity-60");
  expect(short.className).not.toContain("animate-relic-ready");
  expect(short.getAttribute("data-tip")).toBe(`Activate · relic ${ResourcesIds.DamageRelic2}; you have 200`);
  const ready = chip(500);
  expect(ready.className).toContain("animate-relic-ready");
  expect(ready.className).not.toContain("opacity-60");
});
