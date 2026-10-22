import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { useEffect, useState } from "react";

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
 * - the deploy order closes the surface and stands over the card.
 *
 * A card a later panel stands over stays hidden until the selection opens another (`card` is the card's key, null while
 * the selection opens none). A surface stands over any card showing when it opens, whether the press let go of its
 * tile or not: a selected army keeps its spire card with no tile selected, and the army's sheet selects the army, whose
 * spire card would otherwise come back over it.
 */
export const useOnePanel = (card: string | null) => {
  const [surface, setSurface] = useState<HudSurface | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const deploying = useUIStore((state) => state.leftNavigationView === LeftView.MilitaryView);
  // What the last render saw, and whether a surface opened since: what opened is what changed.
  const [seen, setSeen] = useState<{ card: string | null; deploying: boolean }>({ card: null, deploying: false });
  const [surfacePressed, setSurfacePressed] = useState(false);

  const openSurface = (next: HudSurface | null) => {
    if (next) {
      letGoOfTheTile();
      closeDeployOrder();
      setSurfacePressed(true);
    }
    setSurface(next);
  };

  if (card !== seen.card || deploying !== seen.deploying || surfacePressed) {
    const cardOpened = card !== null && card !== seen.card;
    const deployOpened = deploying && !seen.deploying;
    setSeen({ card, deploying });
    setSurfacePressed(false);
    if (card === null) setHidden(null);
    if (surfacePressed) setHidden(card);
    else if (cardOpened) setSurface(null);
    else if (deployOpened) {
      setSurface(null);
      setHidden(card);
    }
  }

  const showsCard = card !== null && card !== hidden;
  // A card opened over a deploy order closes the order.
  useEffect(() => {
    if (deploying && showsCard) closeDeployOrder();
  }, [deploying, showsCard]);

  /** Back to the rail's home: the surface, the tapped tile with its card, and the deploy order all go. */
  const goHome = () => {
    letGoOfTheTile();
    closeDeployOrder();
    setSurface(null);
  };
  // Nothing stands in the rail's panel: its feed shows.
  const home = surface === null && !showsCard && !deploying;

  return { surface, openSurface, showsCard, home, goHome };
};

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
