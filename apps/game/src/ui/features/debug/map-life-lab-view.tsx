import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import {
  mountMapLifeLab,
  mountWildlifeLab,
  WILDLIFE_LAB_SPECIES,
  type MapLifeGround,
  type MapLifeLabHandle,
  type MapLifeLabStats,
  type WildlifeLabCameraView,
  type WildlifeLabHandle,
} from "@/three/debug/map-life-lab-renderer";
import { cn } from "@/ui/design-system/atoms/lib/utils";

const PHONE_FRAME = { width: 390, height: 844 };
const DEFAULT_CAMERA_DISTANCE: Record<WildlifeLabCameraView, number> = { flank: 4, map: 5 };

export const MapLifeLabView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const galleryRef = useRef<MapLifeLabHandle | null>(null);
  const paddock = searchParams.get("mode") === "paddock";
  const capture = searchParams.get("capture") === "1";
  const ground: MapLifeGround = searchParams.get("ground") === "biome" ? "biome" : "neutral";
  const phone = searchParams.get("frame") === "phone";
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const species = WILDLIFE_LAB_SPECIES.find((candidate) => candidate === searchParams.get("species")) ?? null;
  const cameraView: WildlifeLabCameraView = searchParams.get("view") === "map" ? "map" : "flank";
  const army = searchParams.get("army") === "1";
  const cameraDistance = Number(searchParams.get("distance")) || DEFAULT_CAMERA_DISTANCE[cameraView];
  const [stats, setStats] = useState<MapLifeLabStats | null>(null);
  const [paddockReady, setPaddockReady] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paddock) return;
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) return;
    let active = true;
    setStats(null);
    setError(null);
    void mountMapLifeLab({ canvas, labels, forceWebGL, ground, onReady: (next) => active && setStats(next) })
      .then((handle) => {
        if (active) galleryRef.current = handle;
        else handle.dispose();
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => {
      active = false;
      galleryRef.current?.dispose();
      galleryRef.current = null;
    };
  }, [forceWebGL, ground, paddock, phone]);

  useEffect(() => {
    if (!paddock) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    let handle: WildlifeLabHandle | null = null;
    setPaddockReady(false);
    setError(null);
    const mountFrame = window.requestAnimationFrame(() => {
      void mountWildlifeLab({
        cameraDistance,
        cameraView,
        canvas,
        captureMode: capture,
        forceWebGL,
        species,
        army,
        onReady: () => active && setPaddockReady(true),
      })
        .then((mounted) => {
          if (active) handle = mounted;
          else mounted.dispose();
        })
        .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    });
    const readActivity = window.setInterval(() => {
      const followed = handle?.getStats().wildlife.creatures.find((creature) => creature.species === species);
      setActivity(followed?.activity ?? null);
    }, 250);
    return () => {
      active = false;
      window.cancelAnimationFrame(mountFrame);
      window.clearInterval(readActivity);
      handle?.dispose();
      setPaddockReady(false);
    };
  }, [army, cameraDistance, cameraView, capture, forceWebGL, paddock, species]);

  const setOption = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  if (paddock) {
    return (
      <section
        className={cn(
          "min-h-[var(--lab-viewport-height)] bg-stone-950 text-stone-100",
          capture ? "block" : "flex flex-col gap-3 p-4",
        )}
        data-debug-route="life"
        data-ready={paddockReady ? "true" : "false"}
      >
        {!capture && (
          <div className="flex flex-wrap items-end gap-3">
            <LabSelect label="Mode" value="paddock" onChange={(value) => setOption("mode", value)}>
              <option value="">Gallery</option>
              <option value="paddock">Wildlife paddocks</option>
            </LabSelect>
            <LabSelect label="Animal" value={species ?? ""} onChange={(value) => setOption("species", value)}>
              <option value="">Every paddock</option>
              {WILDLIFE_LAB_SPECIES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </LabSelect>
            <LabSelect label="Camera" value={cameraView} onChange={(value) => setOption("view", value)}>
              <option value="flank">Flank</option>
              <option value="map">World map</option>
            </LabSelect>
            <LabSelect label="Army" value={army ? "1" : ""} onChange={(value) => setOption("army", value)}>
              <option value="">None</option>
              <option value="1">Marches past</option>
            </LabSelect>
            {activity && <p className="pb-2 text-sm text-stone-300">Now: {activity}</p>}
          </div>
        )}
        <div className={cn("relative overflow-hidden", capture ? "h-screen w-screen" : "min-h-[620px] flex-1")}>
          <canvas
            ref={canvasRef}
            className={cn("h-full w-full touch-none", !capture && "min-h-[620px]")}
            aria-label="Map wildlife"
          />
          {error && (
            <div className="absolute inset-x-4 bottom-4 border border-red-300/40 bg-red-950/85 p-3 text-sm text-red-100">
              {error}
            </div>
          )}
        </div>
      </section>
    );
  }

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
        <LabSelect label="Mode" value="" onChange={(value) => setOption("mode", value)}>
          <option value="">Gallery</option>
          <option value="paddock">Wildlife paddocks</option>
        </LabSelect>
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
          onClick={() => galleryRef.current?.resetCamera()}
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
