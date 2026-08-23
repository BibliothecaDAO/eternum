import { Gauge, Play, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  mountProceduralTerrainBenchmarkRenderer,
  type ProceduralTerrainBenchmarkRendererHandle,
} from "@/three/debug/procedural-terrain-benchmark-renderer";
import {
  TERRAIN_BENCHMARK_CONTRACT_VERSION,
  TERRAIN_BENCHMARK_VARIANTS,
  type TerrainBenchmarkRunMode,
  type TerrainBenchmarkSnapshot,
  type TerrainBenchmarkTraceMode,
  type TerrainBenchmarkVariant,
} from "@/three/terrain/verification/terrain-benchmark-contract";
import {
  TERRAIN_BENCHMARK_CELL_COLUMNS,
  TERRAIN_BENCHMARK_CELL_ROWS,
  TERRAIN_BENCHMARK_FIXTURE_ID,
  TERRAIN_BENCHMARK_PAGE_COLUMNS,
  TERRAIN_BENCHMARK_PAGE_ROWS,
  TERRAIN_BENCHMARK_WINDOW_COLUMNS,
  TERRAIN_BENCHMARK_WINDOW_ROWS,
} from "@/three/terrain/verification/terrain-benchmark-fixture";
import { PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER } from "@/three/terrain/terrain-props";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

const EMPTY_FRAME_STATS = {
  above16Ms: 0,
  above33Ms: 0,
  above50Ms: 0,
  fpsMedian: 0,
  fpsOnePercentLow: 0,
  maxMs: 0,
  p50Ms: 0,
  p95Ms: 0,
  p99Ms: 0,
  sampleCount: 0,
};

export const ProceduralTerrainBenchmarkView = () => {
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ProceduralTerrainBenchmarkRendererHandle | null>(null);
  const capture = searchParams.get("capture") === "1";
  const autoRun = searchParams.get("autorun") === "1";
  const densityMultiplier = resolveDensityMultiplier(searchParams.get("density"));
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const runMode = resolveRunMode(searchParams.get("runMode"));
  const traceMode = resolveTraceMode(searchParams.get("traceMode"));
  const variant = resolveVariant(searchParams.get("variant"));
  const configError = useMemo(() => resolveConfigError(searchParams), [searchParams]);
  const [snapshot, setSnapshot] = useState(() => createEmptySnapshot(runMode, variant, densityMultiplier));
  const [error, setError] = useState<string | null>(configError);
  const [mounted, setMounted] = useState(false);
  useBootDocumentState(mounted ? "app-ready" : "app-loading", mounted ? "terrain_benchmark_ready" : undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || configError) return;
    let active = true;
    let statsTimer: number | null = null;
    const mountFrame = window.requestAnimationFrame(() => {
      void mountProceduralTerrainBenchmarkRenderer({
        autoRun,
        canvas,
        captureMode: capture,
        densityMultiplier,
        forceWebGL,
        onReady: (nextSnapshot) => {
          if (!active) return;
          setSnapshot(nextSnapshot);
          setMounted(true);
        },
        runMode,
        traceMode,
        variant,
      })
        .then((renderer) => {
          if (!active) {
            renderer.dispose();
            return;
          }
          rendererRef.current = renderer;
          statsTimer = window.setInterval(() => setSnapshot(renderer.getSnapshot()), 250);
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
  }, [autoRun, capture, configError, densityMultiplier, forceWebGL, runMode, traceMode, variant]);

  const setOption = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(name, value);
    window.location.search = next.toString();
  };

  const start = () => {
    void rendererRef.current
      ?.startBenchmark()
      .then(setSnapshot)
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  };

  return (
    <section
      className={cn(
        "min-h-screen bg-stone-950 text-stone-100",
        capture ? "block" : "flex flex-col gap-4 p-4 xl:grid xl:grid-cols-[380px_1fr]",
      )}
      data-debug-route="procedural-terrain-benchmark"
      data-ready={mounted ? "true" : "false"}
      data-status={snapshot.status}
    >
      {!capture && (
        <aside className="flex max-h-[calc(100vh-2rem)] flex-col gap-4 overflow-y-auto border border-white/10 bg-black/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
                <Gauge className="h-4 w-4" /> Terrain Benchmark
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white">Full-Screen Biome Load</h1>
              <p className="mt-2 text-sm leading-5 text-stone-400">
                Production-sized terrain pages fill the viewport while a deterministic camera trace crosses chunk
                boundaries and records frame, coverage, and lifecycle evidence.
              </p>
            </div>
            <Link to="/" className="border border-white/15 px-3 py-2 text-xs font-semibold uppercase text-stone-200">
              Exit
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <BenchmarkSelect
              label="Renderer"
              value={forceWebGL ? "webgpu-force-webgl" : "webgpu-auto"}
              onChange={(value) => setOption("rendererMode", value)}
              options={[
                ["webgpu-auto", "WebGPU auto"],
                ["webgpu-force-webgl", "WebGL2 fallback"],
              ]}
            />
            <BenchmarkSelect
              label="Run"
              value={runMode}
              onChange={(value) => setOption("runMode", value)}
              options={[
                ["quick", "Quick trace"],
                ["full", "Full lifecycle"],
              ]}
            />
          </div>

          <BenchmarkSelect
            label="Ablation"
            value={variant}
            onChange={(value) => setOption("variant", value)}
            options={[
              ["geometry", "Flat geometry"],
              ["material", "Textured ground"],
              ["props", "Ground + props"],
              ["production", "Production + shadows"],
            ]}
          />

          <BenchmarkSelect
            label="Prop density"
            value={String(densityMultiplier)}
            onChange={(value) => setOption("density", value)}
            options={[
              ["1", "1.0× baseline"],
              ["1.5", "1.5× rich"],
              ["1.75", "1.75× production"],
              ["2", "2.0× abundant"],
              ["2.5", "2.5× dense"],
              ["3", "3.0× maximum"],
            ]}
          />

          <dl className="grid grid-cols-3 gap-2 text-sm">
            <BenchmarkMetric label="Status" value={snapshot.status} />
            <BenchmarkMetric label="Backend" value={snapshot.activeMode === "webgpu" ? "WebGPU" : "WebGL2"} />
            <BenchmarkMetric label="Pages" value={String(snapshot.fixture.visiblePageCount)} />
            <BenchmarkMetric label="Density" value={`${snapshot.densityMultiplier.toFixed(1)}×`} />
            <BenchmarkMetric label="Static p95" value={`${snapshot.frames.static.p95Ms.toFixed(1)} ms`} />
            <BenchmarkMetric label="Motion p95" value={`${snapshot.frames.motion.p95Ms.toFixed(1)} ms`} />
            <BenchmarkMetric label="1% low" value={`${snapshot.frames.motion.fpsOnePercentLow.toFixed(0)} fps`} />
            <BenchmarkMetric label="Calls" value={String(snapshot.render.drawCalls)} />
            <BenchmarkMetric label="Triangles" value={snapshot.render.triangles.toLocaleString()} />
            <BenchmarkMetric label="Props" value={snapshot.render.propInstances.toLocaleString()} />
            <BenchmarkMetric label="Built" value={String(snapshot.chunks.builtPages)} />
            <BenchmarkMetric label="Commit p95" value={`${snapshot.chunks.commitP95Ms.toFixed(1)} ms`} />
            <BenchmarkMetric label="Coverage" value={`${snapshot.coverage.missingFrames} miss`} />
            <BenchmarkMetric label="Long tasks" value={String(snapshot.longTasks.count)} />
            <BenchmarkMetric label="Textures" value={String(snapshot.render.textures)} />
            <BenchmarkMetric label="Geometry Δ" value={String(snapshot.lifecycle.geometryGrowth)} />
          </dl>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={start}
              disabled={snapshot.status === "running" || snapshot.status === "complete"}
              className="flex h-10 items-center justify-center gap-2 border border-emerald-300/35 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100 disabled:opacity-40"
            >
              <Play className="h-4 w-4" /> Run benchmark
            </button>
            <button
              type="button"
              onClick={() => rendererRef.current?.resetCamera()}
              className="flex h-10 items-center justify-center gap-2 border border-white/15 px-3 text-sm font-semibold text-stone-200"
            >
              <RefreshCw className="h-4 w-4" /> Reset camera
            </button>
          </div>
        </aside>
      )}

      <div className={cn("relative overflow-hidden bg-[#d8d0ba]", capture ? "h-screen w-screen" : "min-h-[720px]")}>
        <canvas
          ref={canvasRef}
          id="procedural-terrain-benchmark-canvas"
          className={cn("h-full w-full touch-none", !capture && "min-h-[720px]")}
          aria-label="Full-screen procedural terrain performance benchmark"
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

const BenchmarkSelect = ({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange(value: string): void;
  options: Array<[string, string]>;
  value: string;
}) => (
  <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  </label>
);

const BenchmarkMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-white/10 bg-white/[0.04] px-2 py-2">
    <dt className="text-[0.6rem] font-semibold uppercase text-stone-500">{label}</dt>
    <dd className="mt-1 truncate font-mono text-xs text-white">{value}</dd>
  </div>
);

function resolveVariant(value: string | null): TerrainBenchmarkVariant {
  return TERRAIN_BENCHMARK_VARIANTS.includes(value as TerrainBenchmarkVariant)
    ? (value as TerrainBenchmarkVariant)
    : "production";
}

function resolveRunMode(value: string | null): TerrainBenchmarkRunMode {
  return value === "full" ? "full" : "quick";
}

function resolveTraceMode(value: string | null): TerrainBenchmarkTraceMode {
  return value === "structural" ? "structural" : "performance";
}

function resolveDensityMultiplier(value: string | null): number {
  return value === null ? PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER : Number(value);
}

function resolveConfigError(searchParams: URLSearchParams): string | null {
  const variant = searchParams.get("variant");
  if (variant && !TERRAIN_BENCHMARK_VARIANTS.includes(variant as TerrainBenchmarkVariant)) {
    return `Unknown terrain benchmark variant: ${variant}`;
  }
  const runMode = searchParams.get("runMode");
  if (runMode && runMode !== "quick" && runMode !== "full") return `Unknown terrain benchmark run mode: ${runMode}`;
  const traceMode = searchParams.get("traceMode");
  if (traceMode && traceMode !== "performance" && traceMode !== "structural") {
    return `Unknown terrain benchmark trace mode: ${traceMode}`;
  }
  const densityMultiplier = resolveDensityMultiplier(searchParams.get("density"));
  if (!Number.isFinite(densityMultiplier) || densityMultiplier < 0.25 || densityMultiplier > 3) {
    return `Terrain benchmark density must be from 0.25 to 3, received ${searchParams.get("density")}`;
  }
  return null;
}

function createEmptySnapshot(
  runMode: TerrainBenchmarkRunMode,
  variant: TerrainBenchmarkVariant,
  densityMultiplier: number,
): TerrainBenchmarkSnapshot {
  return {
    activeMode: "webgpu",
    assets: { groundArrayRequests: 0, propCatalogRequests: 0 },
    chunks: {
      builtPages: 0,
      commitMaxMs: 0,
      commitP95Ms: 0,
      committedWindows: 0,
      lifecyclePagesVisited: 0,
      prepareMaxMs: 0,
      prepareP95Ms: 0,
      requestedWindows: 0,
      reusedPages: 0,
      staleWindows: 0,
    },
    contractVersion: TERRAIN_BENCHMARK_CONTRACT_VERSION,
    densityMultiplier,
    coverage: { checks: 0, missingFrames: 0, missingSamples: 0, samples: 0 },
    fixture: {
      cellCount: TERRAIN_BENCHMARK_CELL_COLUMNS * TERRAIN_BENCHMARK_CELL_ROWS,
      fingerprint: TERRAIN_BENCHMARK_FIXTURE_ID,
      pageCount: TERRAIN_BENCHMARK_PAGE_COLUMNS * TERRAIN_BENCHMARK_PAGE_ROWS,
      visiblePageCount: TERRAIN_BENCHMARK_WINDOW_COLUMNS * TERRAIN_BENCHMARK_WINDOW_ROWS,
    },
    frames: { motion: { ...EMPTY_FRAME_STATS }, static: { ...EMPTY_FRAME_STATS } },
    lifecycle: { geometryGrowth: 0, textureGrowth: 0 },
    longTasks: { count: 0, maxMs: 0 },
    render: {
      drawCalls: 0,
      firstRenderMs: 0,
      geometries: 0,
      pixelRatio: 1,
      propInstances: 0,
      textures: 0,
      triangles: 0,
    },
    runMode,
    status: "ready",
    variant,
  };
}
