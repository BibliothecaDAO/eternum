import { gameRegistryRow } from "../../../../../../../packages/core/src/test-support/game-registry";
import { GAME_FAMILIES } from "../../../../../../../config/source/common/native-preset-modes";
// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { hash } from "starknet";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import release from "../../../../../../../contracts/l3/world-native/schema/release-definition.json";

const fixture = vi.hoisted(() => ({ store: null as unknown as NativeFactStore }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: fixture.store } }) }));
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerDisplayName: () => "Player",
  usePlayerProfile: () => ({ name: null, portrait: null, known: true }),
}));
vi.mock("@/ui/design-system/icon", () => ({ Icon: () => null }));

import { PlayerId } from "./player-id";

const PLAYER = 123n;
const put = (model: string, keys: number[], value: object) =>
  fixture.store.applyFacts([{ model, key: hash.computePoseidonHashOnElements(keys), value }] as never);

let host: HTMLDivElement;
let root: Root;
const draw = () => act(() => root.render(<PlayerId selectedPlayer={PLAYER} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.store = new NativeFactStore();
  fixture.store.setSnapshot({ gameId: 23, complete: true, actor: String(PLAYER), timestamp: 150 });
  configManager.setActiveGame(23);
  put("SliceRules", [23], { ...release.definition.rules, game_id: 23 });
  put(
    "GameRegistry",
    [23],
    gameRegistryRow({
      game_id: 23,
      family: GAME_FAMILIES.blitz,
      start_settling_at: "1",
      start_main_at: "1",
      scheduled_end_at: "200",
      end_at: "200",
    }),
  );
  put("TileOpt", [23, 0, 10, 12], { game_id: 23, alt: false, col: 10, row: 12, data: 2n << 41n });
  put("TileOccupancy", [23, 0, 10, 12], {
    game_id: 23,
    alt: false,
    col: 10,
    row: 12,
    entity_id: 7,
    category: 5,
    is_structure: true,
  });
  put("Structure", [23, 7], {
    game_id: 23,
    entity_id: 7,
    owner: 456n,
    base: {
      category: 2,
      level: 0,
      created_at: 1n,
      troop_max_guard_count: 0,
      troop_max_explorer_count: 0,
      starting_troops_granted: false,
    },
    resources_packed: 0n,
    metadata: { realm_id: 0, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
  });
  configManager.setStore(fixture.store);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("player details render no retired InfoBubble panel", () => {
  draw();
  expect(host.querySelectorAll(".hud-panel")).toHaveLength(0);
});

it("counts the structures the player owns, by kind, the most held first, and none of anyone else's", () => {
  const owned = (entity: number, category: StructureType, mineKind = 0) =>
    put("Structure", [23, entity], {
      game_id: 23,
      entity_id: entity,
      owner: PLAYER,
      base: {
        category,
        level: 0,
        created_at: 1n,
        troop_max_guard_count: 0,
        troop_max_explorer_count: 0,
        starting_troops_granted: false,
      },
      resources_packed: 0n,
      metadata: { realm_id: 0, village_realm: 0, mine_kind: mineKind, deepest_depth: 0, has_wonder: false, order: 0 },
    });
  draw();
  expect(host.querySelector('[aria-label="Structures owned"]')).toBeNull();
  expect(host.textContent).toContain("StructuresNone.");
  act(() => {
    owned(31, StructureType.Realm);
    owned(32, StructureType.Camp);
    owned(33, StructureType.Realm);
    owned(34, StructureType.Mine, 1);
  });
  const rows = [...host.querySelectorAll('[aria-label="Structures owned"] > div')].map((row) => row.textContent);
  expect(rows).toEqual(["Realm2", "Camp1", "Rift1"]);
  // The section's cue is the total; the other player's Hyperstructure 7 is not counted.
  expect(host.textContent).toContain("Structures4");
});
