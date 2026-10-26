import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
  type ProceduralTerrainDebugStats,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { readEndgameSettings } from "./fixture";
import "./view.css";

/** Exercise the production native-fact end trigger and renderer without waiting for a chain game to end. */
export function EndgameMistLabView() {
  const [query, setQuery] = useSearchParams();
  const search = query.toString();
  const settings = readEndgameSettings(search);
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<ProceduralTerrainDebugRendererHandle | null>(null);
  const [stats, setStats] = useState<ProceduralTerrainDebugStats | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null),
    [results, showResults] = useState(false),
    [inspecting, setInspecting] = useState(false);
  const change = (name: string, value: string) =>
    setQuery((previous) => {
      const next = new URLSearchParams(previous);
      next.set(name, value);
      return next;
    });
  useEffect(() => {
    let active = true;
    setReady(false);
    setStats(null);
    setError(null);
    showResults(false);
    setInspecting(false);
    const frame = requestAnimationFrame(() => {
      void mountProceduralTerrainDebugRenderer({
        canvas: canvas.current!,
        captureMode: false,
        endgame: readEndgameSettings(search),
        gameMode: new URLSearchParams(search).get("mode") === "frontier" ? "frontier" : "blitz",
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
          setReady(true);
        })
        .catch((reason) => {
          if (active) setError(String(reason));
        });
    });
    const poll = setInterval(() => {
      if (runtime.current) setStats(runtime.current.getStats());
    }, 100);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      clearInterval(poll);
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [search]);
  useEffect(() => {
    const skip = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        runtime.current?.skipEndgame();
        showResults(false);
      }
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, []);
  const state = stats?.endgame;
  return (
    <main className="endgame-lab" data-ready={ready} data-endgame-lab>
      <canvas ref={canvas} aria-label="Endgame world map" />
      <aside className="endgame-lab-panel">
        <h1>Fractured veil</h1>
        <p>Production effect · fixture facts · 9 seconds.</p>
        <label>
          Spires
          <select
            aria-label="Spire entrance"
            value={settings.spires}
            onChange={(e) => change("spires", e.target.value)}
          >
            <option value="materialise">No discovered spires · materialise</option>
            <option value="awaken">Discovered · awaken</option>
          </select>
        </label>
        <label>
          Map
          <select
            aria-label="Map population"
            value={settings.busy ? "1" : "0"}
            onChange={(e) => change("busy", e.target.value)}
          >
            <option value="0">320 hexes · 5 realms</option>
            <option value="1">1,008 hexes · 25 realms</option>
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
            End game
          </button>
          <button disabled={!ready} onClick={() => runtime.current?.resetEndgame()}>
            Reset map
          </button>
          <button
            disabled={!ready || !state?.orbOrigins?.length}
            onClick={() => {
              if (inspecting) runtime.current?.resetCamera();
              else runtime.current?.focusEndgameSpire();
              setInspecting(!inspecting);
            }}
          >
            {inspecting ? "Whole map" : "Inspect orb"}
          </button>
        </div>
        <p className="endgame-lab-phase" role="status">
          {error ??
            (!ready ? "Loading world…" : `${state?.phase ?? "live"} · ${(state?.seconds ?? 0).toFixed(1)} / 9s`)}
        </p>
        <p>Drag to pan, scroll to zoom. Escape skips the event.</p>
        <details>
          <summary>Renderer cost</summary>
          <p>
            {stats?.activeMode} · {stats?.drawCalls ?? 0} draws · {state?.armyCount ?? 0} armies
          </p>
          <p>
            Frame p95 {stats?.frameP95Ms.toFixed(1) ?? "0"} ms · submission p95{" "}
            {state?.renderSubmissionP95Ms.toFixed(2) ?? "0"} ms
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
          <p>This offline fixture opens Results immediately. Live play keeps the game's existing Results route.</p>
          <button onClick={() => showResults(false)}>Back to the frozen map</button>
        </section>
      )}
    </main>
  );
}
