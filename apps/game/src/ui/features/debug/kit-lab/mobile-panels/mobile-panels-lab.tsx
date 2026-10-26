import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { useHudMode } from "@/hooks/use-hud-mode";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { type Moment, MOMENT_WORDS, MOMENTS, type Option, PHONES, type PhoneSize } from "./moments";
import { OptionScreen } from "./panel-options";

/** Today as shipped, then the three proposals, each one sentence: the owner picks one (reports/mobile-ux-pass-1.md). */
const OPTIONS: { key: Option; name: string; line: string }[] = [
  {
    key: "today",
    name: "Today (as measured live)",
    line: "Every sheet takes half the screen under a 110 px grip and title. Next up stays; the camera leaves the tapped tile under the sheet; Build's verb scrolls out of view.",
  },
  {
    key: "a",
    name: "A · Fit to content",
    line: "A sheet is as tall as what it holds, at most half, under one 44 px title row. Next up folds away while it is open, the verb never scrolls, and the camera puts the tapped tile in the map left open.",
  },
  {
    key: "b",
    name: "B · Peek, then more",
    line: "Every sheet opens as a peek: the one decision and its verb. More opens it whole. The map above stays open while you decide.",
  },
  {
    key: "c",
    name: "C · Cards in the bar's place",
    line: "Recommended. A map action's card stands where the dock and place bar were, so it costs the map little more than the bars did. Reading places (Research, Chat) open as whole pages over the map; the place bar stays to switch.",
  },
];

/** The fixes every option carries (the report's shared list). */
const SHARED = [
  "One sheet head everywhere: a 44 px title row, no separate grip band, one way to close",
  "The verb never scrolls out of view (Build, the castle's Upgrade, the Menu's Exit at 360 px)",
  "Opening a panel folds Next up; it never stays open across places",
  "The camera keeps the acted-on tile and the army in the map left open, after a deploy and an order too",
  "Frontier's own fight card for every site, never Blitz's quick attack and its combat simulator",
  "Slim strip (the switch above): the day's line moves into Today and gives the map 36 px",
];

/** The width under which the page shows one phone at the device's own size instead of four side by side. */
const ONE_PHONE_BELOW_PX = 900;
const GALLERY_SCALE_MAX = 0.72;
const GALLERY_GAP_PX = 20;

/**
 * Dev only: the big panels on a phone, today beside three layouts, at the moments a Frontier player opens them. On a
 * desktop the four phones stand side by side; on a phone the page shows one at the phone's own size, to be held.
 */
export const MobilePanelsLab = () => {
  useHudMode("frontier");
  const [params, setParams] = useSearchParams();
  const moment = (MOMENTS as readonly string[]).includes(params.get("moment") ?? "")
    ? (params.get("moment") as Moment)
    : "build";
  const sizeKey = params.get("size") === "small" ? "small" : "tall";
  const slimStrip = params.get("slim") === "1";
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const go = (next: Moment) => set("moment", next);
  const width = useWindowWidth();

  const controls = (
    <div className="flex flex-wrap items-center gap-1.5">
      {MOMENTS.map((each) => (
        <HudButton
          key={each}
          kind={each === moment ? "secondary" : "quiet"}
          size="sm"
          aria-pressed={each === moment}
          onClick={() => go(each)}
        >
          {MOMENT_WORDS[each]}
        </HudButton>
      ))}
      <span className="mx-2 h-6 w-px bg-hud-line" />
      {(["tall", "small"] as const).map((each) => (
        <HudButton
          key={each}
          kind={each === sizeKey ? "secondary" : "quiet"}
          size="sm"
          aria-pressed={each === sizeKey}
          onClick={() => set("size", each === "tall" ? null : each)}
        >
          {PHONES[each].width}×{PHONES[each].height}
        </HudButton>
      ))}
      <HudButton
        kind={slimStrip ? "secondary" : "quiet"}
        size="sm"
        aria-pressed={slimStrip}
        onClick={() => set("slim", slimStrip ? null : "1")}
      >
        Slim strip
      </HudButton>
    </div>
  );

  if (width < ONE_PHONE_BELOW_PX) {
    const option = (OPTIONS.find(({ key }) => key === params.get("option")) ?? OPTIONS[3]).key;
    const size: PhoneSize = { width, height: window.innerHeight };
    return (
      <main className="bg-hud-dark font-sans text-hud-ink">
        <OptionScreen option={option} moment={moment} size={size} scale={1} slimStrip={slimStrip} go={go} />
        <section className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {OPTIONS.map(({ key, name }) => (
              <HudButton
                key={key}
                kind={key === option ? "secondary" : "quiet"}
                size="sm"
                aria-pressed={key === option}
                onClick={() => set("option", key)}
              >
                {name.split(" ·")[0].split(" (")[0]}
              </HudButton>
            ))}
          </div>
          <p className="m-0 text-hud-body text-hud-muted">{OPTIONS.find(({ key }) => key === option)!.line}</p>
          {controls}
        </section>
      </main>
    );
  }

  const size = PHONES[sizeKey];
  const scale = Math.min(GALLERY_SCALE_MAX, (width - 48 - GALLERY_GAP_PX * 3) / (size.width * 4));
  return (
    <main className="min-h-screen bg-hud-dark px-6 py-5 font-sans text-hud-ink">
      <header className="mb-4 flex flex-col gap-2">
        <h1 className="m-0 text-hud-display">Frontier's panels on a phone</h1>
        <p className="m-0 max-w-[72rem] text-hud-body text-hud-muted">
          Today beside three layouts for the big panels, at the moments a player opens them. Each phone is drawn at its
          own size, scaled to fit; tap the place bar, the dock's + or a panel's X to move between moments. Under each,
          the share of its screen where a tap still reaches the map, measured in the frame. Open this page on a phone to
          hold one option at the phone's own size.
        </p>
        {controls}
      </header>
      <div className="flex flex-wrap items-start" style={{ gap: GALLERY_GAP_PX }}>
        {OPTIONS.map(({ key, name, line }) => (
          <section key={key} className="flex flex-col gap-2" style={{ width: size.width * scale }}>
            <h2 className="m-0 text-hud-title">{name}</h2>
            <OptionScreen option={key} moment={moment} size={size} scale={scale} slimStrip={slimStrip} go={go} />
            <p className="m-0 text-hud-label text-hud-muted">{line}</p>
          </section>
        ))}
      </div>
      <section className="mt-6 max-w-[72rem]">
        <h2 className="m-0 mb-2 text-hud-title">Every option also carries</h2>
        <ul className="m-0 flex flex-col gap-1 pl-5 text-hud-body">
          {SHARED.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
};

const useWindowWidth = () => {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return width;
};
