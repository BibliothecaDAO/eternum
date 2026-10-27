import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { shortString } from "starknet";
import { configManager, readResourceManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup, NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  createSystemCalls,
  EntityType,
  RelicRecipientType,
  RelicRecipientTypeParam,
  ResourcesIds,
  TileOccupier,
} from "@bibliothecadao/types";
import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { CompactEntityInventory } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { RelicActivationPopup } from "@/ui/features/economy/resources/relic-activation-popup";
import { RelicActivationSelector } from "./relic-activation-selector";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { nativePresetForId, nativePresetIdFor } from "../../../../../../../config/source/native";
import explorerFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";

vi.mock("@/audio/hooks/useAudio", () => ({ useAudio: () => ({ play: () => {} }) }));
// The act-now gate on the chain clock: open unless a case shuts it, as before play opens.
const gate = vi.hoisted(() => ({ refusal: null as string | null }));
vi.mock("@/utils/can-issue-orders", async (original) => ({
  ...(await original<typeof import("@/utils/can-issue-orders")>()),
  useActNowRefusal: () => gate.refusal,
}));

const ARMY_ID = 4294967297;
const signer = { address: "0x111" };
let root: Root;
let host: HTMLDivElement;

function game(
  stamina: NativeRows["ExplorerTroops"]["troops"]["stamina"] = {
    Inline: { amount: 45n, settled_at: 350, remainder: 0 },
  },
) {
  const { store } = frontierDay();
  const presetId = nativePresetIdFor("blitz");
  const preset = nativePresetForId(presetId);
  const set = (key: string, model: string, value: unknown) => ({ key, model, value });
  store.applyFacts([
    set("0x100", "SliceRules", {
      ...store.require("SliceRules", { game_id: 1 }),
      day_unit_seconds: 0,
      troop_stamina_config: {
        ...store.require("SliceRules", { game_id: 1 }).troop_stamina_config,
        stamina_knight_max: 120,
        stamina_initial: 120,
      },
    }),
    set("0x3", "GameRegistry", { ...store.require("GameRegistry", { game_id: 1 }), preset_id: presetId }),
    set("0xa1", "RelicRules", { game_id: 1, rules: preset.relics }),
    set("0xa2", "ExplorerTroops", {
      ...explorerFixture.expected.value,
      game_id: 1,
      explorer_id: ARMY_ID,
      owner: 7,
      troops: { ...explorerFixture.expected.value.troops, stamina },
    }),
    set("0xa3", "EntityName", { game_id: 1, entity_id: ARMY_ID, name: shortString.encodeShortString("Veil Brands") }),
    set("0xa4", "ResourceWeight", { game_id: 1, entity_id: ARMY_ID, capacity: "100000000000000", weight: "0" }),
    set("0xa5", "ResourceBalance", {
      game_id: 1,
      entity_id: ARMY_ID,
      resource_type: ResourcesIds.StaminaRelic1,
      balance: "1000000000",
    }),
    set("0xa6", "ResourceBalance", {
      game_id: 1,
      entity_id: 7,
      resource_type: ResourcesIds.Essence,
      balance: "850000000000",
    }),
    set("0xa7", "TileOccupancy", {
      game_id: 1,
      entity_id: 7,
      col: 1,
      row: 1,
      alt: false,
      category: TileOccupier.RealmRegularLevel1,
      is_structure: true,
    }),
    set("0xa8", "TileOccupancy", {
      game_id: 1,
      entity_id: ARMY_ID,
      col: 2,
      row: 1,
      alt: false,
      category: TileOccupier.ExplorerKnightT1,
      is_structure: false,
    }),
  ] as never);
  configManager.setActiveGame(1, presetId);
  configManager.setStore(store);
  const apply_relic = vi.fn().mockResolvedValue(undefined);
  return { store, setup: { store, systemCalls: { apply_relic } } as unknown as GameClientSetup, apply_relic };
}

const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === name)!;

async function openInventory(state: ReturnType<typeof game>) {
  await act(async () =>
    root.render(
      <GameProvider value={state.setup} account={signer as never}>
        <CompactEntityInventory
          resources={readResourceManager(state.store, ARMY_ID)}
          recipientType={RelicRecipientType.Explorer}
          entityId={ARMY_ID}
          entityType={EntityType.ARMY}
          allowRelicActivation
        />
        <SurfaceHost />
      </GameProvider>,
    ),
  );
  const relic = document.querySelector<HTMLButtonElement>('button[data-tip^="Activate · Stamina I"]');
  expect(relic, "the player can click the held relic").not.toBeNull();
  await act(async () => relic!.click());
  return button("Activate");
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  useAccountStore.getState().setGameplayAccount(signer as never, signer.address);
});

afterEach(async () => {
  await act(async () => root.unmount());
  usePopoverStore.getState().close();
  useAccountStore.getState().setGameplayAccount(null, null);
  setBlockTimestampSource(null);
  gate.refusal = null;
  host.remove();
  vi.restoreAllMocks();
});

it("opens the held relic and activates it with native inline troops, without taking down the game", async () => {
  const state = game();
  const confirm = await openInventory(state);
  expect(document.body.textContent).toContain("Activate Stamina I");
  expect(document.body.textContent).toContain("Army of Stolsli");
  expect(document.body.textContent).not.toContain(String(ARMY_ID));
  expect(document.body.textContent).not.toContain("Stamina is full");
  await act(async () => confirm.click());
  expect(state.apply_relic).toHaveBeenCalledTimes(1);
  expect(state.apply_relic).toHaveBeenCalledWith({
    signer,
    entity_id: ARMY_ID,
    relic_resource_id: ResourcesIds.StaminaRelic1,
    recipient_type: RelicRecipientTypeParam.Explorer,
  });
  expect(document.querySelector('[data-popover-panel="relic-activation"]')).toBeNull();
});

it("warns before a stamina relic is spent on an army whose stamina is full", async () => {
  await openInventory(game({ Inline: { amount: 120n, settled_at: 350, remainder: 0 } }));
  expect(document.body.textContent).toContain("Stamina is full");
  expect(document.body.textContent).toContain("Stamina is full");
});

it("keeps missing army facts unavailable, reports them in development, and resumes when they arrive", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const state = game();
  const confirm = await openInventory(state);
  await act(async () =>
    state.store.applyFacts([
      {
        model: "SliceRules",
        key: "0x100",
        value: { ...state.store.require("SliceRules", { game_id: 1 }), day_unit_seconds: 100 },
      },
      {
        model: "GameRegistry",
        key: "0x3",
        value: { ...state.store.require("GameRegistry", { game_id: 1 }), preset_id: 3 },
      },
      {
        model: "ArmySlot",
        key: "0x9",
        value: {
          game_id: 1,
          structure_id: 7,
          epoch: "0",
          slot: 0,
          explorer_id: ARMY_ID,
          stamina: { amount: "30", settled_at: "350", remainder: 0 },
        },
      },
      {
        model: "ExplorerTroops",
        key: "0xa2",
        value: {
          ...state.store.require("ExplorerTroops", { game_id: 1, explorer_id: ARMY_ID }),
          troops: {
            ...state.store.require("ExplorerTroops", { game_id: 1, explorer_id: ARMY_ID }).troops,
            stamina: { Slot: 0 },
          },
        },
      },
    ] as never),
  );
  expect(document.body.textContent).toContain("Army data unavailable. Waiting for synchronization.");
  expect(confirm.disabled).toBe(true);
  expect(warn).toHaveBeenCalledWith("Relic activation is waiting for synchronized army facts", { entityId: ARMY_ID });
  await act(async () => confirm.click());
  expect(state.apply_relic).not.toHaveBeenCalled();
  await act(async () =>
    state.store.applyFacts([
      {
        model: "ArmyProgress",
        key: "0xa9",
        value: {
          common_points: 0,
          uncommon_points: 0,
          rare_points: 0,
          epic_points: 0,
          legendary_points: 0,
          game_id: 1,
          explorer_id: ARMY_ID,
          xp: 0,
          battle: 1,
          logistics: 1,
          scouting: 0,
          scouting_kinds: 0,
          homecoming: 1,
        },
      },
    ] as never),
  );
  expect(document.body.textContent).not.toContain("Army data unavailable");
  expect(button("Activate").disabled).toBe(false);
  expect(document.body.textContent).not.toContain("Stamina is full");
  await act(async () =>
    state.store.applyFacts([
      {
        model: "ArmySlot",
        key: "0x9",
        value: {
          ...state.store.require("ArmySlot", { game_id: 1, structure_id: 7, epoch: 0n, slot: 0 }),
          stamina: { amount: "120", settled_at: "350", remainder: 0 },
        },
      },
    ] as never),
  );
  expect(document.body.textContent).toContain("Stamina is full");
  await act(async () => button("Activate").click());
  expect(state.apply_relic).toHaveBeenCalledTimes(1);
});

it("keeps the open dialog usable when its army disappears, without activating against an unknown holder", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const state = game();
  await openInventory(state);
  await act(async () => state.store.applyFacts([{ model: "ExplorerTroops", key: "0xa2", value: null }]));
  expect(document.body.textContent).toContain("Army data unavailable. Waiting for synchronization.");
  expect(button("Activate").disabled).toBe(true);
  await act(async () => button("Activate").click());
  expect(state.apply_relic).not.toHaveBeenCalled();
});

it("activates from inventory while map occupancy facts are absent", async () => {
  const state = game();
  state.store.applyFacts([
    { model: "TileOccupancy", key: "0xa7", value: null },
    { model: "TileOccupancy", key: "0xa8", value: null },
  ]);
  const confirm = await openInventory(state);
  expect(confirm.disabled).toBe(false);
  await act(async () => confirm.click());
  expect(state.apply_relic).toHaveBeenCalledTimes(1);
});

it("counts the one whole relic the army holds as one, on its target row as in its heading", async () => {
  await openInventory(game());
  expect(document.body.textContent).toMatch(/Veil Brands×1(?!\d)/);
  expect(document.body.textContent).not.toContain("×<1");
});

it("heads the window with every holder's whole relics, and gives each target row its own", async () => {
  const state = game();
  await act(async () =>
    root.render(
      <GameProvider value={state.setup} account={signer as never}>
        <RelicActivationSelector
          resourceId={ResourcesIds.StaminaRelic1}
          holders={[
            { entityId: ARMY_ID, held: 1, recipientType: RelicRecipientType.Explorer, entityType: EntityType.ARMY },
            { entityId: 7, held: 2, recipientType: RelicRecipientType.Structure, entityType: EntityType.STRUCTURE },
          ]}
          onClose={() => {}}
        />
      </GameProvider>,
    ),
  );
  const text = document.body.textContent ?? "";
  expect(text).toMatch(/^Activate Stamina IStamina I×3(?!\d)/);
  expect(text).toMatch(/Veil Brands×1(?!\d)/);
  expect(text.match(/×(\d+|<1)/g)).toEqual(["×3", "×1", "×2"]);
});

/**
 * The game, its relic activations sent through the real system call: refused while the game does not take actions yet
 * ("Starts in 2m 33s") until `open()`, then sent to a provider that answers with `answer`.
 */
const refusingGame = (answer: () => Promise<unknown> = async () => undefined) => {
  const state = game();
  const sent = vi.fn(answer);
  let refusal: string | null = "Starts in 2m 33s";
  const systemCalls = createSystemCalls({
    provider: { apply_relic: sent },
    authHandler: { refuseNow: () => refusal, onError: (error) => console.error(error) },
  });
  const open = () => {
    refusal = null;
  };
  return { ...state, setup: { ...state.setup, systemCalls } as GameClientSetup, sent, open };
};

const renderPopup = (state: ReturnType<typeof refusingGame>) =>
  act(async () =>
    root.render(
      <GameProvider value={state.setup} account={signer as never}>
        <RelicActivationPopup
          entityId={ARMY_ID}
          entityOwnerId={7}
          recipientType={RelicRecipientType.Explorer}
          relicId={ResourcesIds.StaminaRelic1}
          relicBalance={1}
          onClose={() => {}}
        />
      </GameProvider>,
    ),
  );

/** Both relic controls, each opened to its Activate button. */
const CONTROLS = [
  ["the inventory's selector", (state: ReturnType<typeof refusingGame>) => openInventory(state)],
  [
    "the resource controls' popup",
    async (state: ReturnType<typeof refusingGame>) => {
      await renderPopup(state);
      return button("Activate Relic");
    },
  ],
] as const;

/** The lines the window says as news (a status) and as errors (an alert). */
const said = (role: "status" | "alert") =>
  [...document.querySelectorAll(`[role="${role}"]`)].map((line) => line.textContent);

it.each(CONTROLS)(
  "%s: a refused activation is told as news, logs nothing, and goes through once play opens",
  async (_, openControl) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = refusingGame();
    const confirm = await openControl(state);
    await act(async () => confirm.click());
    expect(state.sent).not.toHaveBeenCalled();
    expect(said("status")).toContain("Starts in 2m 33s");
    expect(said("alert")).toEqual([]);
    expect(document.body.textContent).not.toContain("Failed to activate relic");
    expect(logged).not.toHaveBeenCalled();

    state.open();
    expect(confirm.disabled).toBe(false);
    await act(async () => confirm.click());
    expect(state.sent).toHaveBeenCalledTimes(1);
  },
);

it.each(CONTROLS)("%s: a failed activation is told as an error, with the game's reason", async (_, openControl) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const state = refusingGame(() => Promise.reject(new Error("Not enough essence")));
  state.open();
  const confirm = await openControl(state);
  await act(async () => confirm.click());
  expect(state.sent).toHaveBeenCalledTimes(1);
  expect(said("alert")).toEqual(["Not enough essence"]);
});

it.each(CONTROLS)("%s: before play opens, Activate is shut and says why before the click", async (_, openControl) => {
  gate.refusal = "Starts in 2m 33s";
  const state = refusingGame();
  const confirm = await openControl(state);
  expect(confirm.disabled).toBe(true);
  expect(document.body.textContent).toContain("Starts in 2m 33s");
});
