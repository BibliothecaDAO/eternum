import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useDayEndStore } from "@/hooks/store/use-day-end-store";
import { SCREENS } from "@/tokens";
import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { DayDoneCard } from "@/ui/features/frontier/rollover/day-done-card";
import { DayEndScreen } from "@/ui/features/frontier/rollover/day-end-screen";

import { dayEndSummary } from "./fixture";
import { DayEndStage, type DayEndCase } from "./stage";
import "./view.css";

const CASES: Record<DayEndCase, string> = {
  ordinary: "In the game: the block clock follows",
  together: "In the game: both clocks at once",
  "late-block": "In the game: the block clock late",
  later: "Opened after it ended",
};
const isCase = (name: string | null): name is DayEndCase => name !== null && Object.hasOwn(CASES, name);

/**
 * The Frontier day end (`/lab/day-end`), as the game plays it: the game's rollover turning the day on a lab clock over
 * the game's Frontier day facts, its moment (use-day-end-store), its screen and card over the lab's land, the spires'
 * veil, the black and the new day's land. `case=ordinary|together|late-block|later` sets how the day ends, and
 * `panel=0` (with `capture=1`) shows nothing but the moment. A window narrower than a desktop plays it as a phone
 * does: the summary a sheet, the realm framed above it.
 */
export function DayEndLabView() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("case");
  const how: DayEndCase = isCase(requested) ? requested : "ordinary";
  const panel = params.get("panel") !== "0";
  const forceWebGL = params.get("rendererMode") === "webgpu-force-webgl";
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<DayEndStage | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { phase, continueDay, showSummary } = useDayEndStore();
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const setQuery = (name: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(name, value);
      return next;
    });

  useEffect(() => {
    let active = true;
    let renderer: ProceduralTerrainDebugRendererHandle | null = null;
    setReady(false);
    setError(null);
    const dayEnd = new DayEndStage();
    void mountProceduralTerrainDebugRenderer({
      canvas: canvas.current!,
      captureMode: false,
      stage: dayEnd,
      gameMode: "frontier",
      forceWebGL,
      qualityTier: "detail",
      revealProgress: 0,
      sceneId: "all-biomes",
      texturedGround: true,
      onError: (reason) => active && setError(String(reason)),
      onReady: () => {},
    })
      .then((mounted) => {
        renderer = mounted;
        if (!active) return mounted.dispose();
        stage.current = dayEnd;
        (window as DayEndWindow).__dayEnd = dayEnd;
        setReady(true);
      })
      .catch((reason) => active && setError(String(reason)));
    return () => {
      active = false;
      stage.current = null;
      delete (window as DayEndWindow).__dayEnd;
      renderer?.dispose();
    };
  }, [forceWebGL]);

  // The lab's ended day always has a summary to read.
  useEffect(() => {
    showSummary(true);
  }, [showSummary]);
  // A new choice starts from the day as it was played.
  useEffect(() => {
    if (ready) stage.current?.rest(isPhone());
  }, [ready, how]);

  return (
    <main className="day-end-lab" data-day-end-lab data-ready={ready} data-phase={phase}>
      <div className="day-end-screen">
        <canvas ref={canvas} aria-label="The map at the day's end" />
        <DayEndScreen summary={<DayDoneCard {...dayEndSummary(now, continueDay)} />} />
      </div>
      {panel && (
        <aside className="day-end-panel" aria-label="Day end controls">
          <h1>Frontier day end</h1>
          <p role="status">{error ?? (!ready ? "Building the land…" : `Phase · ${phase}`)}</p>
          <section>
            <h2>How the day ends</h2>
            {(Object.keys(CASES) as DayEndCase[]).map((name) => (
              <button key={name} aria-pressed={how === name} onClick={() => setQuery("case", name)}>
                {CASES[name]}
              </button>
            ))}
          </section>
          <section className="day-end-row">
            <button
              className="primary"
              disabled={!ready || phase !== "day"}
              onClick={() => stage.current?.endTheDay(how)}
            >
              End the day
            </button>
            <button disabled={!ready} onClick={() => stage.current?.rest(isPhone())}>
              Reset
            </button>
          </section>
          {how === "late-block" && (
            <section className="day-end-row">
              <button disabled={!ready} onClick={() => stage.current?.blockArrives()}>
                Block arrives
              </button>
            </section>
          )}
          <section>
            <h2>What the rollover did</h2>
            {ready &&
              (stage.current?.status().events ?? []).map((event, index) => (
                <p key={index}>
                  {event.kind} · during {event.phase}
                </p>
              ))}
          </section>
          <p className="day-end-help">Space or Esc skips the mist to the summary; Continue goes on into the new day.</p>
        </aside>
      )}
    </main>
  );
}

type DayEndWindow = Window & { __dayEnd?: DayEndStage };

/** Narrower than a desktop, as the HUD's `lg:` reads it. */
const isPhone = () => !window.matchMedia(`(min-width: ${SCREENS.lg})`).matches;
