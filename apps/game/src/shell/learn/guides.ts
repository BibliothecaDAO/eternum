import type { IconCode } from "@/ui/design-system/kit/kit-icon";

import type { AgeMode } from "../play/ages";
import { LEARN_WORDS } from "../words";

/** The docs site, where each mode's rules are written down (apps/game-docs). */
export const DOCS = "https://docs.realms.world";

/**
 * One guide per mode, Frontier's first, each under its kit mark (Frontier's the open book: the guide's own mark is the
 * in-match guide's); Dominion has none yet.
 */
export const MODE_GUIDES: readonly { mode: AgeMode; title: string; icon: IconCode; url: string }[] = [
  { mode: "frontier", title: LEARN_WORDS.howFrontier, icon: "Dk", url: `${DOCS}/frontier/introduction` },
  { mode: "blitz", title: LEARN_WORDS.howBlitz, icon: "Pl", url: `${DOCS}/blitz/key-concepts` },
  { mode: "eternum", title: LEARN_WORDS.howEternum, icon: "Cs", url: `${DOCS}/eternum/key-concepts` },
];

/** Guides players wrote, each by its author. */
export const PLAYER_GUIDES: readonly { title: string; source: string; url: string }[] = [
  {
    title: "Getting Started Tutorial",
    source: "@lordcumberlord",
    url: "https://x.com/lordcumberlord/status/1986947491640598776",
  },
  {
    title: "Resource Management Guide",
    source: "@lordcumberlord",
    url: "https://x.com/lordcumberlord/status/1990719396113707225",
  },
  {
    title: "Combat Tactics Deep Dive",
    source: "@lordcumberlord",
    url: "https://x.com/lordcumberlord/status/2011095751196360980",
  },
  {
    title: "Complete Guide (English)",
    source: "nexonik & tsuaurym",
    url: "https://docs.google.com/document/d/e/2PACX-1vQch9CAmt9zXc7bwFuvdCOWz0x9IzLbZlgvOMX96xV7lWza1d3dLMHpaWaDa6eAo5rasaC4KtpPpGuP/pub",
  },
  {
    title: "Guia Completo (Portuguese)",
    source: "nexonik & tsuaurym",
    url: "https://docs.google.com/document/d/e/2PACX-1vQlOxLQ5snLk23-2rsla4tPh8I5ijNaecYl1r_Dgk-9-An42Sos4HVl2EQGr0P1avW-W94qIwM4QrJn/pub",
  },
];
