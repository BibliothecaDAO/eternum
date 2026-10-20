import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useOnePanel } from "./one-panel";

/**
 * The HUD's three ways to open a panel, as FrontierHud draws them: a surface (Research here, opened by its button), the
 * card of what the map selected (its key stands for the card), and the deploy order. The test reads which panels stand.
 */
const Hud = ({ card }: { card: string | null }) => {
  const { surface, openSurface, showsCard } = useOnePanel(card);
  const deploying = useUIStore((state) => state.leftNavigationView === LeftView.MilitaryView);
  return (
    <>
      <button type="button" onClick={() => openSurface("research")}>
        Research
      </button>
      {surface && <section aria-label={surface} />}
      {showsCard && <section aria-label={`card ${card}`} />}
      {deploying && <section aria-label="deploy" />}
    </>
  );
};

/** A deploy order opened: the view openArmyDeployment turns on in Frontier. */
const deploy = () => useUIStore.setState({ leftNavigationView: LeftView.MilitaryView });

let host: HTMLDivElement;
let root: Root;
/** The map selects a thing whose card has this key (null: nothing with a card). */
const tap = (card: string | null) => root.render(<Hud card={card} />);
const openResearch = () => host.querySelector("button")!.click();
const open = () => [...host.querySelectorAll("section")].map((panel) => panel.getAttribute("aria-label"));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useUIStore.setState({ leftNavigationView: LeftView.None, isSpectating: false });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Hud card={null} />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useUIStore.setState({ leftNavigationView: LeftView.None });
});

describe("Frontier's one panel: the one opened last stands alone", () => {
  it("closes Research when the player taps a camp, and the camp's card when Research opens again", () => {
    act(() => openResearch());
    expect(open()).toEqual(["research"]);

    act(() => tap("camp@4,5"));
    expect(open()).toEqual(["card camp@4,5"]);

    // Research stands over the card even while the map still holds the selection.
    act(() => openResearch());
    expect(open()).toEqual(["research"]);
  });

  it("closes Research and stands over the card when a deploy order opens, and closes on a new tap", () => {
    act(() => tap("camp@4,5"));
    act(() => deploy());
    expect(open()).toEqual(["deploy"]);

    act(() => tap("rift@6,2"));
    expect(open()).toEqual(["card rift@6,2"]);
  });

  it("keeps a surface over a card the same press selected (the army's sheet selects the army at its spire)", () => {
    act(() => {
      tap("spire-depths@3,3");
      openResearch();
    });
    expect(open()).toEqual(["research"]);

    // The next tap opens its own card.
    act(() => tap("camp@4,5"));
    expect(open()).toEqual(["card camp@4,5"]);
  });

  it("shows a card hidden under a later panel again once the selection lets go and comes back", () => {
    act(() => tap("camp@4,5"));
    act(() => deploy());
    act(() => useUIStore.setState({ leftNavigationView: LeftView.None }));
    expect(open()).toEqual([]);

    act(() => tap(null));
    act(() => tap("camp@4,5"));
    expect(open()).toEqual(["card camp@4,5"]);
  });
});
