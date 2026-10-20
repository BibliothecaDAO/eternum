import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { mountStaticLineup, type LineupSettings } from "@/three/debug/model-lab/static-model-lineup";
import { BEAST_STUDY_NAMES, RUIN, RIFT } from "@/ui/design-system/kit/words";
import { SITE_CONCEPTS, SITE_STUDIES } from "./frontier-site-studies";
import "./workshop-model-lab.css";
import "./frontier-site-lab.css";

type ConceptGroup = keyof typeof SITE_CONCEPTS;
const CONCEPT_GROUP_NAMES = { weak: "Weak roaming beast", ruin: `${RUIN} · Surface`, rift: RIFT };

/** One scene for the proposed encounter map, with the concept choices beside their tiles. */
export function FrontierSiteLab() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("concepts");
  const conceptGroup: ConceptGroup = requested === "ruin" || requested === "rift" ? requested : "weak";
  const index = Number(params.get("focus"));
  const focus =
    params.has("focus") && Number.isInteger(index) && index >= 0 && index < SITE_STUDIES.length ? index : "lineup";
  const settings: LineupSettings = {
    focus,
    distance: focus === "lineup" ? 16 : 3.5,
    yaw: Number(params.get("yaw") ?? 0),
    lighting: params.get("lighting") === "sunset" ? "sunset" : "day",
  };
  const latest = useRef(settings);
  latest.current = settings;
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<Awaited<ReturnType<typeof mountStaticLineup>> | null>(null);
  const [status, setStatus] = useState("Loading site studies…");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let mounted: typeof renderer.current = null;
    void mountStaticLineup(host.current!, latest.current, controller.signal, SITE_STUDIES)
      .then((value) => {
        mounted = value;
        if (controller.signal.aborted) return value.dispose();
        renderer.current = value;
        value.update(latest.current);
        setReady(true);
        setStatus("Owner choices · game renderer · proposed site map");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(`Error: ${String(error)}`);
      });
    return () => {
      controller.abort();
      mounted?.dispose();
      renderer.current = null;
    };
  }, []);
  useEffect(() => {
    renderer.current?.update(latest.current);
  }, [settings.focus, settings.yaw, settings.lighting]);
  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (key === "focus" && value === "lineup") next.delete("focus");
      else next.set(key, value);
      if (key === "focus" && value !== "lineup") {
        const species = SITE_STUDIES[Number(value)].id;
        const group = Object.entries(SITE_CONCEPTS).find(([, choices]) =>
          (choices as readonly string[]).includes(species),
        );
        if (group) next.set("concepts", group[0]);
      }
      return next;
    });
  return (
    <main className="workshop-lab frontier-site-lab" data-site-studies-ready={ready}>
      <header>
        <Link to="?family=beasts">Beast archive</Link>
        <h1>Frontier site choices</h1>
        <label>
          View{" "}
          <select aria-label="Site view" value={focus} onChange={(e) => change("focus", e.target.value)}>
            <option value="lineup">Whole map</option>
            {SITE_STUDIES.map((site, i) => (
              <option key={site.id} value={i}>
                {site.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Turn{" "}
          <select aria-label="Turn" value={settings.yaw} onChange={(e) => change("yaw", e.target.value)}>
            {[0, 30, 90, 180, 270].map((yaw) => (
              <option key={yaw} value={yaw}>
                {yaw}°
              </option>
            ))}
          </select>
        </label>
        <label>
          Light{" "}
          <select aria-label="Light" value={settings.lighting} onChange={(e) => change("lighting", e.target.value)}>
            <option value="day">Day</option>
            <option value="sunset">Sunset</option>
          </select>
        </label>
      </header>
      <p role="status">{status}</p>
      <div className="frontier-site-lab-body">
        <div ref={host} className="workshop-lab-canvas" />
        <aside aria-label="Site concepts">
          <label>
            Concepts{" "}
            <select aria-label="Concepts" value={conceptGroup} onChange={(e) => change("concepts", e.target.value)}>
              {Object.entries(CONCEPT_GROUP_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p>Pick by the painting, then compare the model on its tile.</p>
          {SITE_CONCEPTS[conceptGroup].map((species) => {
            const modelIndex = SITE_STUDIES.findIndex((site) => site.id === species);
            return (
              <figure key={species} data-site-concept={species}>
                <a href={`/lab/frontier-beasts/${species}-concept.png`} target="_blank" rel="noreferrer">
                  <img
                    src={`/lab/frontier-beasts/${species}-concept.png`}
                    alt={`${BEAST_STUDY_NAMES[species]} concept`}
                  />
                </a>
                <figcaption>
                  <strong>{BEAST_STUDY_NAMES[species]}</strong>
                  {modelIndex >= 0 ? (
                    <button onClick={() => change("focus", String(modelIndex))}>Show on tile</button>
                  ) : (
                    <span>Concept only</span>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </aside>
      </div>
      <footer>
        Weak choices stand alone. The camp is only its beast. The rift keeps its landmark. Ruin masonry and deeper
        guardians are unchanged.
      </footer>
    </main>
  );
}
