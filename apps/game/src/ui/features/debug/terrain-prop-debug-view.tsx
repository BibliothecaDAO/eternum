import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  mountTerrainPropDebugRenderer,
  type TerrainPropDebugRendererHandle,
  type TerrainPropDebugStats,
} from "@/three/debug/terrain-prop-debug-renderer";
import type { TerrainPropLod } from "@/three/terrain/terrain-prop-catalog";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

const EMPTY_STATS: TerrainPropDebugStats = {
  activeMode: "webgpu",
  drawCalls: 0,
  triangles: 0,
  visibleProps: 0,
};

export const TerrainPropDebugView = () => {
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<TerrainPropDebugRendererHandle | null>(null);
  const lod = resolveLod(searchParams.get("lod"));
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const capture = searchParams.get("capture") === "1";
  const [stats, setStats] = useState<TerrainPropDebugStats>(EMPTY_STATS);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useBootDocumentState(ready ? "app-ready" : "app-loading", ready ? "terrain_prop_debug_ready" : undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    let mountFrame = 0;

    mountFrame = window.requestAnimationFrame(() => {
      void mountTerrainPropDebugRenderer({
        canvas,
        forceWebGL,
        lod,
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
  }, [forceWebGL, lod]);

  const backendLabel = useMemo(() => (forceWebGL ? "WebGL2 fallback" : "WebGPU auto"), [forceWebGL]);

  const setOption = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    window.location.search = next.toString();
  };

  return (
    <section
      className={cn(
        "min-h-screen bg-stone-950 text-stone-100",
        capture ? "block" : "flex flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(260px,320px)_1fr]",
      )}
      data-debug-route="terrain-props"
      data-ready={ready ? "true" : "false"}
    >
      {!capture && (
        <aside className="flex flex-col gap-4 border border-white/10 bg-black/55 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-200/70">Terrain Assets</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">Ultimate Nature</h1>
            </div>
            <Link to="/" className="border border-white/15 px-3 py-2 text-xs font-semibold uppercase text-stone-200">
              Exit
            </Link>
          </div>

          <DebugSelect label="LOD" value={lod} onChange={(value) => setOption("lod", value)}>
            <option value="near">Near</option>
            <option value="far">Far</option>
          </DebugSelect>

          <DebugSelect
            label="Renderer"
            value={forceWebGL ? "webgpu-force-webgl" : "webgpu-auto"}
            onChange={(value) => setOption("rendererMode", value)}
          >
            <option value="webgpu-auto">WebGPU auto</option>
            <option value="webgpu-force-webgl">WebGL2 fallback</option>
          </DebugSelect>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <DebugMetric label="Backend" value={backendLabel} />
            <DebugMetric label="Props" value={String(stats.visibleProps || "--")} />
            <DebugMetric label="Calls" value={String(stats.drawCalls || "--")} />
            <DebugMetric label="Tris" value={stats.triangles ? stats.triangles.toLocaleString() : "--"} />
          </dl>

          <button
            type="button"
            onClick={() => rendererRef.current?.resetCamera()}
            className="mt-auto flex h-10 items-center justify-center gap-2 border border-emerald-300/35 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100"
          >
            <RefreshCw className="h-4 w-4" />
            Reset Camera
          </button>
        </aside>
      )}

      <div className={cn("relative overflow-hidden bg-[#d8d1bd]", capture ? "h-screen w-screen" : "min-h-[620px]")}>
        <canvas
          ref={canvasRef}
          id="terrain-prop-debug-canvas"
          className={cn("h-full w-full touch-none", !capture && "min-h-[620px]")}
          aria-label="Ultimate Nature terrain prop catalog"
        />
        {error && (
          <div className="absolute inset-x-4 bottom-4 border border-red-300/40 bg-red-950/85 p-3 text-sm text-red-100">
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
}: {
  children: ReactNode;
  label: string;
  onChange(value: string): void;
  value: string;
}) => (
  <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
    >
      {children}
    </select>
  </label>
);

const DebugMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-white/10 bg-white/[0.04] px-3 py-2">
    <dt className="text-[0.65rem] font-semibold uppercase text-stone-400">{label}</dt>
    <dd className="mt-1 font-mono text-sm text-white">{value}</dd>
  </div>
);

const resolveLod = (value: string | null): TerrainPropLod => (value === "far" ? "far" : "near");
