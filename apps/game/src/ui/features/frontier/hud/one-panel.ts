import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { useEffect, useRef, useState } from "react";

import { closeFightResult } from "../sites/fight-result";
import type { HudSurface } from "./frontier-nav";

/**
 * The one place that decides what Frontier has open (owner, 20 October 2026: "it opens panel over panel this is bad
 * UI/UX"): a HUD surface (a page, the Menu, a sheet one of them opens), the card of what the map has selected
 * (useSelectionCard), or the deploy order. The one opened last stands alone, and opening one puts the others away, so
 * no panel ever opens over another:
 *
 * - a surface lets go of the tapped tile and its card, and closes the deploy order;
 * - a new card (a new tap) closes the surface and the deploy order;
 * - on a phone, a new pick on the map (an army, or the tile its order or transfer is pinned on) closes the surface, so
 *   the action row that answers the pick stands where the surface stood;
 * - the deploy order closes the surface and stands over the card;
 * - the deploy order is its realm's: a pick of anything else, or letting the realm go, closes it (owner, 27 October
 *   2026: "when i click this but then click another army without deploying we should close the deploy and bring up the
 *   selected army").
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
  const pick = useUIStore((state) => mapPick(state.entityActions));
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
 * What the map has picked for the action row to answer: the army selected, and the tile its order or transfer is
 * pinned on. Null while nothing is picked.
 */
const mapPick = ({
  selectedEntityId,
  hoveredHex,
}: {
  selectedEntityId: unknown;
  hoveredHex: { col: number; row: number } | null;
}): string | null =>
  selectedEntityId === null || selectedEntityId === undefined
    ? null
    : `${String(selectedEntityId)}@${hoveredHex ? `${hoveredHex.col},${hoveredHex.row}` : ""}`;

/** The tapped tile, plot or building let go, with its card and an attack result standing in it. */
const letGoOfTheTile = () => {
  const ui = useUIStore.getState();
  closeFightResult();
  ui.closeSelectedTile();
  ui.setSelectedBuildingHex(null);
};

/** The deploy order put away: its pending action and its sheet. */
export const closeDeployOrder = () => {
  const ui = useUIStore.getState();
  ui.setPendingMilitaryAction(null);
  ui.setLeftNavigationView(LeftView.None);
};
