import { Icon } from "@/ui/design-system/icon";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { RESEARCH, RESEARCH_TREE, SEASON } from "@/ui/design-system/kit/words";

/**
 * Drafts for the desktop's round places at the foot (owner, 2026-10-26: "I'm not too sure about the bottom round buttons
 * anymore"). Today's three bubbles do three things, two of which another control already does: Research opens its page
 * in the rail; Feed closes whatever the rail has open (each page has its own way back); Season opens the season's board,
 * as the top bar's name chip does. So each draft keeps Research reachable and drops the two repeats:
 *
 *   - today: the three bubbles;
 *   - bar: one slim labelled bar, Research and Season, its words always shown;
 *   - realm: Research a button of the realm panel, the realm's own; nothing at the foot;
 *   - none: nothing replaces them; Research opens from what it improves (a building on the board, Next up's step when a
 *     tier can be bought, the R key).
 *
 * A phone keeps its place bar in every draft: it is the phone's launcher, and the mobile pass owns it.
 */
export type LauncherOption = "today" | "bar" | "realm" | "none";

export const LAUNCHER_OPTIONS: readonly { option: LauncherOption; name: string; line: string }[] = [
  { option: "today", name: "Today", line: "Research, Feed and Season as round buttons at the foot" },
  { option: "bar", name: "D · One labelled bar", line: "Research and Season in one slim bar; Feed goes" },
  { option: "realm", name: "E · Research in the realm panel", line: "Nothing at the foot; Research is the realm's" },
  { option: "none", name: "F · Nothing", line: "Research opens from the board, Next up and R" },
];

/** D: the foot's one bar, Research lit while a tier can be bought, Season beside it. */
export const LauncherBar = ({ researchReady }: { researchReady: boolean }) => (
  <nav aria-label="Places" data-lab="launcher-bar" className="ui ui-panel pointer-events-auto rounded-full px-1.5 py-1">
    <div className="flex items-center gap-1">
      <BarButton icon="research" word={RESEARCH} lit={researchReady} />
      <span aria-hidden className="h-5 w-px bg-hud-divider" />
      <BarButton icon="victory" word={SEASON} />
    </div>
  </nav>
);

const BarButton = ({ icon, word, lit = false }: { icon: "research" | "victory"; word: string; lit?: boolean }) => (
  <button
    type="button"
    className="relative flex items-center gap-1.5 rounded-full px-3 py-1 text-hud-strong text-hud-ink hover:bg-hud-hover"
  >
    <Icon name={icon} size={22} />
    {word}
    {lit && <span aria-label={RESEARCH_TREE.states.ready} className="size-2 rounded-full bg-hud-good" />}
  </button>
);

/** E: Research as the realm panel's own row, under its stores, lit while a tier can be bought. */
export const RealmResearchRow = ({ researchReady }: { researchReady: boolean }) => (
  <div data-lab="launcher-realm" className="ui ui-panel pointer-events-auto px-3 py-2">
    <div className="flex items-center gap-2">
      <Icon name="research" size={26} />
      <span className="flex-1 text-hud-strong text-hud-ink">{RESEARCH}</span>
      <HudButton kind="secondary">{researchReady ? RESEARCH_TREE.states.ready : RESEARCH}</HudButton>
    </div>
  </div>
);
