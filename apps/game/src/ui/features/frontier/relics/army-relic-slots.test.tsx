import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentBlockTimestamp: () => 1_000 }));

import { GameProvider } from "@/hooks/context/game-context";
import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents } from "@/hooks/store/use-story-events-store";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";
import { RELIC_WORDS } from "@/ui/design-system/kit/words";

import { campBeside } from "../sites/site-fixture";
import { ArmyRelicSlots } from "./army-relic-slots";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  resetGameSyncStoryEvents();
  vi.useRealTimers();
});

const armyWithRelics = () => {
  const { store } = campBeside();
  configManager.setActiveGame(1);
  store.applyFacts([
    {
      model: "ArmyRelics",
      key: "0xa1",
      value: {
        game_id: 1,
        explorer_id: 201,
        blade: 2,
        ward: 0,
        plunder: 1,
        stamina_regen: 0,
        antidote: 3,
      },
    },
    {
      model: "ArmyRelicEffect",
      key: "0xa2",
      value: { game_id: 1, explorer_id: 201, kind: "Ward", rank: 3, expires_at: 2_800 },
    },
    {
      model: "ArmyRelicEffect",
      key: "0xa3",
      value: { game_id: 1, explorer_id: 201, kind: "Plunder", rank: 2, expires_at: 900 },
    },
  ] as never);
  return store;
};

const draw = (store: ReturnType<typeof armyWithRelics>) => {
  const apply = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <GameProvider
        value={{ store, systemCalls: { apply_relic: apply } } as unknown as GameClientSetup}
        account={{ address: "0x111", account: {} } as never}
      >
        <ArmyRelicSlots explorerId={201} />
      </GameProvider>,
    ),
  );
  return { host, apply };
};

it("renders the 5-slot dock with Roman tier gems, active summary, and selected action tray", () => {
  const { host } = draw(armyWithRelics());
  expect(host.querySelector("[data-relics-summary]")?.textContent).toBe(RELIC_WORDS.activeCount(1, 5));
  const slots = [...host.querySelectorAll("[data-relic-slot]")].map((node) => node.getAttribute("data-relic-slot"));
  expect(slots).toEqual(["Blade", "Ward", "Plunder", "StaminaRegen", "Antidote"]);
  expect(host.querySelector('[data-relic-running="Ward"]')?.textContent).toBe("30m");
  expect(host.querySelector('[data-relic-slot="Blade"] .ui-tier')?.textContent).toBe("II");
  expect(host.querySelector('[data-relic-slot="Antidote"] .ui-tier')?.textContent).toBe("III");
  expect(host.textContent).not.toMatch(/\bR[1-5]\b/);
  expect(host.textContent).not.toMatch(/free to activate anywhere/i);
  expect(host.textContent).not.toMatch(/blocks pickup while active/i);
});

it("activates the selected relic kind with expected_rank and opens the tier ladder tooltip", async () => {
  const { host, apply } = draw(armyWithRelics());
  act(() => host.querySelector<HTMLButtonElement>('[data-relic-slot="Plunder"]')!.click());
  const info = host.querySelector<HTMLButtonElement>(
    `button[aria-label="${RELIC_WORDS.tierInfoLabel(RELIC_WORDS.kinds.Plunder)}"]`,
  )!;
  act(() => info.click());
  const ladder = host.querySelector('[data-relic-ladder="Plunder"]');
  expect(ladder?.textContent).toContain(RELIC_WORDS.mergeHint);
  expect(ladder?.querySelectorAll(".relic-ladder__row").length).toBe(nativeRuleConstants.ATTRIBUTE_CAP);
  const activate = host.querySelector<HTMLButtonElement>(
    `button[aria-label="${RELIC_WORDS.switchOn} Common ${RELIC_WORDS.kinds.Plunder}"]`,
  )!;
  await act(async () => activate.click());
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 201, kind: "Plunder", expected_rank: 1 }));
});

it("plays the 3-beat merge upgrade moment when RelicCollected merges a matching tier", () => {
  vi.useFakeTimers();
  const store = armyWithRelics();
  const { host } = draw(store);
  act(() => {
    store.applyFacts([
      {
        model: "ArmyRelics",
        key: "0xa1",
        value: { game_id: 1, explorer_id: 201, blade: 3, ward: 0, plunder: 1, stamina_regen: 0, antidote: 3 },
      },
    ] as never);
    acceptGameSyncStoryEvent(
      {
        model: "StoryEvent",
        key: "0x1",
        value: {
          game_id: 1,
          owner: "0x111",
          entity_id: 201,
          timestamp: 1_000,
          tx_hash: "0x99",
          event_position: { block_number: 5, transaction_hash: "0x99", transaction_index: 0, event_index: 1 },
          story: {
            RelicCollected: {
              explorer_id: 201,
              site_id: 90,
              kind: "Blade",
              found_rank: 2,
              previous_rank: 2,
              result_rank: 3,
              outcome: "Merged",
            },
          },
        },
      },
      { chainId: "0x1", worldAddress: "0x1", gameId: 1 },
    );
  });
  expect(host.querySelector('[data-relic-collect-badge="Merged"]')?.getAttribute("data-merge-beat")).toBe("1");
  expect(host.querySelector('[data-relic-slot="Blade"]')?.getAttribute("data-merge-beat")).toBe("1");
  act(() => vi.advanceTimersByTime(400));
  expect(host.querySelector('[data-relic-slot="Blade"]')?.getAttribute("data-merge-beat")).toBe("2");
  act(() => vi.advanceTimersByTime(450));
  expect(host.querySelector('[data-relic-slot="Blade"]')?.getAttribute("data-merge-beat")).toBe("3");
  expect(host.querySelector('[data-relic-collect-badge="Merged"]')?.textContent).toContain(
    RELIC_WORDS.mergedCallout("II", "III"),
  );
  act(() => {
    acceptGameSyncStoryEvent(
      {
        model: "StoryEvent",
        key: "0x2",
        value: {
          game_id: 1,
          owner: "0x222",
          entity_id: 999,
          timestamp: 1_001,
          tx_hash: "0x9a",
          event_position: { block_number: 6, transaction_hash: "0x9a", transaction_index: 0, event_index: 1 },
          story: {
            RelicCollected: {
              explorer_id: 999,
              site_id: 91,
              kind: "Ward",
              found_rank: 1,
              previous_rank: 0,
              result_rank: 1,
              outcome: "Collected",
            },
          },
        },
      },
      { chainId: "0x1", worldAddress: "0x1", gameId: 1 },
    );
  });
  act(() => vi.advanceTimersByTime(4_000));
  expect(host.querySelector('[data-relic-collect-badge="Merged"]')).toBeNull();
});

it("shows nothing for an army that carries and runs no relic", () => {
  const { store } = campBeside();
  configManager.setActiveGame(1);
  store.applyFacts([
    {
      model: "ArmyRelics",
      key: "0xa1",
      value: { game_id: 1, explorer_id: 201, blade: 0, ward: 0, plunder: 0, stamina_regen: 0, antidote: 0 },
    },
  ] as never);
  const { host } = draw(store as never);
  expect(host.innerHTML).toBe("");
});
