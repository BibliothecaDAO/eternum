import type { MapSelectionIntent } from "@/hooks/store/map-selection";
import { onOutcome, onSent, type OrderInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { useEffect, useRef, useState } from "react";

import type { HudSurface } from "./frontier-nav";

/**
 * The one place that decides what Frontier has open (owner, 20 October 2026: "it opens panel over panel this is bad
 * UI/UX"): a HUD surface (a page, the Menu, a sheet one of them opens), the card of what the map has selected
 * (useSelectionCard), or the deploy order. The one opened last stands alone, and opening one puts the others away, so
 * no panel ever opens over another:
 *
 * - a surface lets go of the tapped tile and its card, and closes the deploy order;
 * - a new card (a new tap) closes the surface and the deploy order;
 * - on a phone, a new pick on the map (an army, a structure, the tile its order is pinned on, or any tile tapped)
 *   closes the surface, so the map answers the tap where the surface stood (audit 10-27: pages stayed open over a
 *   tap on the map);
 * - the deploy order closes the surface and stands over the card;
 * - the deploy order is its realm's: a pick of anything else, or letting the realm go, closes it (owner, 27 October
 *   2026: "when i click this but then click another army without deploying we should close the deploy and bring up the
 *   selected army").
 *
 * - an order an army was given from a card, on that card's target (an attack, a site used, a chest opened, the spire
 *   entered, troops traded), gives the panel back to the army once it settles, applied or refused (owner,
 *   30 October 2026: "when I fight, since the army stays selected, I'd like the army panel to be opened after the fight
 *   ends"): useOrderSettledReturnsToTheArmy, which the HUD calls beside this, once the
 *   army's opener exists.
 *
 * A card a later panel stands over stays hidden until the selection opens another (`card` is the card's key, null while
 * the selection opens none). A surface stands over any card showing when it opens, whether the press let go of its
 * tile or not: an army standing on its realm's spire keeps the spire's card while it is selected, and the army's sheet
 * selects the army, whose spire card would otherwise come back over it.
 */
export const useOnePanel = (
  card: string | null,
  /**
   * Whether a pick on the map puts the open surface away: a phone's (owner, 22 October 2026: mobile direction A, the
   * map first), where a page or a sheet stands where the action row that answers the pick does. A desktop's surface
   * stands beside the map and stays.
   */
  yieldsToMap = false,
) => {
  const [surface, setSurface] = useState<HudSurface | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  // The desktop rail's Feed, which its × closes (owner, 26 October 2026: "I should also be able to close the feed so I
  // see nothing on the right panel sometimes").
  const [feedOpen, setFeedOpen] = useState(true);
  const deploying = useUIStore((state) => state.leftNavigationView === LeftView.MilitaryView);
  const pick = useUIStore((state) => mapPick(state.entityActions, state.selectedHex));
  const selected = useUIStore((state) => state.entityActions.selectedEntityId ?? null);
  const deployingFrom = useUIStore((state) => state.pendingMilitaryAction?.structureId ?? null);
  // What the last render saw, and whether a surface opened since: what opened is what changed.
  const [seen, setSeen] = useState<{ card: string | null; deploying: boolean; pick: string | null }>({
    card: null,
    deploying: false,
    pick: null,
  });
  const [surfacePressed, setSurfacePressed] = useState(false);

  const openSurface = (next: HudSurface | null) => {
    if (next) {
      letGoOfTheTile();
      closeDeployOrder();
      setSurfacePressed(true);
    }
    setSurface(next);
  };

  if (card !== seen.card || deploying !== seen.deploying || pick !== seen.pick || surfacePressed) {
    const cardOpened = card !== null && card !== seen.card;
    const deployOpened = deploying && !seen.deploying;
    const picked = yieldsToMap && pick !== null && pick !== seen.pick;
    setSeen({ card, deploying, pick });
    setSurfacePressed(false);
    if (card === null) setHidden(null);
    if (surfacePressed) setHidden(card);
    else if (cardOpened || picked) setSurface(null);
    else if (deployOpened) {
      setSurface(null);
      setHidden(card);
    }
  }

  // A new selection that is not the deploy order's realm puts the order away.
  const selectedBefore = useRef(selected);
  useEffect(() => {
    const reselected = selected !== selectedBefore.current;
    selectedBefore.current = selected;
    if (reselected && deploying && (selected === null || Number(selected) !== deployingFrom)) closeDeployOrder();
  }, [selected, deploying, deployingFrom]);

  const showsCard = card !== null && card !== hidden;
  // A card opened over a deploy order closes the order.
  useEffect(() => {
    if (deploying && showsCard) closeDeployOrder();
  }, [deploying, showsCard]);

  /** Back to the rail's home, its Feed open: the surface, the tapped tile with its card, and the deploy order all go. */
  const goHome = () => {
    letGoOfTheTile();
    closeDeployOrder();
    setSurface(null);
    setFeedOpen(true);
  };
  // Nothing stands in the rail's panel: its Feed shows, unless it was closed.
  const home = surface === null && !showsCard && !deploying;

  return { surface, openSurface, showsCard, home, goHome, feedOpen, closeFeed: () => setFeedOpen(false) };
};

/**
 * An order an army was given from a card, on that card's target, gives the panel back to the army when it settles: the
 * army's panel opens where selecting it opens it (returnTo), whether the order applied or was refused, so the card it
 * was given from never outlives its job. The card stood on what the player picked: the army acting on a tile (a fight,
 * a site, the spire, a neighbour to trade troops with), or the target's own tile (a chest tapped on a phone). Only while
 * that pick still stands, or only the map let go of it, its army lost (lostWithItsArmy): a player who let go, picked
 * another army or another tile meanwhile keeps that newer choice.
 * An order that takes the army to a tile (a move or an explore, the card's own Move beside a guard) keeps the card: its
 * next step (Attack) is there. Orders given with no card standing (a move on the map) leave the selection, and the next
 * order queued on it, as they are. An army an attack cost its life gets no panel: the panel shows the loss instead, then
 * closes (showLoss); an army merged away by its trade has nothing to tell, and its sheet closes itself.
 */
export const useOrderSettledReturnsToTheArmy = (
  /** The card standing now (useSelectionCard's key), null while none. */
  card: string | null,
  ways: {
    /** Gives the panel back to the army (useArmyPanelOpens' returnTo); false when the army is no longer on the map. */
    returnTo: (armyId: number) => boolean;
    /** Shows, in the panel's place, that the attack cost the army its life (ArmyLostSheet). */
    showLoss: () => void;
  },
) => {
  const now = useRef({ card, ways });
  useEffect(() => {
    now.current = { card, ways };
  });
  useEffect(() => {
    const givenFrom = new Map<string, { pick: Pick; order: OrderInFlight }>();
    const stopSent = onSent("army", (key, { order, to }) => {
      const pick = useUIStore.getState().mapSelection;
      if (now.current.card !== null && to === undefined && isCardOf(pick, key)) givenFrom.set(key, { pick, order });
    });
    const stopSettled = onOutcome("army", (key) => {
      const from = givenFrom.get(key);
      givenFrom.delete(key);
      if (!from || !(samePick(from.pick, useUIStore.getState().mapSelection) || lostWithItsArmy(key))) return;
      const { returnTo, showLoss } = now.current.ways;
      if (!returnTo(Number(key)) && from.order === "attack") showLoss();
    });
    return () => {
      stopSent();
      stopSettled();
    };
  }, []);
};

type Pick = NonNullable<MapSelectionIntent>;

/**
 * The map let go of the pick itself because this army is gone (letGoOfLostSelection), before its order settled: no
 * player chose anything since, so its outcome still shows.
 */
const lostWithItsArmy = (armyId: string): boolean => {
  const { mapSelection, selectionLostWith } = useUIStore.getState();
  return mapSelection === null && selectionLostWith !== null && String(selectionLostWith) === armyId;
};

/** A pick a card of this army's order stands on: the army itself acting on a tile, or a tile or structure picked. */
const isCardOf = (selection: MapSelectionIntent, armyId: string): selection is Pick =>
  selection !== null && (selection.kind !== "army" || String(selection.entityId) === armyId);

/** The same pick, whichever object the store holds it in. */
const samePick = (before: Pick, after: MapSelectionIntent): boolean => {
  if (after === null || after.kind !== before.kind) return false;
  if (before.kind === "army" && after.kind === "army")
    return before.entityId === after.entityId && sameTile(before.tile, after.tile);
  if (before.kind === "structure" && after.kind === "structure") return before.entityId === after.entityId;
  return before.kind === "hex" && after.kind === "hex" && sameHex(before.hex, after.hex);
};

const sameTile = (before: ArmyTile, after: ArmyTile): boolean =>
  typeof before === "object" && before !== null && typeof after === "object" && after !== null
    ? sameHex(before, after)
    : before === after;

type ArmyTile = Extract<Pick, { kind: "army" }>["tile"];

const sameHex = (before: { col: number; row: number }, after: { col: number; row: number }): boolean =>
  before.col === after.col && before.row === after.row;

/**
 * What the map has picked: the army or structure selected and the tile its order is pinned on, or with none, the tile
 * the player tapped (a tap on empty ground, letting go of what was selected, picks that tile). Null while nothing is.
 */
const mapPick = (
  { selectedEntityId, hoveredHex }: { selectedEntityId: unknown; hoveredHex: { col: number; row: number } | null },
  selectedHex: { col: number; row: number } | null,
): string | null => {
  if (selectedEntityId === null || selectedEntityId === undefined)
    return selectedHex ? `tile@${selectedHex.col},${selectedHex.row}` : null;
  return `${String(selectedEntityId)}@${hoveredHex ? `${hoveredHex.col},${hoveredHex.row}` : ""}`;
};

/** The tapped tile, plot or building let go, with its card; chat keeps what was picked to share (setAsidePick). */
const letGoOfTheTile = () => {
  const ui = useUIStore.getState();
  ui.setTileAsideForSurface();
  ui.setSelectedBuildingHex(null);
};

/** The deploy order put away: its pending action and its sheet. */
export const closeDeployOrder = () => {
  const ui = useUIStore.getState();
  ui.setPendingMilitaryAction(null);
  ui.setLeftNavigationView(LeftView.None);
};
