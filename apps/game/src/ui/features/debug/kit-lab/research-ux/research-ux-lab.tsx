import { useEffect, useState } from "react";

import { LAUNCHER_OPTIONS } from "./launcher-options";
import { RESEARCH_OPTIONS } from "./research-options";

/** Each draft's HUD lab state: the shipped page or the draft, in the HUD's own frame (/lab/kit/hud/<state>). */
const RESEARCH_STATES = {
  today: "research",
  "choice-first": "research-choice-first",
  cards: "research-cards",
  overlay: "research-overlay",
} as const;
const LAUNCHER_STATES = { today: "idle", bar: "launch-bar", realm: "launch-realm", none: "launch-none" } as const;

const DESKTOP = { width: 1600, height: 900, scale: 0.42 };
const PHONE = { width: 390, height: 844, scale: 0.6 };

/**
 * Dev only: the research panel and foot-place drafts side by side for the owner's pick, at /lab/kit/research-ux. Each
 * frame is the live HUD lab state at a desktop and a phone size; open one whole from its link.
 */
export const ResearchUxLab = () => (
  <div data-lab="research-ux" className="ui min-h-screen bg-hud-surface p-4 text-hud-ink">
    <h1 className="text-hud-title">Research panel and the foot's round buttons: drafts</h1>
    <p className="max-w-3xl text-hud-body text-hud-muted">
      Owner, 26 October: “I dont like how the research panel is it's too long like you need to click a building then
      scroll to see the choices” and “I'm not too sure about the bottom round buttons anymore”. Each draft runs on the
      game's own tree for a realm some days in.
    </p>
    <h2 className="mt-6 text-hud-title">Research panel</h2>
    {RESEARCH_OPTIONS.map(({ option, name, line }) => (
      <DraftRow key={option} name={name} line={line} state={RESEARCH_STATES[option]} phone />
    ))}
    <h2 className="mt-6 text-hud-title">The desktop's round buttons</h2>
    {LAUNCHER_OPTIONS.map(({ option, name, line }) => (
      <DraftRow key={option} name={name} line={line} state={LAUNCHER_STATES[option]} />
    ))}
  </div>
);

const DraftRow = ({
  name,
  line,
  state,
  phone = false,
}: {
  name: string;
  line: string;
  state: string;
  phone?: boolean;
}) => (
  <section className="mt-4 flex flex-col gap-2">
    <div className="flex items-baseline gap-3">
      <span className="text-hud-strong">{name}</span>
      <span className="text-hud-label text-hud-muted">{line}</span>
      <a
        className="text-hud-label text-hud-accent underline"
        href={`/lab/kit/hud/${state}`}
        target="_blank"
        rel="noreferrer"
      >
        Open
      </a>
    </div>
    <div className="flex flex-wrap items-start gap-4">
      <Frame state={state} size={DESKTOP} />
      {phone && <Frame state={state} size={PHONE} />}
    </div>
  </section>
);

/** A live HUD lab state at a size, scaled to the lab's width where a phone opens the page. */
const Frame = ({ state, size }: { state: string; size: { width: number; height: number; scale: number } }) => {
  const scale = Math.min(size.scale, (useViewportWidth() - PAGE_GUTTERS) / size.width);
  return (
    <div
      className="overflow-hidden rounded-md border border-hud-line"
      style={{ width: size.width * scale, height: size.height * scale }}
    >
      <iframe
        title={`${state} at ${size.width}×${size.height}`}
        src={`/lab/kit/hud/${state}`}
        loading="lazy"
        style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      />
    </div>
  );
};

/** The page's side padding, both sides: what a frame leaves of the window's width. */
const PAGE_GUTTERS = 32;

const useViewportWidth = () => {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return width;
};
