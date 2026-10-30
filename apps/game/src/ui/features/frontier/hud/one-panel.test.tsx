import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The outcome of each army order the test sends, settled by the test. */
const waitForAction = vi.fn();
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  requireActiveGameClient: () => ({ waitForAction }),
}));

import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { useOnePanel, useOrderSettledReturnsToTheArmy } from "./one-panel";

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

describe("the deploy order is its realm's (owner, 27 October 2026: 'click another army without deploying we should close the deploy')", () => {
  const REALM = 7;
  const ARMY = 201;
  /** The map's selection, as a tap or the dock sets it. */
  const select = (entityId: number | null) =>
    useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: entityId } }));
  /** Deploy opened for the realm, the realm selected on the map, as the dock's Deploy or a lit tile opens it. */
  const deployFromRealm = () => {
    useUIStore.setState({
      pendingMilitaryAction: { structureId: REALM, isExplorer: true },
      leftNavigationView: LeftView.MilitaryView,
    });
    select(REALM);
  };
  afterEach(() => {
    select(null);
    useUIStore.setState({ pendingMilitaryAction: null });
  });

  it.each([
    ["another army is tapped", ARMY],
    ["the map lets the realm go", null],
  ])("closes when %s, and the new selection stands", (_, next) => {
    act(() => deployFromRealm());
    expect(open()).toEqual(["deploy"]);

    act(() => select(next));

    expect(open()).toEqual([]);
    expect(useUIStore.getState().pendingMilitaryAction).toBeNull();
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(next);
  });

  it("stays while its realm stays selected (another lit tile aims it again)", () => {
    act(() => deployFromRealm());
    act(() => select(REALM));
    act(() => tap(null));
    expect(open()).toEqual(["deploy"]);
  });

  it("opens over an army selected before it: the realm it selects keeps it open", () => {
    act(() => select(ARMY));
    act(() => deployFromRealm());
    expect(open()).toEqual(["deploy"]);
  });
});

// Audit 10-27 (phone): Research, Feed, Menu and Season stayed open when the player tapped the map above them.
describe("on a phone, a tap on the map puts the open page away", () => {
  const PhoneHud = () => {
    const { surface, openSurface } = useOnePanel(null, true);
    return (
      <>
        <button type="button" onClick={() => openSurface("research")}>
          Research
        </button>
        {surface && <section aria-label={surface} />}
      </>
    );
  };
  afterEach(() => useUIStore.getState().selectOnMap(null));

  it("even on empty ground, which picks that tile", () => {
    act(() => root.render(<PhoneHud />));
    act(() => openResearch());
    expect(open()).toEqual(["research"]);

    act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 12, row: 9 } }));

    expect(open()).toEqual([]);
  });
});

describe("an order settled gives the panel back to its army (owner, 30 October 2026: 'I'd like the army panel to be opened after the fight ends')", () => {
  const ARMY = 201;
  const TARGET = { col: 4, row: 5 };
  const selection = () => useUIStore.getState().mapSelection;
  /**
   * The HUD as frontier-hud.tsx wires it: the card of what the army acts on (its tile), and the way back to the army
   * (useArmyPanelOpens' returnTo: the army on its own tile, its panel opened).
   */
  const ArmyHud = () => {
    const picked = useUIStore((state) => state.mapSelection);
    const card =
      picked?.kind === "hex"
        ? `chest@${picked.hex.col},${picked.hex.row}`
        : picked?.kind === "army" && typeof picked.tile === "object" && picked.tile
          ? `card@${picked.tile.col},${picked.tile.row}`
          : null;
    const { surface, openSurface, showsCard } = useOnePanel(card, false);
    useOrderSettledReturnsToTheArmy(card, {
      returnTo: (armyId) => {
        if (!armyStands) return false;
        useUIStore.getState().selectOnMap({ kind: "army", entityId: armyId, tile: "own" });
        openSurface("army");
        return true;
      },
      showLoss: () => openSurface("army-lost"),
    });
    return (
      <>
        {surface && <section aria-label={surface} />}
        {showsCard && <section aria-label={card ?? ""} />}
      </>
    );
  };
  /** The army selected on the map, acting on `on` (its card opens), then an order sent; returns how to settle it. */
  const orderGiven = (what: Parameters<typeof sendOnce<"army">>[2], on: typeof TARGET | null = TARGET) => {
    let settle: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    act(() => root.render(<ArmyHud />));
    act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: on }));
    const sent = sendOnce("army", ARMY, what, () => Promise.resolve({ transaction_hash: "0x1" }) as never).catch(
      () => null,
    );
    return async (outcome: unknown) => {
      await act(async () => {
        settle(outcome);
        await sent;
      });
    };
  };
  const APPLIED = { hash: "0x1", block: 9, status: "SUCCEEDED" };
  const REFUSED = { hash: "0x1", block: 9, status: "REVERTED", revertReason: "Army is resting" };

  /** Whether the army is still on the map when its order settles (returnTo's own check, from the store). */
  let armyStands = true;
  afterEach(() => {
    armyStands = true;
    act(() => useUIStore.getState().selectOnMap(null));
  });

  it("shows the loss in the panel's place when an attack cost the army its life, never the army's panel", async () => {
    const settle = orderGiven({ order: "attack" });
    armyStands = false;
    await settle(APPLIED);
    expect(open()).toEqual(["army-lost"]);
  });

  it("tells nothing when a trade merged the army away: its sheet has done its job", async () => {
    const settle = orderGiven({ order: "move" });
    armyStands = false;
    await settle(APPLIED);
    expect(open()).not.toContain("army-lost");
    expect(open()).not.toContain("army");
  });

  it.each([
    ["an attack (a site, an army, a structure)", { order: "attack" as const }],
    ["a Shrine or a Well used", { order: "use" as const }],
    ["a chest opened", { order: "use" as const }],
    ["the spire entered", { order: "move" as const }],
    ["troops traded with a neighbouring army", { order: "move" as const }],
  ])("after %s, the army's panel stands, its card put away", async (_kind, what) => {
    const settle = orderGiven(what);
    expect(open()).toEqual(["card@4,5"]);
    await settle(APPLIED);
    // The army stays selected; its panel, a surface, lets go of the tile the card stood on.
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
    expect(open()).toEqual(["army"]);
  });

  it("after a chest opened from its tile's card (a phone taps the chest, which lets go of the army): the army's panel", async () => {
    let settle: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    act(() => root.render(<ArmyHud />));
    act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: TARGET }));
    expect(open()).toEqual(["chest@4,5"]);
    const sent = sendOnce("army", ARMY, { order: "use" }, () => Promise.resolve({ transaction_hash: "0x1" }) as never);
    await act(async () => {
      settle(APPLIED);
      await sent;
    });
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
    expect(open()).toEqual(["army"]);
  });

  it("after an order the game refused too: the army's panel, the refusal said by its toast", async () => {
    const settle = orderGiven({ order: "attack" });
    await settle(REFUSED);
    expect(open()).toEqual(["army"]);
  });

  it("keeps the card after a move toward its target (the card's own Move beside a guard): Attack is its next step", async () => {
    const settle = orderGiven({ order: "move", to: TARGET });
    await settle(APPLIED);
    expect(selection()).toEqual({ kind: "army", entityId: ARMY, tile: TARGET });
    expect(open()).toEqual(["card@4,5"]);
  });

  it.each([
    ["a move", { order: "move" as const, to: TARGET }],
    ["an explore", { order: "explore" as const, to: TARGET }],
  ])("leaves the selection as it is after %s given on the map, with no card", async (_kind, what) => {
    const settle = orderGiven(what, null);
    await settle(APPLIED);
    expect(selection()).toEqual({ kind: "army", entityId: ARMY, tile: null });
    expect(open()).toEqual([]);
  });

  it.each([
    ["let go of the army", null],
    ["picked another army", { kind: "army", entityId: 202, tile: "own" }],
    ["picked another tile for it", { kind: "army", entityId: ARMY, tile: { col: 9, row: 9 } }],
  ] as const)("keeps the player's newer choice when they %s while the order was out", async (_choice, newer) => {
    const settle = orderGiven({ order: "attack" });
    act(() => useUIStore.getState().selectOnMap(newer as never));
    await settle(APPLIED);
    expect(selection()).toEqual(newer);
    expect(open()).not.toContain("army");
  });
});
