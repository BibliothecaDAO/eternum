import { Link } from "react-router-dom";

import { AppPanel } from "@/ui/design-system/kit/app-elements";

import { WHATS_NEW_OPTIONS } from "./whats-new-options";

/** Shipped games' patch notes, desktop then mobile: how each lays out a release, and what we take from it. */
const REFERENCES = [
  {
    game: "League of Legends",
    platform: "Desktop",
    layout: "A banner of the patch's highlights, then Champions, Items, Systems; bug fixes last.",
    lines: "Each champion's portrait, one line of why, then every number as old ⇒ new.",
    lesson: "Every number that moved shows where it was and where it is.",
  },
  {
    game: "Apex Legends",
    platform: "Desktop",
    layout: "One section per mode (Battle Royale, Ranked, Mixtape) under the mode's art.",
    lines: "Short lines under the mode they change; changes for all modes first.",
    lesson: "A section per mode, so a player reads only the game they play.",
  },
  {
    game: "Age of Empires IV",
    platform: "Desktop",
    layout: "General, then one section per civilization under its emblem.",
    lines: "The unit's icon on each change, old and new values, developer notes boxed.",
    lesson: "The troop or building a change touches is its picture.",
  },
  {
    game: "Dota 2",
    platform: "Desktop",
    layout: "General, Items, Heroes; a hero's portrait heads its changes, a filter jumps to one.",
    lines: "One line per change, the number's old and new.",
    lesson: "Let a player jump to what they play.",
  },
  {
    game: "Clash Royale",
    platform: "Mobile",
    layout: "One card per change on its card art, the balance figure beside it.",
    lines: "A percentage in green (buff) or red (nerf); nothing else.",
    lesson: "On a phone a change is one picture and one figure.",
  },
  {
    game: "Marvel Snap",
    platform: "Mobile",
    layout: "In-game News holds the patch notes and the studio's posts together.",
    lines: "The card's old and new text side by side.",
    lesson: "One place for what changed and what the studio writes.",
  },
  {
    game: "Against the Storm",
    platform: "Desktop",
    layout: "A named release with its date, then New content, Balance, Bug fixes.",
    lines: "Plain lines under three kinds, in that fixed order.",
    lesson: "Three kinds of change, always in the same order.",
  },
] as const;

const SOURCES = [
  { label: "League of Legends patch notes", url: "https://www.leagueoflegends.com/en-us/news/game-updates/" },
  { label: "Apex Legends news", url: "https://www.ea.com/games/apex-legends/apex-legends/news" },
  { label: "Age of Empires news", url: "https://www.ageofempires.com/news/" },
  { label: "Dota 2 patches", url: "https://www.dota2.com/patches" },
  { label: "Clash Royale blog", url: "https://supercell.com/en/games/clashroyale/blog/" },
  { label: "Marvel Snap", url: "https://www.marvelsnap.com/" },
  { label: "Against the Storm on Steam", url: "https://store.steampowered.com/news/app/1336490" },
] as const;

/** The system the options share, whichever page the owner picks. */
const SYSTEM = [
  {
    part: "One file per release",
    what: "apps/game/content/patch-notes/<date>.md: its name, day and one-line summary, then ## Frontier, ## Blitz, ## Eternum, each with ### New, ### Balance, ### Fixes, one change per line with its icon and, for a number, old → new.",
  },
  {
    part: "Checked, then generated",
    what: "A generator (the Scroll's, which already renders content/scroll) refuses an unknown mode, kind or icon and writes src/shell/generated/patch-notes.ts; CI refuses a committed copy its files no longer render to.",
  },
  {
    part: "One editor, per release",
    what: "The docs lane writes a release's file from what merged since the last one, every number read from the preset. Nobody appends a line with their change.",
  },
  {
    part: "Deleted",
    what: "latest-features.ts (3,499 lines, 484 entries, 8 of them shown) and its rule in apps/game/AGENTS.md that told every change to append to it; Latest changes and its word. The docs site's changelog (8 pages) becomes these same files at gate 4.",
  },
] as const;

/**
 * /lab/kit/patch-notes: the research behind What's new's patch notes, the system they run on, and the page three ways,
 * each opened whole in the app lab's frame.
 */
export const PatchNotesLab = () => (
  <main data-surface="shell" className="min-h-dvh bg-kit-ground px-4 py-6 font-body text-kit-cream">
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-app-title text-app-ink">Patch notes</h1>
        <p className="text-app-body text-app-muted">
          What's new remade around patch notes for Frontier, Blitz and Eternum, beside the Scroll.
        </p>
      </header>
      <AppPanel title="Research: shipped games' patch notes" flush>
        <table className="w-full border-collapse text-left align-top text-app-label text-app-ink">
          <thead className="text-app-muted">
            <tr>
              {["Game", "Layout", "A change", "Lesson"].map((column) => (
                <th key={column} className="border-b border-app-line px-4 py-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REFERENCES.map((reference) => (
              <tr key={reference.game} className="align-top">
                <td className="w-44 border-b border-app-line px-4 py-2">
                  <b className="text-app-strong">{reference.game}</b>
                  <br />
                  <span className="text-app-muted">{reference.platform}</span>
                </td>
                <td className="border-b border-app-line px-4 py-2">{reference.layout}</td>
                <td className="border-b border-app-line px-4 py-2">{reference.lines}</td>
                <td className="border-b border-app-line px-4 py-2 text-[rgb(var(--app-accent))]">{reference.lesson}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="flex flex-wrap gap-3 px-4 py-3 text-app-label">
          {SOURCES.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="underline">
              {source.label}
            </a>
          ))}
        </p>
      </AppPanel>
      <AppPanel title="The system">
        <dl className="flex flex-col gap-3 text-app-body text-app-ink">
          {SYSTEM.map((part) => (
            <div key={part.part} className="grid grid-cols-[12rem_minmax(0,1fr)] gap-3">
              <dt className="text-app-strong">{part.part}</dt>
              <dd>{part.what}</dd>
            </div>
          ))}
        </dl>
      </AppPanel>
      <AppPanel title="The page, three ways">
        <ul className="flex flex-col gap-2 text-app-body">
          {Object.entries(WHATS_NEW_OPTIONS).map(([key, option]) => (
            <li key={key}>
              <Link to={`/lab/app/home/whats-new/${key}`} className="text-app-strong underline">
                {option.name}
              </Link>
            </li>
          ))}
        </ul>
      </AppPanel>
    </div>
  </main>
);
