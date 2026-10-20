import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { mountStaticLineup, type LineupSettings } from "@/three/debug/model-lab/static-model-lineup";
import { BEAST_NAMES, RUIN } from "@/ui/design-system/kit/words";
import { SITE_CONCEPTS, SITE_STUDIES, MIST_STRESS_SITES, BEAST_STRESS_SITES } from "./frontier-site-studies";
import "./workshop-model-lab.css";
import "./frontier-site-lab.css";

/** The final encounter map in the production renderer, beside its recorded predecessor. */
export function FrontierSiteLab() {
  const [params, setParams] = useSearchParams();
  const population = params.get("population");
  const idleStress = population === "128";
  const stress = idleStress || population === "100";
  const lineup = idleStress ? BEAST_STRESS_SITES : stress ? MIST_STRESS_SITES : SITE_STUDIES;
  const index = Number(params.get("focus"));
  const focus =
    params.has("focus") && Number.isInteger(index) && index >= 0 && index < lineup.length ? index : "lineup";
  const settings: LineupSettings = {
    focus,
    distance: focus === "lineup" ? (stress ? 32 : 16) : 3.5,
    yaw: Number(params.get("yaw") ?? 0),
    lighting: params.get("lighting") === "sunset" ? "sunset" : "day",
  };
  const latest = useRef(settings);
  latest.current = settings;
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<Awaited<ReturnType<typeof mountStaticLineup>> | null>(null);
  const [status, setStatus] = useState("Loading final sites…");
  const [ready, setReady] = useState(false);
  const [mist, setMist] = useState(true);
  const [idle, setIdle] = useState(true);
  const [measuring, setMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState<unknown>(null);
  useEffect(() => {
    const controller = new AbortController();
    let mounted: typeof renderer.current = null;
    setReady(false);
    void mountStaticLineup(host.current!, latest.current, controller.signal, lineup)
      .then((value) => {
        mounted = value;
        if (controller.signal.aborted) return value.dispose();
        renderer.current = value;
        value.update(latest.current);
        setReady(true);
        setStatus("Final map · production models, motion and mist");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Frontier site lab failed", error instanceof Error ? error.stack : error);
          setStatus(`Error: ${String(error)}`);
        }
      });
    return () => {
      controller.abort();
      mounted?.dispose();
      renderer.current = null;
    };
  }, [lineup]);
  useEffect(() => {
    renderer.current?.update(latest.current);
  }, [settings.focus, settings.yaw, settings.lighting]);
  useEffect(() => {
    renderer.current?.setMistVisible(mist);
  }, [mist, ready]);
  useEffect(() => {
    renderer.current?.setBeastMotionEnabled(idle);
  }, [idle, ready]);
  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (key === "focus" && value === "lineup") next.delete("focus");
      else next.set(key, value);
      if (key === "population") next.delete("focus");
      return next;
    });
  const measure = async () => {
    if (!renderer.current || !stress || measuring) return;
    const active = renderer.current;
    setMeasuring(true);
    setMeasurement(null);
    const runs = [];
    try {
      for (const enabled of [false, true, true, false, false, true]) {
        if (idleStress) {
          active.setMistVisible(true);
          active.setBeastMotionEnabled(enabled);
        } else active.setMistVisible(enabled);
        await active.measureFrames(30);
        runs.push({ enabled, ...(await active.measureFrames(90)) });
      }
      setMeasurement({
        method:
          "Synchronized WebGL frame cost (render plus GPU completion), milliseconds; 30 warm-up and 90 sampled frames per run",
        effect: idleStress ? "idle" : "mist",
        beasts: lineup.length,
        mist: idleStress ? true : undefined,
        runs,
      });
    } catch (error) {
      setMeasurement({ error: String(error) });
    } finally {
      active.setMistVisible(mist);
      active.setBeastMotionEnabled(idle);
      setMeasuring(false);
    }
  };
  return (
    <main className="workshop-lab frontier-site-lab" data-site-studies-ready={ready}>
      <header>
        <Link to="?family=beasts">Species and plates</Link>
        <h1>Final Frontier sites</h1>
        <label>
          Scene{" "}
          <select
            aria-label="Scene"
            value={idleStress ? "128" : stress ? "100" : "8"}
            disabled={measuring}
            onChange={(e) => change("population", e.target.value)}
          >
            <option value="8">Final map</option>
            <option value="100">100 ruins · mist check</option>
            <option value="128">128 beasts · idle check</option>
          </select>
        </label>
        <label>
          View{" "}
          <select
            aria-label="Site view"
            value={focus}
            disabled={measuring}
            onChange={(e) => change("focus", e.target.value)}
          >
            <option value="lineup">Whole map</option>
            {lineup.map((site, i) => (
              <option key={i} value={i}>
                {site.label || `${RUIN} ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Turn{" "}
          <select
            aria-label="Turn"
            value={settings.yaw}
            disabled={measuring}
            onChange={(e) => change("yaw", e.target.value)}
          >
            {[0, 30, 90, 180, 270].map((yaw) => (
              <option key={yaw} value={yaw}>
                {yaw}°
              </option>
            ))}
          </select>
        </label>
        <label>
          Light{" "}
          <select
            aria-label="Light"
            value={settings.lighting}
            disabled={measuring}
            onChange={(e) => change("lighting", e.target.value)}
          >
            <option value="day">Day</option>
            <option value="sunset">Sunset</option>
          </select>
        </label>
        <label>
          <input
            aria-label="Ground mist"
            type="checkbox"
            checked={mist}
            disabled={measuring}
            onChange={(e) => setMist(e.target.checked)}
          />{" "}
          Ground mist
        </label>
        <label>
          <input
            aria-label="Beast idle"
            type="checkbox"
            checked={idle}
            disabled={measuring}
            onChange={(e) => setIdle(e.target.checked)}
          />{" "}
          Beast idle
        </label>
        {stress && (
          <button disabled={!ready || measuring} onClick={() => void measure()}>
            {measuring ? "Measuring…" : idleStress ? "Measure idle cost" : "Measure mist cost"}
          </button>
        )}
      </header>
      <p role="status">{status}</p>
      <div className="frontier-site-lab-body">
        <div ref={host} className="workshop-lab-canvas" />
        <aside aria-label="Production comparison">
          <figure>
            <a
              className="frontier-site-baseline"
              href="/lab/frontier-beasts/production-before.png"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="/lab/frontier-beasts/production-before.png"
                alt="Previous five production beasts captured in the game renderer"
              />
            </a>
            <figcaption>Before · recorded production lineup</figcaption>
          </figure>
          <p>
            Current models are live on their tiles. The image above records the previous deliveries before replacement.
          </p>
          {SITE_CONCEPTS.map((species) => (
            <figure key={species} data-site-concept={species}>
              <a href={`/lab/frontier-beasts/${species}-concept.png`} target="_blank" rel="noreferrer">
                <img
                  src={`/lab/frontier-beasts/${species}-concept.png`}
                  alt={`${BEAST_NAMES[species]} selected concept`}
                />
              </a>
              <figcaption>
                <strong>{BEAST_NAMES[species]}</strong>
                <button
                  disabled={stress || measuring}
                  onClick={() => change("focus", String(SITE_STUDIES.findIndex(({ id }) => id === species)))}
                >
                  Show on tile
                </button>
              </figcaption>
            </figure>
          ))}
          {measurement !== null && <pre data-effect-measurement>{JSON.stringify(measurement)}</pre>}
        </aside>
      </div>
      <footer>
        Two roaming beasts. {BEAST_NAMES.troll} at every depth. {BEAST_NAMES["dark-fey"]} above rifts. Four ruin
        guardians in the original masonry, with ground mist.
      </footer>
    </main>
  );
}
