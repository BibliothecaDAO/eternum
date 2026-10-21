// @vitest-environment jsdom
import { act, isValidElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";

import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { realmBoard } from "@/ui/features/frontier/build/build-fixture";
import { getGuardsByStructure } from "@bibliothecadao/eternum";
import { GuardSlot } from "@bibliothecadao/types";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { ARMY_DEPLOYMENT_SURFACE_ID } from "../utils/open-army-deployment";
import { structureGuardSlots } from "../utils/defense-slot-utils";
import { CompactDefenseDisplay } from "./compact-defense-display";

const BLITZ_PRESET_ID = 2;

const roots: Root[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  usePopoverStore.getState().close();
  useUIStore.setState({ isSpectating: false });
  document.body.replaceChildren();
});

/**
 * A Blitz realm the chain gave four guard slots, 1,000 troops in slot 1 and the rest never filled, its guard row
 * mounted for its owner or for someone else.
 */
const mountGuards = ({ owner }: { owner: boolean }) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, realm } = realmBoard();
  const game = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([
    { model: "GameRegistry", key: "0x3", value: { ...game, preset_id: BLITZ_PRESET_ID } },
    { model: "Structure", key: "0x7", value: { ...realm, base: { ...realm.base, troop_max_guard_count: 4 } } },
    {
      model: "Guard",
      key: "0x9a0",
      value: {
        game_id: 1,
        structure_id: 7,
        slot: GuardSlot.Delta,
        troops: { ...rowFixture.expected.value.troops, count: String(1_000n * 1_000_000_000n) },
        destroyed_tick: 0,
      },
    },
  ] as never);
  const structure = store.require("Structure", { game_id: 1, entity_id: 7 });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  act(() =>
    root.render(
      <CompactDefenseDisplay
        guards={getGuardsByStructure(structure, store)!}
        slots={structureGuardSlots(structure)}
        structureId={7}
        canManageDefense={owner}
      />,
    ),
  );
  const slots = () => [...host.querySelectorAll("[title^='Defense Slot']")];
  return {
    slots: () =>
      slots().map((slot) => ({ title: slot.getAttribute("title"), words: slot.textContent, tag: slot.tagName })),
    press: (title: string) =>
      act(() => (slots().find((slot) => slot.getAttribute("title") === title) as HTMLElement).click()),
  };
};

/** The guard slot the deploy picker is open on, or null when it is not open. */
const pickerSlot = () => {
  const { openId, surface } = usePopoverStore.getState();
  if (openId !== ARMY_DEPLOYMENT_SURFACE_ID || !isValidElement(surface?.content)) return null;
  return (surface.content.props as { initialGuardSlot?: number }).initialGuardSlot ?? null;
};

it("shows every slot the structure has, the empty ones beside the filled one, the first an attacker meets on the left", () => {
  const guards = mountGuards({ owner: true });
  expect(guards.slots()).toEqual([
    { title: "Defense Slot 4 is empty", words: "Add", tag: "BUTTON" },
    { title: "Defense Slot 3 is empty", words: "Add", tag: "BUTTON" },
    { title: "Defense Slot 2 is empty", words: "Add", tag: "BUTTON" },
    { title: "Defense Slot 1", words: expect.stringContaining("1,000"), tag: "BUTTON" },
  ]);
});

it("opens the deploy picker on the empty slot its owner presses", () => {
  const guards = mountGuards({ owner: true });
  guards.press("Defense Slot 3 is empty");
  expect(pickerSlot()).toBe(GuardSlot.Beta);
});

it("shows another player's empty slots as empty, with nothing to press", () => {
  const guards = mountGuards({ owner: false });
  expect(guards.slots().map(({ words, tag }) => `${tag} ${words}`)).toEqual([
    "DIV Empty",
    "DIV Empty",
    "DIV Empty",
    expect.stringContaining("DIV"),
  ]);
  guards.press("Defense Slot 4 is empty");
  expect(pickerSlot()).toBeNull();
});
