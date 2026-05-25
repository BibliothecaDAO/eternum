import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  debugChunkScenarios,
  isDebugChunkScenarioId,
  resolveDebugChunkMetrics,
  resolveDebugChunkScenario,
  type DebugChunkScenarioId,
} from "@/three/debug/three-chunk-debug-fixture";
import {
  mountThreeChunkDebugRenderer,
  type ThreeChunkDebugFrameStats,
  type ThreeChunkDebugRendererHandle,
} from "@/three/debug/three-chunk-debug-renderer";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

const INITIAL_FRAME_STATS: ThreeChunkDebugFrameStats = {
  fps: 0,
  frameMs: 0,
  renderedChunks: 0,
  drawCalls: 0,
  triangles: 0,
};

const integerFormatter = new Intl.NumberFormat("en-US");

export const ThreeChunkDebugView = () => {
  useBootDocumentState("app-ready", "three_chunk_debug_ready");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ThreeChunkDebugRendererHandle | null>(null);
  const [scenarioId, setScenarioId] = useState<DebugChunkScenarioId>("baseline");
  const [frameStats, setFrameStats] = useState<ThreeChunkDebugFrameStats>(INITIAL_FRAME_STATS);
  const [rendererError, setRendererError] = useState<string | null>(null);

  const scenario = useMemo(() => resolveDebugChunkScenario(scenarioId), [scenarioId]);
  const metrics = useMemo(() => resolveDebugChunkMetrics(scenario), [scenario]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setRendererError(null);
      rendererRef.current = mountThreeChunkDebugRenderer({
        canvas,
        scenario,
        onFrame: setFrameStats,
      });
    } catch (error) {
      rendererRef.current = null;
      setRendererError(resolveRendererErrorMessage(error));
    }

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [scenario]);

  const handleScenarioChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextScenarioId = event.target.value;
    if (!isDebugChunkScenarioId(nextScenarioId)) {
      return;
    }

    setFrameStats(INITIAL_FRAME_STATS);
    setScenarioId(nextScenarioId);
  }, []);

  const handleResetCamera = useCallback(() => {
    rendererRef.current?.resetCamera();
  }, []);

  return (
    <section
      className="flex min-h-screen flex-col gap-4 bg-slate-950 p-4 text-slate-100 lg:grid lg:grid-cols-[minmax(260px,320px)_1fr]"
      data-debug-route="three-chunks"
    >
      <aside className="flex flex-col gap-4 border border-white/10 bg-black/55 p-4 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-sky-200/70">Renderer Debug</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Three.js Chunks</h1>
          </div>
          <Link
            to="/"
            className="border border-white/15 px-3 py-2 text-xs font-semibold uppercase text-slate-200 transition-colors hover:bg-white/10"
          >
            Exit
          </Link>
        </div>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-300">
          Scenario
          <select
            value={scenarioId}
            onChange={handleScenarioChange}
            className={cn(
              "h-10 border border-white/15 bg-slate-950/90 px-3 text-sm font-medium normal-case tracking-normal text-white",
              "outline-none transition-colors focus:border-sky-300",
            )}
            aria-label="Debug scenario"
          >
            {debugChunkScenarios.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <DebugMetric label="Chunks" value={formatInteger(metrics.chunkCount)} />
          <DebugMetric label="Tiles" value={formatInteger(metrics.tileCount)} />
          <DebugMetric label="Hot" value={formatInteger(metrics.hotChunkCount)} />
          <DebugMetric label="Budget" value={formatInteger(metrics.estimatedDrawCalls)} />
          <DebugMetric label="FPS" value={frameStats.fps ? formatInteger(frameStats.fps) : "--"} />
          <DebugMetric label="Frame" value={frameStats.frameMs ? `${frameStats.frameMs} ms` : "--"} />
          <DebugMetric label="Calls" value={frameStats.drawCalls ? formatInteger(frameStats.drawCalls) : "--"} />
          <DebugMetric label="Tris" value={frameStats.triangles ? formatInteger(frameStats.triangles) : "--"} />
        </dl>

        <button
          type="button"
          onClick={handleResetCamera}
          className={cn(
            "mt-auto flex h-10 items-center justify-center gap-2 border border-sky-300/35 bg-sky-300/10 px-3",
            "text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-300/20",
          )}
        >
          <RefreshCw className="h-4 w-4" />
          Reset Camera
        </button>
      </aside>

      <div className="relative min-h-[520px] overflow-hidden border border-white/10 bg-slate-950 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <canvas
          ref={canvasRef}
          id="three-chunk-debug-canvas"
          className="h-full min-h-[520px] w-full touch-none"
          aria-label="Three.js chunk debug canvas"
        />
        {rendererError && (
          <div className="absolute inset-x-4 bottom-4 border border-red-300/40 bg-red-950/80 p-3 text-sm text-red-100 backdrop-blur">
            {rendererError}
          </div>
        )}
      </div>
    </section>
  );
};

const DebugMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-white/10 bg-white/[0.04] px-3 py-2">
    <dt className="text-[0.65rem] font-semibold uppercase text-slate-400">{label}</dt>
    <dd className="mt-1 font-mono text-base text-white">{value}</dd>
  </div>
);

const formatInteger = (value: number): string => integerFormatter.format(value);

const resolveRendererErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Unable to start the debug renderer.";
};
