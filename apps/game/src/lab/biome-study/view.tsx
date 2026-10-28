import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
} from "@/three/debug/procedural-terrain-debug-renderer";

import { BIOME_APPROACHES, BIOME_SHOTS, BiomeStudyStage, type BiomeApproach, type BiomeShot } from "./stage";

const isApproach = (value: string | null): value is BiomeApproach =>
  value !== null && Object.hasOwn(BIOME_APPROACHES, value);
const isShot = (value: string | null): value is BiomeShot => value !== null && Object.hasOwn(BIOME_SHOTS, value);

type BiomeStudyWindow = Window & {
  __biomeStudy?: {
    approach: BiomeApproach;
    land: ReturnType<BiomeStudyStage["landStats"]>;
    look(shot: BiomeShot): void;
  };
};

/**
 * The biome study (`/lab/biome-study`): the World biomes field drawn by today's terrain or one of the study's
 * approaches (`approach=`), an army and a realm on it, seen from one of the game's zooms (`shot=`). `capture=1` draws
 * the land alone, for stills.
 */
export function BiomeStudyView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const approach = isApproach(searchParams.get("approach")) ? (searchParams.get("approach") as BiomeApproach) : "today";
  const shot = isShot(searchParams.get("shot")) ? (searchParams.get("shot") as BiomeShot) : "play";
  const capture = searchParams.get("capture") === "1";
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stage = useRef<BiomeStudyStage | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let renderer: ProceduralTerrainDebugRendererHandle | null = null;
    const study = new BiomeStudyStage(approach);
    void mountProceduralTerrainDebugRenderer({
      canvas: canvas.current!,
      captureMode: false,
      stage: study,
      gameMode: "frontier",
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
        stage.current = study;
        (window as BiomeStudyWindow).__biomeStudy = {
          approach,
          land: study.landStats(),
          look: (next) => study.look(next),
        };
        setReady(true);
      })
      .catch((reason) => active && setError(String(reason)));
    return () => {
      active = false;
      setReady(false);
      stage.current = null;
      delete (window as BiomeStudyWindow).__biomeStudy;
      delete document.documentElement.dataset.biomeStudy;
      renderer?.dispose();
    };
  }, [approach, forceWebGL]);

  // The camera moves on the drawn land; only a new approach or backend draws a new land.
  useEffect(() => {
    if (!ready) return;
    stage.current?.look(shot);
    document.documentElement.dataset.biomeStudy = "ready";
  }, [ready, shot]);

  const choose = (key: "approach" | "shot", value: string) =>
    setSearchParams((params) => {
      params.set(key, value);
      return params;
    });

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label="Biome study land" />
      {!capture && (
        <aside className="absolute left-3 top-3 flex max-w-[22rem] flex-col gap-2 rounded bg-black/70 p-3 text-sm text-white">
          <p role="status">{error ?? (ready ? BIOME_APPROACHES[approach] : "Drawing the land…")}</p>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(BIOME_APPROACHES) as BiomeApproach[]).map((key) => (
              <button
                key={key}
                aria-pressed={key === approach}
                className="rounded border border-white/30 px-2 py-1 aria-pressed:bg-white aria-pressed:text-black"
                onClick={() => choose("approach", key)}
              >
                {BIOME_APPROACHES[key]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(BIOME_SHOTS) as BiomeShot[]).map((key) => (
              <button
                key={key}
                aria-pressed={key === shot}
                className="rounded border border-white/30 px-2 py-1 aria-pressed:bg-white aria-pressed:text-black"
                onClick={() => choose("shot", key)}
              >
                {BIOME_SHOTS[key].label}
              </button>
            ))}
          </div>
        </aside>
      )}
    </main>
  );
}
