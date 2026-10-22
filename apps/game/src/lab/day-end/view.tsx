import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { CONTINUE, DAY, DAY_DONE, DAY_OPEN, REALM_KEPT, tomorrowLasts } from "@/ui/design-system/kit/words";
import { DayEnds } from "@/ui/features/frontier/day-ends";
import { DayTotalsGrid } from "@/ui/features/frontier/log/day-totals";

import { DAY_END_FIXTURE } from "./fixture";
import { restingDay, summaryDocked, type DayEndArrival, type DayEndDirection, type DayEndState } from "./sequence";
import { DayEndStage } from "./stage";
import "./view.css";

const DIRECTIONS: Record<DayEndDirection, { label: string; line: string }> = {
  night: { label: "A · Nightfall", line: "The summary rises over the map as the mist rolls; Continue drops to black." },
  dawn: {
    label: "B · Dawn",
    line: "The mist rolls under one line, black on its own, the summary docked on the new day.",
  },
};
const ARRIVALS: Record<DayEndArrival, string> = { live: "In the game as the day ends", later: "Opened after it ended" };

/**
 * The Frontier day end as a moment (`/lab/day-end`): the day's summary over the live map, the spires' mist rolling out
 * from their orbs over everything but the realm, the screen dropping to black and coming back up on the new day's land.
 * The address holds the choice: `direction=night|dawn`, `arrival=live|later`, `phone=1` frames it as a phone, and
 * `panel=0` (with `capture=1`) shows nothing but the moment.
 */
export function DayEndLabView() {
  const [params, setParams] = useSearchParams();
  const direction: DayEndDirection = params.get("direction") === "dawn" ? "dawn" : "night";
  const arrival: DayEndArrival = params.get("arrival") === "later" ? "later" : "live";
  const phone = params.get("phone") === "1";
  const panel = params.get("panel") !== "0";
  const forceWebGL = params.get("rendererMode") === "webgpu-force-webgl";
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<DayEndStage | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DayEndState>(restingDay(direction, arrival));
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
    const dayEnd = new DayEndStage((next) => active && setState(next));
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

  // A new choice starts from the day as it was played.
  useEffect(() => {
    if (ready) stage.current?.rest(direction, arrival, phone);
  }, [ready, direction, arrival, phone]);

  useDayEndKeys(stage, state);

  return (
    <main className="day-end-lab" data-day-end-lab data-ready={ready} data-phase={state.phase} data-phone={phone}>
      <div className="day-end-screen" data-direction={state.direction}>
        <canvas ref={canvas} aria-label="The map at the day's end" />
        <Moment state={state} onContinue={() => stage.current?.continueDay()} onSkip={() => stage.current?.skip()} />
      </div>
      {panel && (
        <aside className="day-end-panel" aria-label="Day end controls">
          <h1>Frontier day end</h1>
          <p role="status">{error ?? (!ready ? "Building the land…" : `Phase · ${state.phase}`)}</p>
          <section>
            <h2>Direction</h2>
            {(Object.keys(DIRECTIONS) as DayEndDirection[]).map((name) => (
              <button key={name} aria-pressed={direction === name} onClick={() => setQuery("direction", name)}>
                <b>{DIRECTIONS[name].label}</b>
                <span>{DIRECTIONS[name].line}</span>
              </button>
            ))}
          </section>
          <section>
            <h2>The player</h2>
            {(Object.keys(ARRIVALS) as DayEndArrival[]).map((name) => (
              <button key={name} aria-pressed={arrival === name} onClick={() => setQuery("arrival", name)}>
                {ARRIVALS[name]}
              </button>
            ))}
            <button aria-pressed={phone} onClick={() => setQuery("phone", phone ? "0" : "1")}>
              Phone frame
            </button>
          </section>
          <section className="day-end-row">
            <button
              className="primary"
              disabled={!ready || state.phase !== "day"}
              onClick={() => stage.current?.endTheDay()}
            >
              End the day
            </button>
            <button disabled={!ready} onClick={() => stage.current?.rest(direction, arrival, phone)}>
              Reset
            </button>
          </section>
          <p className="day-end-help">
            Space or Esc skips what plays, Enter continues. The map's controls come back with the new day.
          </p>
        </aside>
      )}
    </main>
  );
}

type DayEndWindow = Window & { __dayEnd?: DayEndStage };

/** What the screen shows over the map in each phase: the line, the summary, the black and the way past it. */
function Moment({ state, onContinue, onSkip }: { state: DayEndState; onContinue: () => void; onSkip: () => void }) {
  const night = state.direction === "night";
  const docked = summaryDocked(state);
  return (
    <>
      <div className="day-end-dim" data-on={state.phase === "summary" && state.arrival === "later"} />
      {!night && state.phase === "veil" && <DayLine endedDay={DAY_END_FIXTURE.endedDay} />}
      {(state.phase === "summary" || docked) && (
        <div className="day-end-card" data-placement={docked ? "docked" : "centre"}>
          <Summary onContinue={onContinue} />
        </div>
      )}
      <div className="day-end-black" data-phase={state.phase} />
      {(state.phase === "veil" || state.phase === "dawn") && (
        <button className="day-end-skip ui" onClick={onSkip}>
          Skip
        </button>
      )}
    </>
  );
}

/** The dawn direction's one line over the mist: the day done, the realm kept. */
const DayLine = ({ endedDay }: { endedDay: number }) => (
  <div className="day-end-line ui" role="status">
    <h2 className="text-hud-display">
      {DAY} {endedDay} {DAY_DONE}
    </h2>
    <p className="text-hud-strong">
      {REALM_KEPT} · {DAY} {endedDay + 1} {DAY_OPEN}
    </p>
  </div>
);

/** Today's card, as the game draws it (the same words, chips and totals grid), placed over the map. */
function Summary({ onContinue }: { onContinue: () => void }) {
  const { endedDay, totals, secondsLeft, tomorrowSeconds } = DAY_END_FIXTURE;
  const endsAt = Math.floor(Date.now() / 1000) + secondsLeft;
  return (
    <section className="ui" aria-label={`${DAY} ${endedDay} ${DAY_DONE}`}>
      <HudPanel collapsible={false} bodyClassName="flex flex-col items-center gap-2 py-1">
        <h2 className="text-hud-display">
          {DAY} {endedDay} {DAY_DONE}
        </h2>
        <p className="text-hud-strong">
          {REALM_KEPT} · {DAY} {endedDay + 1} {DAY_OPEN}
        </p>
        <DayEnds endsAt={endsAt} secondsLeft={secondsLeft} tone="calm" />
        <p className="flex items-center justify-center gap-1 text-hud-strong">
          <SemanticIcon name="hourglass" size={18} />
          <span>{tomorrowLasts(tomorrowSeconds).words}</span>
          <b className="tabular-nums">{tomorrowLasts(tomorrowSeconds).reading}</b>
        </p>
        <div className="w-full">
          <DayTotalsGrid totals={totals} />
        </div>
        <div className="grid w-full">
          <HudButton kind="primary" onClick={onContinue}>
            {CONTINUE}
          </HudButton>
        </div>
      </HudPanel>
    </section>
  );
}

/** Space and Escape skip what plays; Enter is the summary's Continue. */
function useDayEndKeys(stage: React.RefObject<DayEndStage | null>, state: DayEndState) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Escape") stage.current?.skip();
      else if (event.key === "Enter" && (state.phase === "summary" || summaryDocked(state)))
        stage.current?.continueDay();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, state]);
}
