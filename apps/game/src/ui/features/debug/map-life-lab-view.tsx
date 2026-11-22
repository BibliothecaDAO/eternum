import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import {
  mountMapLifeLab,
  type MapLifeGround,
  type MapLifeLabHandle,
  type MapLifeLabStats,
} from "@/three/debug/map-life-lab-renderer";
import { cn } from "@/ui/design-system/atoms/lib/utils";

const PHONE_FRAME = { width: 390, height: 844 };

export const MapLifeLabView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<MapLifeLabHandle | null>(null);
  const ground: MapLifeGround = searchParams.get("ground") === "biome" ? "biome" : "neutral";
  const phone = searchParams.get("frame") === "phone";
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const [stats, setStats] = useState<MapLifeLabStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) return;
    let active = true;
    setStats(null);
    void mountMapLifeLab({ canvas, labels, forceWebGL, ground, onReady: (next) => active && setStats(next) })
      .then((handle) => {
        if (active) handleRef.current = handle;
        else handle.dispose();
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => {
      active = false;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [forceWebGL, ground, phone]);

  const setOption = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next);
  };

  return (
    <section
      className="flex min-h-[var(--lab-viewport-height)] flex-col gap-4 bg-stone-950 p-4 text-stone-100 lg:grid lg:grid-cols-[minmax(260px,320px)_1fr]"
      data-debug-route="life"
      data-ready={stats ? "true" : "false"}
    >
      <aside className="flex flex-col gap-4 border border-white/10 bg-black/55 p-4">
        <div>
          <p className="text-sm font-semibold text-emerald-200/70">Map life</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Every prop and animal</h1>
          <p className="mt-2 text-sm text-stone-300">
            Front row: each prop kind the map grows. Back row: the sixteen animals. A knight stands beside each for
            scale.
          </p>
        </div>
        <LabSelect label="Ground" value={ground} onChange={(value) => setOption("ground", value)}>
          <option value="neutral">Neutral</option>
          <option value="biome">Its biome&apos;s ground colour</option>
        </LabSelect>
        <LabSelect label="Frame" value={phone ? "phone" : "desktop"} onChange={(value) => setOption("frame", value)}>
          <option value="desktop">Desktop</option>
          <option value="phone">Phone (390 × 844)</option>
        </LabSelect>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <LabMetric label="Tiles" value={stats ? String(stats.tiles) : "--"} />
          <LabMetric label="Backend" value={stats ? stats.activeMode : "--"} />
          <LabMetric label="Draws" value={stats ? String(stats.drawCalls) : "--"} />
          <LabMetric label="Tris" value={stats ? stats.triangles.toLocaleString() : "--"} />
        </dl>
        <button
          type="button"
          onClick={() => handleRef.current?.resetCamera()}
          className="mt-auto flex h-10 items-center justify-center gap-2 border border-emerald-300/35 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100"
        >
          <SemanticIcon name="refresh" className="h-4 w-4" />
          Reset camera
        </button>
      </aside>
      <div className="flex min-h-[620px] items-start justify-center overflow-auto">
        <div
          className={cn("relative overflow-hidden bg-[#20241f]", !phone && "h-[78vh] w-full")}
          style={phone ? PHONE_FRAME : undefined}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Every map prop and animal" />
          <div ref={labelsRef} className="absolute inset-0 touch-none" />
          {error && (
            <div className="absolute inset-x-4 bottom-4 border border-red-300/40 bg-red-950/85 p-3 text-sm text-red-100">
              {error}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const LabSelect = ({
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
  <label className="flex flex-col gap-2 text-sm font-semibold text-stone-300">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium text-white"
    >
      {children}
    </select>
  </label>
);

const LabMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-white/10 bg-white/[0.04] px-3 py-2">
    <dt className="text-sm font-semibold text-stone-400">{label}</dt>
    <dd className="mt-1 font-mono text-sm text-white">{value}</dd>
  </div>
);
