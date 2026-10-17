import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  build: vi.fn(),
  production: vi.fn(),
  military: vi.fn(),
  transfer: vi.fn(),
  refused: new Set<string>(),
}));

vi.mock("@/ui/features/world/containers/left-facets/use-structure-actions", () => ({
  useStructureActions: () =>
    (["build", "production", "military", "transfer"] as const).map((id) => ({
      id,
      label: id,
      active: false,
      refusal: actions.refused.has(id) ? "Starts in 2m" : null,
      onClick: actions[id],
    })),
}));

import { ARMY_SELECT_REQUEST_EVENT, takeArmySelectRequest } from "@/three/scenes/worldmap-army-select-request";
import { getShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";
import { useHudKeys } from "./hud-keys";
import { IdleArmiesButton, idleArmiesRefusal, idleArmyIds, nextIdleArmy } from "./idle-armies";
import { useNextUpShows } from "./next-up-shows";

/** The HUD's keys and its Idle button, with the idle armies as the hook reads them in the view given. */
const Keys = ({ idle = [], onWorldMap = true }: { idle?: number[]; onWorldMap?: boolean }) => {
  const idleArmies = { ids: idle, refusal: idleArmiesRefusal(onWorldMap, idle.length) };
  useHudKeys({ idleArmies });
  return (
    <>
      <IdleArmiesButton idle={idleArmies} />
      <input aria-label="A field" />
      <select aria-label="A choice">
        <option>Smart</option>
      </select>
    </>
  );
};

/** The armies the HUD asks the world map to select, heard until `stop`. */
const hearSelections = () => {
  const ids: number[] = [];
  const hear = () => ids.push(takeArmySelectRequest()!.entityId);
  window.addEventListener(ARMY_SELECT_REQUEST_EVENT, hear);
  return { ids, stop: () => window.removeEventListener(ARMY_SELECT_REQUEST_EVENT, hear) };
};

const idleButton = () => host.querySelector<HTMLButtonElement>('button[aria-keyshortcuts="I"]')!;

let host: HTMLDivElement;
let root: Root;

/** Presses a key as the browser delivers it: on what has focus, or on the page. */
const press = (key: string, on: EventTarget = document.body) =>
  act(() => {
    on.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });

describe("the desktop HUD's keys", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    getShortcutManager();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    vi.clearAllMocks();
    actions.refused.clear();
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useNextUpShows.setState({ showing: false, act: null });
  });

  it("opens Build, Production, Military and Transfer with B, P, M and T", () => {
    act(() => root.render(<Keys />));
    press("b");
    press("p");
    press("m");
    press("t");
    expect(
      [actions.build, actions.production, actions.military, actions.transfer].map((fn) => fn.mock.calls.length),
    ).toEqual([1, 1, 1, 1]);
  });

  it("does nothing while a field has the keyboard, or while the order is shut", () => {
    act(() => root.render(<Keys />));
    press("b", host.querySelector("input")!);
    press("b", host.querySelector("select")!);
    actions.refused.add("military");
    act(() => root.render(<Keys />));
    press("m");
    expect(actions.build).not.toHaveBeenCalled();
    expect(actions.military).not.toHaveBeenCalled();
  });

  it("takes Next up's step with Space, only while it can be taken", () => {
    const step = vi.fn();
    act(() => root.render(<Keys />));
    press(" ");
    useNextUpShows.setState({ act: step });
    press(" ");
    expect(step).toHaveBeenCalledTimes(1);
  });

  it("selects the next idle army with I or the Idle button on the world map", () => {
    const selected = hearSelections();
    act(() => root.render(<Keys idle={[7, 9]} />));
    press("i");
    act(() => idleButton().click());
    selected.stop();
    expect(selected.ids).toEqual([7, 7]);
  });

  it("selects no army from the realm view: I passes, and the Idle button is shut with its reason", () => {
    const selected = hearSelections();
    act(() => root.render(<Keys idle={[7, 9]} onWorldMap={false} />));
    const key = new KeyboardEvent("keydown", { key: "i", bubbles: true, cancelable: true });
    act(() => {
      document.body.dispatchEvent(key);
    });
    act(() => idleButton().click());
    selected.stop();
    expect(selected.ids).toEqual([]);
    expect(key.defaultPrevented).toBe(false);
    expect(idleButton().disabled).toBe(true);
    expect(idleButton().title).toBe("Armies are picked on the world map");
  });
});

describe("an idle army", () => {
  it("is at full stamina with no order out or queued", () => {
    expect(
      idleArmyIds([
        { entityId: 1, stamina: { current: 100, max: 100 }, ordered: false },
        { entityId: 2, stamina: { current: 60, max: 100 }, ordered: false },
        { entityId: 3, stamina: { current: 100, max: 100 }, ordered: true },
        { entityId: 4, stamina: null, ordered: false },
      ]),
    ).toEqual([1]);
  });

  it("comes after the army selected now, and the first again after the last", () => {
    expect(nextIdleArmy([1, 4, 6], null)).toBe(1);
    expect(nextIdleArmy([1, 4, 6], 4)).toBe(6);
    expect(nextIdleArmy([1, 4, 6], 6)).toBe(1);
    expect(nextIdleArmy([], 4)).toBeNull();
  });
});
