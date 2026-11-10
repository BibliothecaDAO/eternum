import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  mountWildlifeLab,
  WILDLIFE_LAB_SPECIES,
  type WildlifeLabCameraView,
  type WildlifeLabHandle,
} from "@/three/debug/wildlife-lab-renderer";
import { cn } from "@/ui/design-system/atoms/lib/utils";

/** The flank view stands four of the animal's sizes away; the map view at the world map's closest zoom. */
const DEFAULT_CAMERA_DISTANCE: Record<WildlifeLabCameraView, number> = { flank: 4, map: 5 };

/**
 * The map's animals at arm's length: the production wildlife on one flat paddock per biome, so each species' size,
 * gait and idle behaviour can be judged before the map shows it. `species` follows one animal, `view=map` looks at it
 * as the world map's camera does, and `capture=1` holds the clock for `window.__wildlifeLab.step`.
 */
export const WildlifeLabView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const capture = searchParams.get("capture") === "1";
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const species = WILDLIFE_LAB_SPECIES.find((candidate) => candidate === searchParams.get("species")) ?? null;
  const cameraView: WildlifeLabCameraView = searchParams.get("view") === "map" ? "map" : "flank";
  const army = searchParams.get("army") === "1";
  const cameraDistance = Number(searchParams.get("distance")) || DEFAULT_CAMERA_DISTANCE[cameraView];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    let handle: WildlifeLabHandle | null = null;
    // Mounted on the next frame: a mount that an effect's rerun abandons would dispose its renderer on this canvas and
    // lose the context the next mount draws with.
    const mountFrame = window.requestAnimationFrame(() => {
      void mountWildlifeLab({
        cameraDistance,
        cameraView,
        canvas,
        captureMode: capture,
        forceWebGL,
        species,
        army,
        onReady: () => active && setReady(true),
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
      setReady(false);
    };
  }, [army, cameraDistance, cameraView, capture, forceWebGL, species]);

  const setOption = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <section
      className={cn(
        "min-h-[var(--lab-viewport-height)] bg-stone-950 text-stone-100",
        capture ? "block" : "flex flex-col gap-3 p-4",
      )}
      data-debug-route="wildlife"
      data-ready={ready ? "true" : "false"}
    >
      {!capture && (
        <div className="flex flex-wrap items-end gap-3">
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
};

const LabSelect = ({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange(value: string): void;
  value: string;
}) => (
  <label className="flex flex-col gap-1 text-sm font-semibold text-stone-300">
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
