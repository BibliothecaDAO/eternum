import "./aspect-race-canvas.css";

import { useEffect, useRef, useState } from "react";

import type { AspectRaceRendererHandle } from "@/three/race/aspect-race-renderer";
import type { TowerPlateAnchor } from "@/three/race/aspect-race-world";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import type { AspectStanding } from "./aspect-page-view";

const canMountRenderer = (): boolean => {
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
};

const defaultAnchors = (standings: readonly AspectStanding[]): TowerPlateAnchor[] =>
  standings.map((standing, index) => ({
    aspectId: standing.aspectId,
    leftPercent: ((index + 0.5) / Math.max(1, standings.length)) * 100,
    topPercent: 86,
  }));

export function AspectRaceCanvas({
  standings,
  finishHeight,
}: {
  standings: readonly AspectStanding[];
  finishHeight: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<AspectRaceRendererHandle | null>(null);
  const latestRef = useRef({ standings, finishHeight });
  latestRef.current = { standings, finishHeight };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<readonly TowerPlateAnchor[]>(() => defaultAnchors(standings));

  useEffect(() => {
    if (handleRef.current) {
      handleRef.current.setStandings(standings, finishHeight);
    } else {
      setAnchors(defaultAnchors(standings));
    }
  }, [standings, finishHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host || !canMountRenderer()) return;
    let cancelled = false;
    let visible = true;

    const syncPaused = () => {
      const active = visible && document.visibilityState === "visible";
      handleRef.current?.setPaused(!active);
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
            syncPaused();
          });
    observer?.observe(host);
    document.addEventListener("visibilitychange", syncPaused);

    void import("@/three/race/aspect-race-renderer")
      .then(({ mountAspectRaceRenderer }) => {
        if (cancelled) return null;
        return mountAspectRaceRenderer({
          canvas,
          standings: latestRef.current.standings,
          finishHeight: latestRef.current.finishHeight,
          onAnchors: (next) => {
            if (!cancelled) setAnchors(next);
          },
          onError: reportError,
          onReady: () => {
            if (cancelled) return;
            setError(null);
            setReady(true);
            syncPaused();
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
        handle.setStandings(latestRef.current.standings, latestRef.current.finishHeight);
        syncPaused();
      })
      .catch(reportError);

    return () => {
      cancelled = true;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", syncPaused);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-race-stage
      data-ready={ready || undefined}
      data-error={error ? "true" : undefined}
      className="race-stage"
    >
      <canvas ref={canvasRef} className="race-stage__canvas" />
      {error && (
        <div className="absolute inset-x-3 top-3 z-10">
          <HudNotice tone="bad" line={error} />
        </div>
      )}
      <div className="race-stage__plates" aria-hidden="true">
        {anchors.map((anchor) => (
          <span
            key={anchor.aspectId}
            className="race-stage__plate"
            style={{ left: `${anchor.leftPercent}%`, top: `${anchor.topPercent}%` }}
          >
            <AspectMark aspect={anchor.aspectId} size={22} decorative />
          </span>
        ))}
      </div>
    </div>
  );
}
