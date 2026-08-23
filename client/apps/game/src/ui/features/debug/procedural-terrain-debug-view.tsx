import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
  type ProceduralTerrainDebugStats,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { TERRAIN_BIOME_DESCRIPTORS, TERRAIN_BIOME_ORDER } from "@/three/terrain/terrain-palette";
import { TERRAIN_QUALITY_TIERS, type TerrainQualityTier } from "@/three/terrain/terrain-quality";
import {
  TERRAIN_VERIFICATION_SCENE_IDS,
  type TerrainVerificationSceneId,
} from "@/three/terrain/verification/terrain-verification-fixtures";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

const EMPTY_STATS: ProceduralTerrainDebugStats = {
  activeMode: "webgpu",
  biomeCount: 0,
  cellCount: 0,
  commitMs: 0,
  drawCalls: 0,
  fingerprint: "--------",
  firstRenderMs: 0,
  frameP50Ms: 0,
  frameP95Ms: 0,
  frameWorstMs: 0,
  frameSampleCount: 0,
  groundTextureBytes: 0,
  groundTextureLayers: 0,
  prepareMs: 0,
  propInstances: 0,
  qualityTier: "detail",
  sceneId: "all-biomes",
  shadingMode: "textured",
  triangles: 0,
  textures: 0,
  vertices: 0,
};

export const ProceduralTerrainDebugView = () => {
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ProceduralTerrainDebugRendererHandle | null>(null);
  const capture = searchParams.get("capture") === "1";
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const texturedGround = searchParams.get("groundMode") !== "flat";
  const sceneId = resolveSceneId(searchParams.get("scene"));
  const qualityTier = resolveQualityTier(searchParams.get("quality"));
  const [stats, setStats] = useState(EMPTY_STATS);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useBootDocumentState(ready ? "app-ready" : "app-loading", ready ? "procedural_terrain_debug_ready" : undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    let statsTimer: number | null = null;
    const mountFrame = window.requestAnimationFrame(() => {
      void mountProceduralTerrainDebugRenderer({
        canvas,
        captureMode: capture,
        forceWebGL,
        qualityTier,
        sceneId,
        texturedGround,
        onReady: (nextStats) => {
          if (!active) return;
          setStats(nextStats);
          setReady(true);
        },
      })
        .then((renderer) => {
          if (!active) {
            renderer.dispose();
            return;
          }
          rendererRef.current = renderer;
          statsTimer = window.setInterval(() => setStats(renderer.getStats()), 500);
        })
        .catch((reason) => {
          if (!active) return;
          setError(reason instanceof Error ? reason.message : String(reason));
        });
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(mountFrame);
      if (statsTimer !== null) window.clearInterval(statsTimer);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [capture, forceWebGL, qualityTier, sceneId, texturedGround]);

  const setRendererMode = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("rendererMode", value);
    window.location.search = next.toString();
  };

  const setGroundMode = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("groundMode", value);
    window.location.search = next.toString();
  };

  const setSceneId = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("scene", value);
    window.location.search = next.toString();
  };

  const setQualityTier = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("quality", value);
    window.location.search = next.toString();
  };

  return (
    <section
      className={cn(
        "min-h-screen bg-stone-950 text-stone-100",
        capture ? "block" : "flex flex-col gap-4 p-4 xl:grid xl:grid-cols-[380px_1fr]",
      )}
      data-debug-route="procedural-terrain"
      data-ready={ready ? "true" : "false"}
    >
      {!capture && (
        <aside className="flex max-h-[calc(100vh-2rem)] flex-col gap-4 overflow-y-auto border border-white/10 bg-black/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">Terrain Lab</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">Living Biome Field</h1>
              <p className="mt-2 text-sm leading-5 text-stone-400">
                A game-scale seeded field exercises every biome across hundreds of connected hexes. Drag to orbit,
                scroll to zoom, and right-drag to pan.
              </p>
            </div>
            <Link to="/" className="border border-white/15 px-3 py-2 text-xs font-semibold uppercase text-stone-200">
              Exit
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-1" aria-label="Biome atlas legend">
            {TERRAIN_BIOME_ORDER.map((biome) => {
              const descriptor = TERRAIN_BIOME_DESCRIPTORS[biome];
              return (
                <div key={biome} className="min-h-20 border border-white/10 bg-white/[0.035] p-2">
                  <span
                    className="block h-5 w-full border border-white/10"
                    style={{ background: `linear-gradient(135deg, ${descriptor.primary}, ${descriptor.secondary})` }}
                  />
                  <span className="mt-2 block text-[0.64rem] font-medium leading-3 text-stone-300">
                    {descriptor.label}
                  </span>
                </div>
              );
            })}
          </div>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            Terrain quality
            <select
              value={qualityTier}
              onChange={(event) => setQualityTier(event.target.value)}
              className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
            >
              {TERRAIN_QUALITY_TIERS.map((value) => (
                <option key={value} value={value}>
                  {formatSceneLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            Anchor scene
            <select
              value={sceneId}
              onChange={(event) => setSceneId(event.target.value)}
              className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
            >
              {TERRAIN_VERIFICATION_SCENE_IDS.map((value) => (
                <option key={value} value={value}>
                  {formatSceneLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            Renderer
            <select
              value={forceWebGL ? "webgpu-force-webgl" : "webgpu-auto"}
              onChange={(event) => setRendererMode(event.target.value)}
              className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
            >
              <option value="webgpu-auto">WebGPU auto</option>
              <option value="webgpu-force-webgl">WebGL2 fallback</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            Ground shading
            <select
              value={texturedGround ? "textured" : "flat"}
              onChange={(event) => setGroundMode(event.target.value)}
              className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
            >
              <option value="textured">Textured PBR</option>
              <option value="flat">Flat diagnostic</option>
            </select>
          </label>

          <dl className="grid grid-cols-3 gap-2 text-sm">
            <DebugMetric label="Backend" value={stats.activeMode === "webgpu" ? "WebGPU" : "WebGL2"} />
            <DebugMetric label="Scene" value={formatSceneLabel(stats.sceneId)} />
            <DebugMetric label="Quality" value={formatSceneLabel(stats.qualityTier)} />
            <DebugMetric label="Biomes" value={String(stats.biomeCount || "--")} />
            <DebugMetric label="Hexes" value={stats.cellCount.toLocaleString()} />
            <DebugMetric label="Calls" value={String(stats.drawCalls || "--")} />
            <DebugMetric label="Props" value={stats.propInstances.toLocaleString()} />
            <DebugMetric label="Ground" value={`${stats.groundTextureLayers || "--"} layers`} />
            <DebugMetric label="Ground KB" value={Math.round(stats.groundTextureBytes / 1024).toLocaleString()} />
            <DebugMetric label="Frame p50" value={`${stats.frameP50Ms.toFixed(1)} ms`} />
            <DebugMetric label="Frame p95" value={`${stats.frameP95Ms.toFixed(1)} ms`} />
            <DebugMetric label="Frame worst" value={`${stats.frameWorstMs.toFixed(1)} ms`} />
            <DebugMetric label="Textures" value={String(stats.textures || "--")} />
            <DebugMetric label="Triangles" value={stats.triangles.toLocaleString()} />
            <DebugMetric label="Prepare" value={`${stats.prepareMs.toFixed(1)} ms`} />
            <DebugMetric label="Commit" value={`${stats.commitMs.toFixed(1)} ms`} />
            <DebugMetric label="First render" value={`${stats.firstRenderMs.toFixed(1)} ms`} />
          </dl>

          <div className="flex items-center justify-between gap-3 text-[0.68rem] text-stone-500">
            <span>Fingerprint</span>
            <code>{stats.fingerprint}</code>
          </div>

          <button
            type="button"
            onClick={() => rendererRef.current?.resetCamera()}
            className="flex h-10 items-center justify-center gap-2 border border-emerald-300/35 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100"
          >
            <RefreshCw className="h-4 w-4" />
            Reset Camera
          </button>
        </aside>
      )}

      <div className={cn("relative overflow-hidden bg-[#d8d0ba]", capture ? "h-screen w-screen" : "min-h-[720px]")}>
        <canvas
          ref={canvasRef}
          id="procedural-terrain-debug-canvas"
          className={cn("h-full w-full touch-none", !capture && "min-h-[720px]")}
          aria-label="Game-scale procedural terrain biome field"
        />
        {error && (
          <div className="absolute inset-x-4 bottom-4 border border-red-300/40 bg-red-950/90 p-3 text-sm text-red-100">
            {error}
          </div>
        )}
      </div>
    </section>
  );
};

const DebugMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-white/10 bg-white/[0.04] px-2 py-2">
    <dt className="text-[0.6rem] font-semibold uppercase text-stone-500">{label}</dt>
    <dd className="mt-1 truncate font-mono text-xs text-white">{value}</dd>
  </div>
);

function resolveSceneId(value: string | null): TerrainVerificationSceneId {
  return TERRAIN_VERIFICATION_SCENE_IDS.includes(value as TerrainVerificationSceneId)
    ? (value as TerrainVerificationSceneId)
    : "all-biomes";
}

function resolveQualityTier(value: string | null): TerrainQualityTier {
  return TERRAIN_QUALITY_TIERS.includes(value as TerrainQualityTier) ? (value as TerrainQualityTier) : "detail";
}

function formatSceneLabel(value: TerrainQualityTier | TerrainVerificationSceneId): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
