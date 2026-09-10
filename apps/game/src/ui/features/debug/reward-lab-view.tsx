// @refresh reset
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  mountRewardLab,
  REWARD_STUDIES,
  type RewardLab,
  type RewardLabSettings,
  type RewardLabStats,
} from "@/three/debug/reward-lab";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { GraphicsLabsNav } from "./graphics-labs-nav";
import { CHEST_PALETTES, type ChestPalette } from "@/three/debug/reward-lab-presentation";
import "./reward-lab.css";

export function RewardLabView() {
  const container = useRef<HTMLDivElement>(null);
  const lab = useRef<RewardLab | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RewardLabSettings>({
    selection: "all",
    empty: false,
    paused: false,
    camera: "detail",
    density: false,
    wireframe: false,
    palette: "lavender",
    lighting: "day",
  });
  const [stats, setStats] = useState<RewardLabStats>({ seconds: 0, fps: 0, calls: 0, triangles: 0, instances: 0 });
  useBootDocumentState(ready || error ? "app-ready" : "app-loading", ready ? "reward_lab_ready" : undefined);

  useEffect(() => {
    if (!container.current) return;
    const abort = new AbortController();
    let mounted: RewardLab | null = null;
    void mountRewardLab(container.current, abort.signal, (next) => {
      if (!abort.signal.aborted) setStats(next);
    })
      .then((result) => {
        mounted = result;
        if (abort.signal.aborted) return result.dispose();
        lab.current = result;
        setReady(true);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(String(reason));
      });
    return () => {
      abort.abort();
      mounted?.dispose();
      lab.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) void lab.current?.configure(settings).catch((reason) => setError(String(reason)));
  }, [settings, ready]);
  const change = (patch: Partial<RewardLabSettings>) => setSettings((current) => ({ ...current, ...patch }));

  return (
    <main className="reward-lab" data-ready={ready}>
      <header>
        <div>
          <Link to="/">ETERNUM</Link>
          <h1>Rewards, brought to life.</h1>
        </div>
        <GraphicsLabsNav />
        <span className="rl-tag">3D ART STUDIES</span>
      </header>
      <nav className="rl-studies" aria-label="Reward studies">
        <button aria-pressed={settings.selection === "all"} onClick={() => change({ selection: "all" })}>
          <strong>Compare both</strong>
          <span>Selected designs · actual game terrain</span>
        </button>
        {REWARD_STUDIES.map((study) => (
          <button
            key={study.id}
            aria-pressed={settings.selection === study.id}
            onClick={() => change({ selection: study.id })}
          >
            <strong>{study.label}</strong>
            <span>{study.description}</span>
          </button>
        ))}
      </nav>
      <section className="rl-stage">
        <div className="rl-canvas" ref={container} />
        {(!ready || error) && (
          <div className="rl-loading" role="status">
            {error ?? "Loading reward models and the game terrain…"}
          </div>
        )}
        <div className="rl-stage-note">
          Drag to orbit · Scroll to inspect
          <br />
          Blender-built models with authored animation
        </div>
        <div className="rl-stats" aria-live="off">
          {stats.fps} FPS · {stats.instances} tiles · {stats.calls} draws · {(stats.triangles / 1000).toFixed(0)}k
          triangles
        </div>
      </section>
      <footer>
        <div className="rl-controls">
          <label>
            Chest finish{" "}
            <select
              aria-label="Chest finish"
              value={settings.palette}
              onChange={(event) => change({ palette: event.target.value as ChestPalette, selection: "chest-c2" })}
            >
              {Object.entries(CHEST_PALETTES).map(([id, palette]) => (
                <option key={id} value={id}>
                  {palette.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lighting{" "}
            <select
              aria-label="Lighting"
              value={settings.lighting}
              onChange={(event) => change({ lighting: event.target.value as RewardLabSettings["lighting"] })}
            >
              <option value="day">Day</option>
              <option value="night">Night</option>
            </select>
          </label>
          <button aria-pressed={settings.paused} onClick={() => change({ paused: !settings.paused })}>
            {settings.paused ? "Play" : "Pause"}
          </button>
          <label className="rl-timeline">
            Motion cycle
            <input
              aria-label="Animation time"
              type="range"
              min="0"
              max="8"
              step="0.01"
              value={stats.seconds}
              onChange={(event) => {
                change({ paused: true });
                lab.current?.seek(Number(event.target.value));
              }}
            />
          </label>
          <button
            onClick={() => {
              change({ empty: false, paused: false });
              lab.current?.seek(5.5);
            }}
          >
            Essence burst
          </button>
          <button
            onClick={() => {
              change({ paused: false });
              lab.current?.summon();
            }}
          >
            Summon tile
          </button>
          <button
            onClick={() => {
              change({ paused: false });
              lab.current?.openChest();
            }}
          >
            Open & absorb tile
          </button>
          <label>
            <input
              type="checkbox"
              checked={settings.empty}
              onChange={(event) => change({ empty: event.target.checked })}
            />
            Empty rifts
          </label>
          <label>
            Camera{" "}
            <select
              aria-label="Camera"
              value={settings.camera}
              onChange={(event) => change({ camera: event.target.value as RewardLabSettings["camera"] })}
            >
              <option value="detail">Detail</option>
              <option value="game">Game distance</option>
              <option value="top">Top / hex fit</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.wireframe}
              onChange={(event) => change({ wireframe: event.target.checked })}
            />
            Wireframe
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.density}
              onChange={(event) => change({ density: event.target.checked })}
            />
            Repeat tiles
          </label>
        </div>
        <p>
          Rifts: flow → surge → settle. Arcane tile: ground rupture → turning runes → shadow reveal. Open the chest for
          an inner glow, then the lid closes and the whole tile sinks into the biome.
        </p>
        <div className="rl-downloads">
          Download animated GLBs:
          {REWARD_STUDIES.map(({ id, label }) => (
            <a key={id} href={`/models/reward-tiles/${id === "chest-c2" ? "chest" : "rift"}.glb`} download>
              {label.split(" · ")[0]}
            </a>
          ))}
        </div>
      </footer>
    </main>
  );
}
