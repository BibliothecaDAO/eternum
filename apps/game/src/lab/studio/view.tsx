import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
} from "@/three/debug/procedural-terrain-debug-renderer";

import type { StudioKey, StudioPose } from "./camera-path";
import { createStudioBridge, STUDIO_LIGHTS, STUDIO_TROOPS, type StudioBridge } from "./bridge";
import { StudioStage } from "./stage";
import { STUDIO_TAKES, isStudioTake } from "./takes";
import "./view.css";

type StudioWindow = Window & { __studio?: StudioBridge };

const KEY_SPACING_SECONDS = 2;
const RISE_STEPS = [30, 60, 90, 100];

/**
 * The film studio (`/lab/studio`): the game's terrain, models and effects on a set built for shooting, a camera that
 * goes anywhere, the game's moments played on a call, and camera paths that replay the same for every take. A script
 * films through `window.__studio` (bridge.ts). The address holds the world (`gameMode=frontier` for Frontier's light),
 * `take=<name>` plays a take once the set is up, and `capture=1` with `clean=1` shows nothing but the world.
 */
export function StudioLabView() {
  const [params, setParams] = useSearchParams();
  const gameMode = params.get("gameMode") === "frontier" ? "frontier" : "blitz";
  const forceWebGL = params.get("rendererMode") === "webgpu-force-webgl";
  const clean = params.get("clean") === "1";
  const canvas = useRef<HTMLCanvasElement>(null);
  const studio = useRef<{ stage: StudioStage; bridge: StudioBridge } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [take, setTake] = useState<string | null>(null);
  const [keys, setKeys] = useState<StudioKey[]>([]);
  const [fov, setFov] = useState(38);
  const setQuery = (changes: Record<string, string | null>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [name, value] of Object.entries(changes)) {
          if (value === null) next.delete(name);
          else next.set(name, value);
        }
        return next;
      },
      { replace: true },
    );
  // The lab's header goes with the panel: `capture=1` is how the lab hides it.
  const setClean = (on: boolean) => setQuery({ clean: on ? "1" : null, capture: on ? "1" : null });
  const viewControls = useRef({ setClean, setTake });
  viewControls.current = { setClean, setTake };
  const firstTake = useRef(params.get("take"));

  useEffect(() => {
    let active = true;
    let renderer: ProceduralTerrainDebugRendererHandle | null = null;
    setReady(false);
    setError(null);
    const stage = new StudioStage((name, args) => studio.current?.bridge.trigger(name, args));
    void mountProceduralTerrainDebugRenderer({
      canvas: canvas.current!,
      captureMode: false,
      stage,
      gameMode,
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
        const bridge = createStudioBridge(stage, mounted, {
          setClean: (on) => viewControls.current.setClean(on),
          setTake: (name) => {
            viewControls.current.setTake(name);
            // A take moves the lens; the slider follows it once the take ends.
            if (name === null) setFov(stage.pose().fov);
          },
        });
        studio.current = { stage, bridge };
        (window as StudioWindow).__studio = bridge;
        setFov(stage.pose().fov);
        setReady(true);
        const opening = firstTake.current;
        firstTake.current = null;
        if (isStudioTake(opening)) void bridge.take(opening);
      })
      .catch((reason) => active && setError(String(reason)));
    return () => {
      active = false;
      studio.current = null;
      delete (window as StudioWindow).__studio;
      renderer?.dispose();
    };
  }, [gameMode, forceWebGL]);

  useStudioKeys(studio, () => setClean(!clean));
  const bridge = ready ? studio.current?.bridge : undefined;

  const markKey = () => {
    const pose = studio.current?.stage.pose();
    if (!pose) return;
    setKeys((current) => [...current, { t: current.length * KEY_SPACING_SECONDS, ...pose }]);
  };

  return (
    <main className="studio-lab" data-ready={ready} data-take={take ?? "idle"} data-studio-lab>
      <canvas ref={canvas} aria-label="Studio world" />
      {!clean && (
        <aside className="studio-panel" aria-label="Studio controls">
          <h1>Studio</h1>
          <p role="status">{error ?? (!ready ? "Building the set…" : take ? `Rolling · ${take}` : "Ready to roll")}</p>

          <Section title="Takes">
            {Object.entries(STUDIO_TAKES).map(([name, entry]) => (
              <button
                key={name}
                className="primary"
                disabled={!bridge}
                title={entry.shot}
                onClick={() => void bridge?.take(name)}
              >
                {entry.label}
              </button>
            ))}
          </Section>

          <Section title="Moments">
            <button
              disabled={!bridge}
              onClick={() => {
                const progress = studio.current?.stage.status().hyperstructureProgress ?? 0;
                bridge?.trigger("rise", { progress: RISE_STEPS.find((step) => step > progress) ?? 100 });
              }}
            >
              Raise the Hyperstructure
            </button>
            <button disabled={!bridge} onClick={() => bridge?.trigger("attack")}>
              Attack
            </button>
            <button disabled={!bridge} onClick={() => bridge?.trigger("defeat")}>
              Defender falls
            </button>
            <button disabled={!bridge} onClick={() => bridge?.trigger("explore")}>
              Explore a hex
            </button>
            <button disabled={!bridge} onClick={() => bridge?.trigger("realm")}>
              Realm's next tier
            </button>
            <button disabled={!bridge} onClick={() => bridge?.trigger("strike")}>
              Lightning
            </button>
            <button disabled={!bridge} onClick={() => bridge?.reset()}>
              Reset the set
            </button>
          </Section>

          <Section title="Armies">
            {(["attacker", "defender"] as const).map((side) => (
              <label key={side}>
                {side === "attacker" ? "Attacker" : "Defender"}
                <select
                  aria-label={`${side} troop`}
                  disabled={!bridge}
                  defaultValue={side === "attacker" ? "knight:1" : "crossbowman:1"}
                  onChange={(event) => {
                    const [type, tier] = event.target.value.split(":");
                    bridge?.troops({ [side]: { type, tier: Number(tier) } } as Parameters<StudioBridge["troops"]>[0]);
                  }}
                >
                  {Object.keys(STUDIO_TROOPS).flatMap((type) =>
                    [1, 2, 3].map((tier) => (
                      <option key={`${type}:${tier}`} value={`${type}:${tier}`}>
                        {type[0].toUpperCase() + type.slice(1)} · T{tier}
                      </option>
                    )),
                  )}
                </select>
              </label>
            ))}
          </Section>

          <Section title="Camera">
            <label>
              Lens · {Math.round(fov)}°
              <input
                type="range"
                min={15}
                max={60}
                value={fov}
                disabled={!bridge}
                onChange={(event) => {
                  setFov(Number(event.target.value));
                  bridge?.pose({ fov: Number(event.target.value) });
                }}
              />
            </label>
            <div className="studio-row">
              <button disabled={!bridge} onClick={markKey}>
                Mark key
              </button>
              <button disabled={!bridge || keys.length < 2} onClick={() => void bridge?.path({ keys })}>
                Play {keys.length} keys
              </button>
              <button disabled={keys.length === 0} onClick={() => setKeys([])}>
                Clear
              </button>
            </div>
            <button
              disabled={keys.length === 0}
              onClick={() => void navigator.clipboard?.writeText(JSON.stringify({ keys: keys.map(roundKey) }))}
            >
              Copy the path
            </button>
          </Section>

          <Section title="Light">
            <label>
              World
              <select
                aria-label="World"
                value={gameMode}
                onChange={(event) => setQuery({ gameMode: event.target.value })}
              >
                <option value="blitz">Blitz</option>
                <option value="frontier">Frontier</option>
              </select>
            </label>
            <label>
              Time of day
              <select
                aria-label="Time of day"
                disabled={!bridge}
                defaultValue="noon"
                onChange={(event) => bridge?.light(event.target.value as keyof typeof STUDIO_LIGHTS)}
              >
                {Object.keys(STUDIO_LIGHTS).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              Weather
              <select
                aria-label="Weather"
                disabled={!bridge}
                onChange={(event) => bridge?.weather(event.target.value as Parameters<StudioBridge["weather"]>[0])}
              >
                {["sunny", "cloudy", "rainy", "stormy"].map((weather) => (
                  <option key={weather}>{weather}</option>
                ))}
              </select>
            </label>
            <label>
              World speed
              <select
                aria-label="World speed"
                disabled={!bridge}
                defaultValue="1"
                onChange={(event) => bridge?.time({ scale: Number(event.target.value) })}
              >
                {["0.25", "0.5", "1", "2"].map((scale) => (
                  <option key={scale} value={scale}>
                    {scale}×
                  </option>
                ))}
              </select>
            </label>
          </Section>

          <p className="studio-help">
            Drag pans, right-drag orbits, the wheel zooms. WASD moves, Q/E turns, R/F tilts, Z/X zooms. H hides this
            panel.
          </p>
        </aside>
      )}
    </main>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="studio-section">
    <h2>{title}</h2>
    {children}
  </section>
);

const roundKey = (key: StudioKey) =>
  Object.fromEntries(
    Object.entries(key).map(([name, value]) => [
      name,
      Array.isArray(value)
        ? value.map((part) => Number(part.toFixed(2)))
        : typeof value === "number"
          ? Number(value.toFixed(2))
          : value,
    ]),
  );

const KEY_MOVES: Record<string, (pose: StudioPose) => Partial<StudioPose>> = {
  KeyW: (pose) => ({ target: shift(pose, 0, -1) }),
  KeyS: (pose) => ({ target: shift(pose, 0, 1) }),
  KeyA: (pose) => ({ target: shift(pose, -1, 0) }),
  KeyD: (pose) => ({ target: shift(pose, 1, 0) }),
  KeyQ: (pose) => ({ turn: pose.turn - 3 }),
  KeyE: (pose) => ({ turn: pose.turn + 3 }),
  KeyR: (pose) => ({ tilt: Math.max(0, pose.tilt - 2) }),
  KeyF: (pose) => ({ tilt: Math.min(88, pose.tilt + 2) }),
  KeyZ: (pose) => ({ distance: pose.distance * 0.94 }),
  KeyX: (pose) => ({ distance: pose.distance / 0.94 }),
};

/** One step of the target across the ground, said from where the camera looks: forward is away from it. */
function shift(pose: StudioPose, right: number, back: number): [number, number, number] {
  const turn = (pose.turn * Math.PI) / 180;
  const step = Math.max(0.15, pose.distance * 0.03);
  const [x, y, z] = pose.target;
  return [
    x + (Math.cos(turn) * right - Math.sin(turn) * back) * step,
    y,
    z + (Math.sin(turn) * right + Math.cos(turn) * back) * step,
  ];
}

function useStudioKeys(
  studio: React.RefObject<{ stage: StudioStage; bridge: StudioBridge } | null>,
  toggleClean: () => void,
) {
  const toggle = useRef(toggleClean);
  toggle.current = toggleClean;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === "KeyH") return toggle.current();
      const move = KEY_MOVES[event.code];
      const stage = studio.current?.stage;
      if (!move || !stage || stage.status().playing) return;
      studio.current?.bridge.pose(move(stage.pose()));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio]);
}
