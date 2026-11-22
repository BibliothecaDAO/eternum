import { useEffect, useRef, useState } from "react";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import type { ProceduralTerrainDebugRendererHandle } from "@/three/debug/procedural-terrain-debug-renderer";
import type { AspectStanding } from "./aspect-page-view";
import { AspectRaceStage } from "./aspect-race-stage";

const canMountRenderer = (): boolean => {
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
};

export function AspectRaceCanvas({
  standings,
  finishHeight,
}: {
  standings: readonly AspectStanding[];
  finishHeight: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<AspectRaceStage | null>(null);
  const handleRef = useRef<ProceduralTerrainDebugRendererHandle | null>(null);
  const initialRef = useRef({ standings, finishHeight });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stageRef.current?.setStandings(standings, finishHeight);
  }, [standings, finishHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host || !canMountRenderer()) return;
    let cancelled = false;
    let visible = true;
    const stage = new AspectRaceStage(initialRef.current.standings, initialRef.current.finishHeight);
    stageRef.current = stage;

    const syncClock = () => {
      const active = visible && document.visibilityState === "visible";
      handleRef.current?.setClock({ scale: active ? 1 : 0, fixedStep: false });
    };

    const reportError = (cause: unknown) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            syncClock();
          });
    observer?.observe(host);
    document.addEventListener("visibilitychange", syncClock);

    void import("@/three/debug/procedural-terrain-debug-renderer")
      .then(({ mountProceduralTerrainDebugRenderer }) => {
        if (cancelled) return null;
        return mountProceduralTerrainDebugRenderer({
          canvas,
          stage,
          gameMode: "frontier",
          captureMode: false,
          forceWebGL: false,
          qualityTier: "balanced",
          revealProgress: 1,
          sceneId: "arid-basin",
          texturedGround: true,
          onError: reportError,
          onReady: () => {
            if (cancelled) return;
            setError(null);
            setReady(true);
            syncClock();
          },
        });
      })
      .then((handle) => {
        if (!handle) return;
        if (cancelled) {
          handle.dispose();
          return;
        }
        handleRef.current = handle;
        syncClock();
      })
      .catch(reportError);

    return () => {
      cancelled = true;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", syncClock);
      handleRef.current?.dispose();
      handleRef.current = null;
      stageRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-race-stage
      data-ready={ready || undefined}
      data-error={error ? "true" : undefined}
      className="ui-race-stage"
    >
      <canvas ref={canvasRef} className="ui-race-stage__canvas" />
      {error && (
        <div className="absolute inset-x-3 top-3 z-10">
          <HudNotice tone="bad" line={error} />
        </div>
      )}
      <div className="ui-race-stage__plates" aria-hidden="true">
        {standings.map((standing) => (
          <span key={standing.aspectId} className="ui-race-stage__plate">
            <AspectMark aspect={standing.aspectId} size={28} decorative />
          </span>
        ))}
      </div>
    </div>
  );
}
