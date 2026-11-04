import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";

import { FrontierNav, type HudSurface } from "./frontier-nav";
import { useOnePanel } from "./one-panel";

vi.mock("../value/campaign-home", () => ({ useCampaignMark: () => null }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("../frontier-home", () => ({ useGoToFrontierPlace: () => vi.fn() }));
vi.mock("../realm-stores", () => ({ useRealmStores: () => null, realmDot: () => undefined }));
vi.mock("../research/research-facts", () => ({ useResearchTree: () => null }));
vi.mock("../research/research-tree", () => ({ canResearchNow: () => false }));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/**
 * A phone's HUD on the map in Ethereal II: the place bar with its view list, the one panel deciding which page stands
 * over the map, and the map's own move, which lets go of the selection as the scene does.
 */
const go = vi.fn(() => useUIStore.getState().selectOnMap(null));
function PhoneHud({ open }: { open: HudSurface }) {
  const { surface, openSurface } = useOnePanel(null, true);
  return (
    <>
      <output data-page>{surface ?? "map"}</output>
      <FrontierNav
        rules={{} as never}
        realm={null}
        board={null}
        layers={{ layers: [0, 1, 2], shown: 2, go }}
        surface={surface}
        onSurface={openSurface}
        events={0}
        unread={0}
      />
      <button onClick={() => openSurface(open)}>Open page</button>
    </>
  );
}
const press = (word: string) =>
  act(() => [...document.querySelectorAll("button")].find((button) => button.textContent === word)!.click());
/** A choice in the open view list, by its word (the slot names the shown layer too). */
const choose = (word: string) =>
  act(() =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="menu"] button')]
      .find((item) => item.textContent === word)!
      .click(),
  );
const page = () => host.querySelector("[data-page]")!.textContent;

it.each(["research", "feed", "chat", "menu"] as const)(
  "a layer choice puts the open %s page away, so the map shows the layer",
  (open) => {
    go.mockClear();
    act(() => root.render(<PhoneHud open={open} />));
    press("Open page");
    expect(page()).toBe(open);
    press("Ethereal II");
    choose("World");
    expect(go).toHaveBeenCalledWith(0);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(page()).toBe("map");
  },
);

it("choosing the layer already shown puts the page away without moving the map", () => {
  go.mockClear();
  act(() => root.render(<PhoneHud open="research" />));
  press("Open page");
  press("Ethereal II");
  choose("Ethereal II");
  expect(go).not.toHaveBeenCalled();
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(page()).toBe("map");
});
