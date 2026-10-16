import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { HudScene } from "./hud-scene";

/** Fixture scale changes preserve the mounted game renderer and camera. */
export function HudRedesignLab() {
  const [params, setParams] = useSearchParams();
  const count = [3, 25, 220].find((value) => value === Number(params.get("count"))) ?? 3;
  const capture = params.get("capture") === "1";
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ProceduralTerrainDebugRendererHandle | null>(null);
  const [status, setStatus] = useState("Loading the game terrain…");
  const [camera, setCamera] = useState({ hex: { col: 9, row: 6 }, distance: 34 });
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ group: string; elements: string[] }[]>([]);
  useEffect(() => {
    let mounted = true;
    const frame = requestAnimationFrame(() => {
      void mountProceduralTerrainDebugRenderer({
        canvas: canvas.current!,
        captureMode: false,
        forceWebGL: true,
        qualityTier: "balanced",
        revealProgress: 1,
        sceneId: "settlement-regrowth",
        texturedGround: true,
        onError: (reason) => {
          if (mounted) setError(String(reason));
        },
        onReady: () => {},
        onCameraChange: (value) => {
          if (mounted) setCamera(value);
        },
      })
        .then((handle) => {
          if (!mounted) {
            handle.dispose();
            return;
          }
          renderer.current = handle;
          setStatus("ready");
        })
        .catch((reason) => {
          if (mounted) setError(String(reason));
        });
    });
    const move = (event: Event) =>
      renderer.current?.moveCameraToHex((event as CustomEvent<{ col: number; row: number }>).detail);
    const zoom = (event: Event) =>
      renderer.current?.zoomCamera((event as CustomEvent<{ zoomOut: boolean }>).detail.zoomOut);
    addEventListener("minimapCameraMove", move);
    addEventListener("minimapZoom", zoom);
    return () => {
      removeEventListener("minimapCameraMove", move);
      removeEventListener("minimapZoom", zoom);
      mounted = false;
      cancelAnimationFrame(frame);
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, []);
  const choose = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  return (
    <div className="hud-redesign">
      {!capture && (
        <div className="hud-lab-controls" aria-label="HUD fixture controls">
          <label>
            Structures{" "}
            <select aria-label="Fixture scale" value={count} onChange={(e) => choose("count", e.target.value)}>
              <option value="3">Blitz · 3</option>
              <option value="25">Blitz · 25</option>
              <option value="220">Eternum · 220</option>
            </select>
          </label>
          <button onClick={() => renderer.current?.resetCamera()}>Reset camera</button>
          <details>
            <summary>{groups.reduce((sum, group) => sum + group.elements.length, 0)} noticed units</summary>
            {groups.map((group) => (
              <p key={group.group}>
                <b>{group.group}:</b> {group.elements.join(" · ")}
              </p>
            ))}
          </details>
        </div>
      )}
      <div className="hud-lab-stage">
        <div className="hud-live-map" data-renderer-state={error ? "error" : status}>
          <canvas ref={canvas} aria-label="Live game terrain" />
          {status !== "ready" && !error && <p role="status">{status}</p>}
          {error && <p role="alert">{error}</p>}
        </div>
        <HudScene key={count} count={count} camera={camera} onReadout={setGroups} />
      </div>
    </div>
  );
}
