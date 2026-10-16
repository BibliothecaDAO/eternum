import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { HudScene } from "./hud-scene";
import { viewNames } from "./fixtures";

/** Both layouts share one mounted renderer: changing the HUD preserves the camera, light and terrain. */
export function HudRedesignLab() {
  const [params, setParams] = useSearchParams();
  const variant = params.get("variant") === "rails" ? "rails" : "current";
  const count = [3, 25, 220].find((value) => value === Number(params.get("count"))) ?? 3;
  const density = params.get("density") === "grouped" ? "grouped" : "rows";
  const placement = params.get("placement") === "right" ? "right" : "center";
  const nameIndex = [0, 1, 2].find((value) => value === Number(params.get("names"))) ?? 0;
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
        <div className="hud-lab-controls" aria-label="HUD comparison controls">
          <div aria-label="HUD layout">
            <button aria-pressed={variant === "current"} onClick={() => choose("variant", "current")}>
              Current HUD
            </button>
            <button aria-pressed={variant === "rails"} onClick={() => choose("variant", "rails")}>
              A · Guided rails
            </button>
          </div>
          <label>
            Structures{" "}
            <select aria-label="Fixture scale" value={count} onChange={(e) => choose("count", e.target.value)}>
              <option value="3">Blitz · 3</option>
              <option value="25">Blitz · 25</option>
              <option value="220">Eternum · 220</option>
            </select>
          </label>
          <label>
            Names{" "}
            <select aria-label="View names" value={nameIndex} onChange={(e) => choose("names", e.target.value)}>
              {viewNames.map((pair, index) => (
                <option key={index} value={index}>
                  {pair.join(" / ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            List{" "}
            <select aria-label="List density" value={density} onChange={(e) => choose("density", e.target.value)}>
              <option value="rows">Rows</option>
              <option value="grouped">Upgrade groups</option>
            </select>
          </label>
          <label>
            Commands{" "}
            <select
              aria-label="Action placement"
              value={placement}
              onChange={(e) => choose("placement", e.target.value)}
            >
              <option value="center">Bottom centre</option>
              <option value="right">Bottom right</option>
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
        <HudScene
          key={count}
          layout={variant}
          count={count}
          density={density}
          placement={placement}
          names={viewNames[nameIndex]}
          camera={camera}
          onReadout={setGroups}
        />
      </div>
    </div>
  );
}
