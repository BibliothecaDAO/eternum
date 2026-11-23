import { LAYER_NAMES, beastOfModel } from "@bibliothecadao/types";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FrontierSpecies } from "@/three/structures/frontier-beast";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  BEAST_MOTION_ACTIONS,
  BEAST_MOTION_CAMERAS,
  BEAST_MOTION_CAMERA_LABELS,
  BEAST_MOTION_COUNTS,
  BEAST_MOTION_DEFAULTS,
  BEAST_MOTION_LAYERS,
  BEAST_MOTION_MODES,
  BEAST_MOTION_MODE_LABELS,
  BEAST_MOTION_SPECIES_LIST,
  BEAST_MOTION_WAY_LABELS,
  BEAST_MOTION_WAYS,
  type BeastMotionAction,
  type BeastMotionCamera,
  type BeastMotionCount,
  type BeastMotionLayer,
  type BeastMotionMode,
  type BeastMotionState,
  type BeastMotionWay,
} from "./beast-motion-model";
import {
  mountBeastMotionRenderer,
  type BeastMotionLabel,
  type BeastMotionMeasurement,
  type BeastMotionMeta,
  type BeastMotionRendererHandle,
  type BeastMotionStats,
} from "./beast-motion-renderer";
import { BEAST_FAMILY_LABELS, BEAST_FAMILY_SHOWCASE_IDS, type BeastFamilyShowcaseId } from "./beast-family-stage";

interface BeastMotionDebugBridge {
  setState(patch: Partial<BeastMotionState>): void;
  resetCamera(): void;
  measure(samples?: number, warmup?: number): Promise<BeastMotionMeasurement>;
  getStats(): BeastMotionStats | null;
  getMeta(): BeastMotionMeta;
  isFamilyReady(): boolean;
  isSpeciesReady(): boolean;
}

declare global {
  interface Window {
    __beastMotionLab?: BeastMotionDebugBridge;
  }
}

function readInitialState(params: URLSearchParams): BeastMotionState {
  const rawMode = params.get("mode");
  const mode = BEAST_MOTION_MODES.includes(rawMode as BeastMotionMode)
    ? (rawMode as BeastMotionMode)
    : BEAST_MOTION_DEFAULTS.mode;
  const rawFamily = params.get("family");
  const family = BEAST_FAMILY_SHOWCASE_IDS.includes(rawFamily as BeastFamilyShowcaseId)
    ? (rawFamily as BeastFamilyShowcaseId)
    : BEAST_MOTION_DEFAULTS.family;
  const rawSpecies = params.get("species");
  const species = BEAST_MOTION_SPECIES_LIST.includes(rawSpecies as FrontierSpecies)
    ? (rawSpecies as FrontierSpecies)
    : BEAST_MOTION_DEFAULTS.species;
  const rawWay = params.get("way");
  const way = BEAST_MOTION_WAYS.includes(rawWay as BeastMotionWay)
    ? (rawWay as BeastMotionWay)
    : BEAST_MOTION_DEFAULTS.way;
  const rawCount = Number(params.get("count"));
  const count = BEAST_MOTION_COUNTS.includes(rawCount as BeastMotionCount)
    ? (rawCount as BeastMotionCount)
    : BEAST_MOTION_DEFAULTS.count;
  const rawAction = params.get("action");
  const action = BEAST_MOTION_ACTIONS.includes(rawAction as BeastMotionAction)
    ? (rawAction as BeastMotionAction)
    : BEAST_MOTION_DEFAULTS.action;
  const rawLayer = Number(params.get("layer"));
  const layer = BEAST_MOTION_LAYERS.includes(rawLayer as BeastMotionLayer)
    ? (rawLayer as BeastMotionLayer)
    : BEAST_MOTION_DEFAULTS.layer;
  const phoenix = params.get("phoenix") !== "0";
  const paused = params.get("paused") === "1";
  const rawCamera = params.get("camera");
  const camera = BEAST_MOTION_CAMERAS.includes(rawCamera as BeastMotionCamera)
    ? (rawCamera as BeastMotionCamera)
    : BEAST_MOTION_DEFAULTS.camera;
  return { mode, way, count, action, layer, phoenix, paused, camera, family, species };
}

export const BeastMotionView = () => {
  const [searchParams] = useSearchParams();
  const capture = searchParams.get("capture") === "1";
  const showLabels = searchParams.get("labels") !== "0";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<BeastMotionRendererHandle | null>(null);
  const [state, setState] = useState<BeastMotionState>(() => readInitialState(searchParams));
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BeastMotionStats | null>(null);
  const [measurement, setMeasurement] = useState<BeastMotionMeasurement | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [labels, setLabels] = useState<BeastMotionLabel[]>([]);

  useEffect(() => {
    stateRef.current = state;
    handleRef.current?.updateState(state);
  }, [state]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const abort = new AbortController();
    let mounted: BeastMotionRendererHandle | null = null;
    void mountBeastMotionRenderer({
      container,
      initialState: stateRef.current,
      signal: abort.signal,
      onStats: setStats,
      onLabels: setLabels,
    })
      .then((handle) => {
        if (abort.signal.aborted) {
          handle.dispose();
          return;
        }
        mounted = handle;
        handleRef.current = handle;
        window.__beastMotionLab = {
          setState: (patch) => {
            setState((current) => {
              const next = { ...current, ...patch };
              stateRef.current = next;
              handle.updateState(next);
              return next;
            });
          },
          resetCamera: () => handle.resetCamera(),
          measure: (samples, warmup) => handle.measure(samples, warmup),
          getStats: () => handle.getStats(),
          getMeta: () => handle.getMeta(),
          isFamilyReady: () => handle.isFamilyReady(),
          isSpeciesReady: () => handle.isSpeciesReady(),
        };
        setStats(handle.getStats());
        setReady(true);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    return () => {
      abort.abort();
      delete window.__beastMotionLab;
      handleRef.current = null;
      mounted?.dispose();
      setReady(false);
    };
  }, []);

  const patchState = (patch: Partial<BeastMotionState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const runMeasure = () => {
    if (!handleRef.current || measuring) return;
    setMeasuring(true);
    void handleRef.current
      .measure(90, 25)
      .then((result) => setMeasurement(result))
      .finally(() => setMeasuring(false));
  };

  return (
    <section
      className={cn(
        "min-h-[var(--lab-viewport-height)] bg-stone-950 text-stone-100",
        capture ? "block" : "flex flex-col gap-3 p-4",
      )}
      data-debug-route="beast-motion"
      data-beast-motion-ready={ready ? "true" : "false"}
    >
      {!capture && (
        <div className="flex flex-wrap items-end gap-3 border border-white/10 bg-stone-900/80 p-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Stage</span>
            <div className="flex gap-1">
              {BEAST_MOTION_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => patchState({ mode })}
                  className={cn(
                    "border px-2.5 py-1.5 text-xs font-semibold",
                    state.mode === mode
                      ? "border-amber-300 bg-amber-500/20 text-amber-100"
                      : "border-white/15 bg-stone-950 text-stone-300",
                  )}
                >
                  {BEAST_MOTION_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>

          {state.mode === "families" ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Family</span>
              <div className="flex gap-1">
                {BEAST_FAMILY_SHOWCASE_IDS.map((family) => (
                  <button
                    key={family}
                    type="button"
                    onClick={() => patchState({ family })}
                    className={cn(
                      "border px-2.5 py-1.5 text-xs font-semibold",
                      state.family === family
                        ? "border-amber-300 bg-amber-500/20 text-amber-100"
                        : "border-white/15 bg-stone-950 text-stone-300",
                    )}
                  >
                    {BEAST_FAMILY_LABELS[family]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Beast</span>
              <select
                aria-label="Beast species"
                value={state.species}
                onChange={(event) => patchState({ species: event.target.value as FrontierSpecies })}
                className="border border-white/15 bg-stone-950 px-2.5 py-1.5 text-xs font-semibold text-amber-100"
              >
                {BEAST_MOTION_SPECIES_LIST.map((species) => (
                  <option key={species} value={species}>
                    {beastOfModel(species).name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {state.mode === "bench" && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Method</span>
                <div className="flex gap-1">
                  {BEAST_MOTION_WAYS.map((way) => (
                    <button
                      key={way}
                      type="button"
                      onClick={() => patchState({ way })}
                      className={cn(
                        "border px-2.5 py-1.5 text-xs font-semibold",
                        state.way === way
                          ? "border-amber-300 bg-amber-500/20 text-amber-100"
                          : "border-white/15 bg-stone-950 text-stone-300",
                      )}
                    >
                      {BEAST_MOTION_WAY_LABELS[way]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Count</span>
                <div className="flex gap-1">
                  {BEAST_MOTION_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => patchState({ count })}
                      className={cn(
                        "border px-2.5 py-1.5 text-xs font-semibold",
                        state.count === count
                          ? "border-amber-300 bg-amber-500/20 text-amber-100"
                          : "border-white/15 bg-stone-950 text-stone-300",
                      )}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Action</span>
            <div className="flex gap-1">
              {BEAST_MOTION_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => patchState({ action })}
                  className={cn(
                    "border px-2.5 py-1.5 text-xs font-semibold capitalize",
                    state.action === action
                      ? "border-amber-300 bg-amber-500/20 text-amber-100"
                      : "border-white/15 bg-stone-950 text-stone-300",
                  )}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Layer &amp; Phoenix</span>
            <div className="flex gap-1">
              {BEAST_MOTION_LAYERS.map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => patchState({ layer })}
                  className={cn(
                    "border px-2.5 py-1.5 text-xs font-semibold",
                    state.layer === layer
                      ? "border-amber-300 bg-amber-500/20 text-amber-100"
                      : "border-white/15 bg-stone-950 text-stone-300",
                  )}
                >
                  {LAYER_NAMES[layer]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => patchState({ phoenix: !state.phoenix })}
                className={cn(
                  "border px-2.5 py-1.5 text-xs font-semibold",
                  state.phoenix
                    ? "border-emerald-300 bg-emerald-500/20 text-emerald-100"
                    : "border-white/15 bg-stone-950 text-stone-400",
                )}
              >
                Phoenix {state.phoenix ? "On" : "Off"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Camera &amp; Run</span>
            <div className="flex gap-1">
              {BEAST_MOTION_CAMERAS.map((camera) => (
                <button
                  key={camera}
                  type="button"
                  onClick={() => patchState({ camera })}
                  className={cn(
                    "border px-2 py-1.5 text-xs font-semibold",
                    state.camera === camera
                      ? "border-amber-300 bg-amber-500/20 text-amber-100"
                      : "border-white/15 bg-stone-950 text-stone-300",
                  )}
                >
                  {BEAST_MOTION_CAMERA_LABELS[camera]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => patchState({ paused: !state.paused })}
                className="border border-white/15 bg-stone-950 px-2.5 py-1.5 text-xs font-semibold text-stone-200"
              >
                {state.paused ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={runMeasure}
                disabled={measuring}
                className="border border-sky-300/60 bg-sky-500/20 px-2.5 py-1.5 text-xs font-semibold text-sky-100 disabled:opacity-50"
              >
                {measuring ? "Measuring..." : "Measure 90f"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!capture && stats && (
        <div className="flex flex-wrap items-center gap-4 border border-white/10 bg-stone-900/60 px-3 py-2 font-mono text-xs text-stone-200">
          <span>
            Model: {stats.modelPath.split("/").pop()} ({stats.trianglesPerBeast.toLocaleString()} tris)
          </span>
          <span>Backend: {stats.rendererMode}</span>
          <span>Beasts: {stats.beastCount}</span>
          <span>Draws: {stats.drawCalls}</span>
          <span>Tris: {stats.triangles.toLocaleString()}</span>
          <span>Bones: {stats.activeBones}</span>
          <span>FPS: {stats.fps}</span>
          <span>
            Frame: {stats.averageFrameMs.toFixed(2)}ms (p95 {stats.p95FrameMs.toFixed(2)}ms)
          </span>
          <span>
            CPU anim/render: {stats.animationCpuMs.toFixed(2)}/{stats.renderCpuMs.toFixed(2)}ms
          </span>
          {stats.gpuFrameMs !== null && <span>GPU: {stats.gpuFrameMs.toFixed(2)}ms</span>}
          <span className="text-amber-300">Bound: {stats.bottleneck}</span>
        </div>
      )}

      {!capture && measurement && (
        <div className="border border-sky-300/40 bg-sky-950/40 px-3 py-2 font-mono text-xs text-sky-100">
          Measured {measurement.way} x{measurement.count} ({measurement.sampleCount}f @ {measurement.viewport.width}x
          {measurement.viewport.height}): median {measurement.frameMedianMs}ms (min {measurement.frameMinMs} – max{" "}
          {measurement.frameMaxMs}ms, p95 {measurement.frameP95Ms}ms) · CPU anim {measurement.animationCpuAvgMs}ms /
          render {measurement.renderCpuAvgMs}ms · draws {measurement.drawCalls} · bones {measurement.activeBones} ·{" "}
          {measurement.bottleneck}
        </div>
      )}

      <div
        ref={containerRef}
        className={cn("relative overflow-hidden", capture ? "h-screen w-screen" : "min-h-[600px] flex-1")}
      >
        {showLabels &&
          (state.mode === "compare" || state.mode === "families" || (state.mode === "bench" && state.count === 1)) &&
          labels.map(
            (label) =>
              label.visible && (
                <div
                  key={label.key}
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded border border-amber-300/50 bg-stone-950/85 px-2 py-0.5 font-mono text-xs font-semibold text-amber-100 shadow"
                  style={{ left: `${label.x}px`, top: `${label.y}px` }}
                >
                  {label.text}
                </div>
              ),
          )}
        {error && (
          <div className="absolute inset-x-4 bottom-4 border border-red-300/40 bg-red-950/85 p-3 text-sm text-red-100">
            {error}
          </div>
        )}
      </div>
    </section>
  );
};
