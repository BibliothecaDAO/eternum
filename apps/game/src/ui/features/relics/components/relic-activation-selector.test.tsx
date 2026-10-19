// @vitest-environment jsdom
import { EntityType, RelicRecipientType, ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";

// Army 4294967297 of realm 7 (Egonal), holding Stamina Relic I; its stamina is read as the fixture sets it.
const army = vi.hoisted(() => ({ stamina: { current: 120, max: 120 } }));
const ARMY_ID = 4294967297;

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: {}, systemCalls: {} }, account: { account: null } }),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({
    structure: {
      getName: () => ({ name: "Egonal" }),
      getEntityInfo: (id: number) =>
        id === ARMY_ID ? { name: { name: "Veil Brands" }, explorer: { owner: 7, troops: {} } } : null,
    },
  }),
}));
vi.mock("@/hooks/use-fact-view", () => ({
  useFactView: () => [{ entityId: 7, structure: {} }],
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1_000 }));
vi.mock("@/lib/army-stamina/source-resolution", () => ({
  getExplorerStaminaSnapshot: () => army.stamina,
}));
vi.mock("@/ui/features/military/components/troop-chip", () => ({ TroopChip: () => null }));
vi.mock("../hooks/use-relic-activation", () => ({
  useRelicMetadata: () => ({
    relicInfo: {
      type: "Stamina",
      recipientType: RelicRecipientType.Explorer,
      effectLine: "Increases stamina regeneration by 50% for 3m",
    },
    resourceId: ResourcesIds.StaminaRelic1,
    essenceCost: 250,
  }),
  useRelicEssenceStatus: () => ({ essenceBalance: 850, hasEnoughEssence: true, shortfall: "" }),
  isRelicCompatible: (info: { recipientType: RelicRecipientType }, recipient: RelicRecipientType) =>
    info.recipientType === recipient,
}));

import { RelicActivationSelector } from "./relic-activation-selector";

// Stamina Relic I's rule as the Blitz preset sets it: 250 Essence, for 3 minutes.
beforeEach(() => {
  vi.spyOn(configManager, "getRelicActivation").mockReturnValue({ essenceCost: 250, durationSeconds: 180 });
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const windowText = () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <RelicActivationSelector
        resourceId={ResourcesIds.StaminaRelic1}
        displayAmount="1"
        holders={[
          {
            entityId: ARMY_ID,
            amount: 1,
            recipientType: RelicRecipientType.Explorer,
            entityType: EntityType.ARMY,
          },
        ]}
        onClose={() => {}}
      />,
    ),
  );
  const text = host.textContent ?? "";
  act(() => root.unmount());
  return text;
};

it("names the relic it activates and the army by its realm, never by its id", () => {
  army.stamina = { current: 45, max: 120 };
  const text = windowText();
  expect(text).toContain("Activate Stamina I");
  expect(text).not.toContain("Select Activation Target");
  expect(text).toContain("Army of Egonal");
  expect(text).not.toContain(String(ARMY_ID));
  expect(text).not.toContain("Stamina is full");
});

it("warns before a stamina relic is spent on an army whose stamina is already full", () => {
  army.stamina = { current: 120, max: 120 };
  const text = windowText();
  expect(text).toContain("Stamina is full");
  expect(text).toContain("it helps only if the army spends stamina while it works");
});
