import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
  type ProceduralTerrainDebugStats,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { ENDGAME_VARIATIONS, readEndgameSettings } from "./sequence";
import "./view.css";

/** Compare the same shipped world before and after an end event. */
export function EndgameMistLabView() {
  const [query, setQuery] = useSearchParams();
  const search = query.toString();
  const settings = readEndgameSettings(search);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<ProceduralTerrainDebugRendererHandle | null>(null);
  const [stats, setStats] = useState<ProceduralTerrainDebugStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, showResults] = useState(false);
  const [ready, setReady] = useState(false);
  const choice = ENDGAME_VARIATIONS[settings.variation];
  const change = (name: string, value: string) =>
    setQuery((previous) => {
      const next = new URLSearchParams(previous);
      next.set(name, value);
      return next;
    });
  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    setStats(null);
    showResults(false);
    const mountFrame = window.requestAnimationFrame(() => {
      void mountProceduralTerrainDebugRenderer({
        canvas: canvas.current!,
        captureMode: false,
        endgame: readEndgameSettings(search),
        gameMode: new URLSearchParams(search).get("gameMode") === "frontier" ? "frontier" : "blitz",
        forceWebGL: new URLSearchParams(search).get("rendererMode") === "webgpu-force-webgl",
        qualityTier: "detail",
        revealProgress: 0,
        sceneId: "all-biomes",
        texturedGround: true,
        onError: (reason) => {
          if (active) setError(String(reason));
        },
        onReady: () => {},
      })
        .then((renderer) => {
          if (!active) {
            renderer.dispose();
            return;
          }
          runtime.current = renderer;
          const time = new URLSearchParams(search).get("time");
          if (time !== null) renderer.seekEndgame(Number(time));
          setReady(true);
        })
        .catch((reason) => {
          if (active) setError(String(reason));
        });
    });
    const poll = window.setInterval(() => {
      if (runtime.current) setStats(runtime.current.getStats());
    }, 100);
    return () => {
      active = false;
      window.cancelAnimationFrame(mountFrame);
      clearInterval(poll);
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [search]);
  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        runtime.current?.skipEndgame();
        showResults(false);
      }
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, []);
  const snapshot = stats?.endgame;
  return (
    <main className="endgame-lab" data-ready={ready} data-endgame-lab>
      <canvas ref={canvas} aria-label="Endgame world map" />
      <aside className="endgame-lab-panel">
        <h1>The mist returns</h1>
        <p>Shipped terrain, realms, units and spires. Preview only.</p>
        <label>
          Sequence
          <select
            aria-label="Sequence"
            value={settings.shipped ? "shipped" : settings.variation}
            onChange={(e) =>
              setQuery((previous) => {
                const next = new URLSearchParams(previous);
                next.delete("time");
                next.set("shipped", e.target.value === "shipped" ? "1" : "0");
                if (e.target.value !== "shipped") next.set("variation", e.target.value);
                return next;
              })
            }
          >
            <option value="shipped">Shipped end · 2s</option>
            {Object.entries(ENDGAME_VARIATIONS).map(([id, v]) => (
              <option value={id} key={id}>
                {v.label} · {v.duration}s
              </option>
            ))}
          </select>
        </label>
        <label>
          World
          <select
            aria-label="World mode"
            value={settings.spared === "realm" ? "frontier" : "blitz"}
            onChange={(e) => change("gameMode", e.target.value)}
          >
            <option value="blitz">Blitz · freeze every hex</option>
            <option value="frontier">
              {settings.shipped ? "Frontier · shipped freeze" : "Frontier · spare your realm"}
            </option>
          </select>
        </label>
        <label>
          Spires
          <select
            aria-label="Spire entrance"
            value={settings.spires}
            onChange={(e) => change("spires", e.target.value)}
          >
            <option value="awaken">Discovered · awaken</option>
            <option value="rise">Undiscovered · rise</option>
          </select>
        </label>
        <label>
          Map
          <select
            aria-label="Map population"
            value={settings.busy ? "1" : "0"}
            onChange={(e) => change("busy", e.target.value)}
          >
            <option value="0">Study · 320 hexes, 5 realms</option>
            <option value="1">Busy Blitz · 1,008 hexes, 25 realms</option>
          </select>
        </label>
        <label>
          Renderer
          <select
            aria-label="Renderer"
            value={query.get("rendererMode") ?? "webgpu-auto"}
            onChange={(e) => change("rendererMode", e.target.value)}
          >
            <option value="webgpu-auto">WebGPU</option>
            <option value="webgpu-force-webgl">WebGL</option>
          </select>
        </label>
        <div className="endgame-lab-actions">
          <button className="primary" disabled={!ready} onClick={() => runtime.current?.playEndgame()}>
            End game preview
          </button>
          <button disabled={!ready} onClick={() => runtime.current?.resetEndgame()}>
            Shipped / reset
          </button>
        </div>
        <p className="endgame-lab-phase" role="status">
          {error ??
            (!ready
              ? "Loading shipped world…"
              : `${snapshot?.phase ?? "live"} · ${(snapshot?.seconds ?? 0).toFixed(1)} / ${settings.shipped ? 2 : choice.duration}s`)}
        </p>
        <label>
          Sequence position
          <input
            aria-label="Sequence position"
            type="range"
            min="0"
            max={settings.shipped ? 2 : choice.duration}
            step="0.05"
            value={snapshot?.seconds ?? 0}
            disabled={!ready}
            onChange={(e) => runtime.current?.seekEndgame(Number(e.target.value))}
          />
        </label>
        <p>Drag to pan, scroll to zoom. Escape skips to the frozen map.</p>
        <details>
          <summary>Renderer cost</summary>
          <p>
            {stats?.activeMode} · {stats?.drawCalls ?? 0} draws · {snapshot?.realmCount ?? 0} realms ·{" "}
            {snapshot?.armyCount ?? 0} armies
          </p>
          <p>
            Frame p95 {stats?.frameP95Ms.toFixed(1) ?? "0"} ms · submission p95{" "}
            {snapshot?.renderSubmissionP95Ms.toFixed(2) ?? "0"} ms · n={stats?.frameSampleCount ?? 0}
          </p>
        </details>
      </aside>
      <nav className="endgame-lab-finished" aria-label="End of game">
        <span>Game finished</span>
        <button
          disabled={!ready}
          onClick={() => {
            runtime.current?.skipEndgame();
            showResults(true);
          }}
        >
          See the results
        </button>
        <button disabled={!ready} onClick={() => runtime.current?.skipEndgame()}>
          Skip · Esc
        </button>
      </nav>
      {results && (
        <section className="endgame-lab-results" role="dialog" aria-label="Results fixture">
          <h2>Results</h2>
          <p>Results opens immediately, including during awakening and mist spread.</p>
          <p>This is a local fixture. The live Results page is unchanged.</p>
          <button onClick={() => showResults(false)}>Back to the frozen map</button>
        </section>
      )}
    </main>
  );
}
