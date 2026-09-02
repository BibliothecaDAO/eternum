import { Flame, Pause, Play, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { findResourceById } from "@bibliothecadao/types";

import {
  mountWorldFxGymRenderer,
  type WorldFxGymRendererHandle,
  type WorldFxGymStats,
} from "@/three/debug/world-fx-gym-renderer";
import {
  RESOURCE_FLOW_GYM_LEGEND,
  resolveWorldFxGymCount,
  resolveWorldFxGymScenario,
  resolveWorldFxGymSeed,
  resolveWorldFxGymView,
} from "@/three/debug/world-fx-gym-fixture";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

const EMPTY_STATS: WorldFxGymStats = {
  activeAdditiveParticles: 0,
  activeAuraEmitters: 0,
  activeEmitters: 0,
  activeFlameEmitters: 0,
  activeMode: "webgpu",
  activeRings: 0,
  activeSmokeParticles: 0,
  activeTransientEffects: 0,
  additiveCapacity: 0,
  drawCalls: 0,
  droppedCount: 0,
  emitterCount: 10,
  fingerprint: "--------",
  fps: 0,
  frameMs: 0,
  geometryCount: 0,
  paused: false,
  rendererDrawCalls: 0,
  rendererTriangles: 0,
  resourceFlows: {
    activeFlows: 0,
    activePackets: 0,
    activeRouteSegments: 0,
    drawCalls: 0,
    droppedFlows: 0,
    droppedResources: 0,
    packetCapacity: 0,
    routeSegmentCapacity: 0,
    triangles: 0,
  },
  ringCapacity: 0,
  scenario: "mixed",
  smokeCapacity: 0,
  textureCount: 0,
  triangles: 0,
  view: "detail",
};

export const WorldFxGymView = () => {
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WorldFxGymRendererHandle | null>(null);
  const scenario = resolveWorldFxGymScenario(searchParams.get("scene"));
  const count = resolveWorldFxGymCount(searchParams.get("count"));
  const seed = resolveWorldFxGymSeed(searchParams.get("seed"));
  const view = resolveWorldFxGymView(searchParams.get("view"));
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const capture = searchParams.get("capture") === "1";
  const captureTimeSeconds = resolveCaptureTime(searchParams.get("time"));
  const [stats, setStats] = useState(EMPTY_STATS);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  useBootDocumentState(ready ? "app-ready" : "app-loading", ready ? "world_fx_gym_ready" : undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    const mountFrame = window.requestAnimationFrame(() => {
      void mountWorldFxGymRenderer({
        canvas,
        captureMode: capture,
        captureTimeSeconds,
        count,
        forceWebGL,
        onFrame: (nextStats) => {
          if (active) setStats(nextStats);
        },
        onReady: (nextStats) => {
          if (!active) return;
          setStats(nextStats);
          setReady(true);
        },
        scenario,
        seed,
        view,
      })
        .then((renderer) => {
          if (!active) {
            renderer.dispose();
            return;
          }
          rendererRef.current = renderer;
        })
        .catch((reason) => {
          if (!active) return;
          setError(reason instanceof Error ? reason.message : String(reason));
        });
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(mountFrame);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [capture, captureTimeSeconds, count, forceWebGL, scenario, seed, view]);

  const backendLabel = useMemo(
    () => (stats.activeMode === "webgpu" ? "Native WebGPU" : "WebGL2 fallback"),
    [stats.activeMode],
  );

  const setOption = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    window.location.search = next.toString();
  };

  const togglePaused = () => {
    const next = !paused;
    setPaused(next);
    rendererRef.current?.setPaused(next);
  };

  return (
    <section
      className={cn(
        "min-h-screen bg-[#0d0908] text-stone-100",
        capture ? "block" : "flex flex-col gap-4 p-4 xl:grid xl:grid-cols-[340px_1fr]",
      )}
      data-debug-route="world-fx"
      data-ready={ready ? "true" : "false"}
    >
      {!capture && (
        <aside className="flex max-h-[calc(100vh-2rem)] flex-col gap-4 overflow-y-auto border border-orange-200/10 bg-black/55 p-4 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200/65">
                Renderer Laboratory
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white">Procedural FX Gym</h1>
              <p className="mt-2 text-xs leading-relaxed text-stone-400">
                Deterministic pooled effects running through the production World FX interface.
              </p>
            </div>
            <Link
              to="/"
              className="border border-white/15 px-3 py-2 text-xs font-semibold uppercase text-stone-200 transition-colors hover:bg-white/10"
            >
              Exit
            </Link>
          </div>

          <DebugSelect label="Composition" value={scenario} onChange={(value) => setOption("scene", value)}>
            <option value="flame">Flame loop</option>
            <option value="impact">Impact burst</option>
            <option value="explosion">Explosion</option>
            <option value="shockwave">Shockwave</option>
            <option value="projectile-trail">Projectile trail</option>
            <option value="beam">Energy beam</option>
            <option value="dragon-breath">Dragon breath</option>
            <option value="aura">Status auras</option>
            <option value="resource-flow">Resource flows</option>
            <option value="resource-flow-stress">Resource-flow stress</option>
            <option value="mixed">Mixed stress</option>
            <option value="realm-flame">Realm fire</option>
          </DebugSelect>

          <DebugSelect
            label="Concurrent emitters"
            value={String(count)}
            onChange={(value) => setOption("count", value)}
            disabled={scenario === "realm-flame" || scenario === "resource-flow"}
          >
            <option value="1">1 — hero</option>
            <option value="10">10 — encounter</option>
            <option value="50">50 — stress</option>
          </DebugSelect>

          {scenario === "realm-flame" && (
            <DebugSelect label="Camera framing" value={view} onChange={(value) => setOption("view", value)}>
              <option value="detail">Close inspection</option>
              <option value="gameplay">Gameplay distance</option>
            </DebugSelect>
          )}

          <DebugSelect
            label="Renderer"
            value={forceWebGL ? "webgpu-force-webgl" : "webgpu-auto"}
            onChange={(value) => setOption("rendererMode", value)}
          >
            <option value="webgpu-auto">WebGPU auto</option>
            <option value="webgpu-force-webgl">WebGL2 fallback</option>
          </DebugSelect>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            Seed
            <input
              key={seed}
              type="number"
              defaultValue={seed}
              onBlur={(event) => setOption("seed", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setOption("seed", event.currentTarget.value);
              }}
              className="h-10 border border-white/15 bg-stone-950 px-3 font-mono text-sm font-medium normal-case text-white outline-none focus:border-orange-300"
            />
          </label>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <DebugMetric label="Backend" value={backendLabel} />
            <DebugMetric label="FPS" value={stats.fps ? String(stats.fps) : "--"} />
            <DebugMetric label="Frame" value={stats.frameMs ? `${stats.frameMs} ms` : "--"} />
            <DebugMetric label="Calls" value={String(stats.rendererDrawCalls || "--")} />
            <DebugMetric label="Flames + sparks" value={String(stats.activeAdditiveParticles)} />
            <DebugMetric label="Smoke" value={String(stats.activeSmokeParticles)} />
            <DebugMetric label="Rings" value={String(stats.activeRings)} />
            <DebugMetric label="Emitters" value={String(stats.activeEmitters)} />
            <DebugMetric label="Auras" value={String(stats.activeAuraEmitters)} />
            <DebugMetric label="Transient FX" value={String(stats.activeTransientEffects)} />
            <DebugMetric label="Trade routes" value={String(stats.resourceFlows.activeFlows)} />
            <DebugMetric label="Cargo packets" value={String(stats.resourceFlows.activePackets)} />
            <DebugMetric label="FX tris" value={stats.triangles.toLocaleString()} />
            <DebugMetric label="Geometries" value={String(stats.geometryCount)} />
            <DebugMetric label="Textures" value={String(stats.textureCount)} />
            <DebugMetric label="Dropped" value={String(stats.droppedCount)} alert={stats.droppedCount > 0} />
          </dl>

          <div className="border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[0.65rem] font-semibold uppercase text-stone-500">Deterministic fingerprint</p>
            <p className="mt-1 font-mono text-sm tracking-[0.18em] text-orange-200">{stats.fingerprint}</p>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2">
            <DebugButton
              disabled={
                scenario === "flame" ||
                scenario === "aura" ||
                scenario === "realm-flame" ||
                scenario === "resource-flow"
              }
              onClick={() => rendererRef.current?.emitBurst()}
              icon={<Sparkles className="h-4 w-4" />}
            >
              Burst
            </DebugButton>
            <DebugButton
              onClick={togglePaused}
              icon={paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            >
              {paused ? "Resume" : "Pause"}
            </DebugButton>
            <DebugButton
              onClick={() => rendererRef.current?.resetCamera()}
              icon={<RefreshCw className="h-4 w-4" />}
              className="col-span-2"
            >
              Reset camera
            </DebugButton>
          </div>
        </aside>
      )}

      <div
        className={cn(
          "relative overflow-hidden bg-[#120d0b] shadow-[0_24px_90px_rgba(0,0,0,0.55)]",
          capture ? "h-screen w-screen" : "min-h-[640px] border border-orange-200/10",
        )}
      >
        <canvas
          ref={canvasRef}
          id="world-fx-gym-canvas"
          className={cn("h-full w-full touch-none", !capture && "min-h-[640px]")}
          aria-label="Procedural gameplay FX gym"
        />
        {!capture && (
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 border border-orange-200/10 bg-black/45 px-3 py-2 text-xs uppercase tracking-[0.16em] text-orange-100/70 backdrop-blur">
            <Flame className="h-4 w-4 text-orange-300" />
            {scenario} · {scenario === "realm-flame" ? view : count}
          </div>
        )}
        {scenario === "resource-flow" && <ResourceFlowLegend />}
        {error && (
          <div className="absolute inset-x-4 bottom-4 border border-red-300/40 bg-red-950/85 p-3 text-sm text-red-100 backdrop-blur">
            {error}
          </div>
        )}
      </div>
    </section>
  );
};

const DebugSelect = ({
  children,
  label,
  onChange,
  value,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onChange(value: string): void;
  value: string;
}) => (
  <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
    {label}
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white outline-none transition-colors focus:border-orange-300 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </select>
  </label>
);

const ResourceFlowLegend = () => (
  <div className="pointer-events-none absolute right-4 top-4 z-10 w-[min(24rem,calc(100%-2rem))] border border-amber-200/15 bg-black/70 p-3 text-xs text-stone-200 shadow-2xl backdrop-blur-md">
    <p className="font-semibold uppercase tracking-[0.16em] text-amber-200/70">Active resource routes</p>
    <div className="mt-2 grid gap-2">
      {RESOURCE_FLOW_GYM_LEGEND.map((entry) => (
        <div
          key={`${entry.from}-${entry.to}`}
          className="flex items-center justify-between gap-3 border-t border-white/10 pt-2"
        >
          <span className="whitespace-nowrap text-stone-300">
            {entry.from} <span className="text-amber-300">→</span> {entry.to}
          </span>
          <span className="flex flex-wrap justify-end gap-1.5">
            {entry.resourceIds.map((resourceId) => {
              const resource = findResourceById(resourceId);
              return (
                <span
                  key={resourceId}
                  className="inline-flex items-center gap-1 text-[0.65rem] uppercase text-white/80"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_currentColor]"
                    style={{ backgroundColor: resource?.colour ?? "#f6c76b", color: resource?.colour ?? "#f6c76b" }}
                  />
                  {resource?.ticker ?? resource?.trait ?? resourceId}
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
    <p className="mt-2 border-t border-white/10 pt-2 text-[0.65rem] leading-relaxed text-stone-500">
      Packets and arrowheads travel from sender to receiver. Hover metadata retains entity, resource and amount IDs.
    </p>
  </div>
);

const DebugMetric = ({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) => (
  <div className={cn("border bg-white/[0.035] px-3 py-2", alert ? "border-red-300/40" : "border-white/10")}>
    <dt className="text-[0.65rem] font-semibold uppercase text-stone-500">{label}</dt>
    <dd className={cn("mt-1 font-mono text-sm", alert ? "text-red-200" : "text-white")}>{value}</dd>
  </div>
);

const DebugButton = ({
  children,
  className,
  disabled = false,
  icon,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  icon: ReactNode;
  onClick(): void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex h-10 items-center justify-center gap-2 border border-orange-300/30 bg-orange-300/10 px-3 text-sm font-semibold text-orange-100 transition-colors hover:bg-orange-300/20",
      disabled && "cursor-not-allowed opacity-35 hover:bg-orange-300/10",
      className,
    )}
  >
    {icon}
    {children}
  </button>
);

function resolveCaptureTime(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(4, Math.max(0, parsed)) : 0.35;
}
