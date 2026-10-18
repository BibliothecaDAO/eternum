import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LOCAL_CAMERA_ZOOM } from "@/three/constants/rendering";
import {
  mountWorkshopLab,
  WORKSHOP_LINEUP,
  type WorkshopLabSettings,
} from "@/three/debug/model-lab/workshop-lab-renderer";
import "./workshop-model-lab.css";

export function WorkshopModelLab() {
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<Awaited<ReturnType<typeof mountWorkshopLab>> | null>(null);
  const [status, setStatus] = useState("Loading the three models…");
  const [assets, setAssets] = useState<string[]>([]);
  const distance = Number(params.get("distance") ?? LOCAL_CAMERA_ZOOM.defaultDistance);
  const yaw = Number(params.get("yaw") ?? 30);
  const focus = params.get("focus");
  const settings: WorkshopLabSettings = {
    focus: focus === "workshop" ? focus : "lineup",
    distance: focus === "workshop" ? 5 : [10, 14, 20].includes(distance) ? distance : 14,
    yaw: [0, 30, 90, 180, 270].includes(yaw) ? yaw : 30,
    lighting: params.get("lighting") === "sunset" ? "sunset" : "day",
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    const controller = new AbortController();
    let mounted: typeof view.current = null;
    void mountWorkshopLab(host.current!, settingsRef.current, controller.signal)
      .then((next) => {
        mounted = next;
        if (controller.signal.aborted) return next.dispose();
        view.current = next;
        next.update(settingsRef.current);
        setAssets(next.assets);
        setStatus("Craft Yard · production Workshop");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(`Error: ${String(error)}`);
      });
    return () => {
      controller.abort();
      mounted?.dispose();
      view.current = null;
    };
  }, []);
  useEffect(() => {
    view.current?.update(settingsRef.current);
  }, [settings.distance, settings.focus, settings.yaw, settings.lighting]);
  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });
  return (
    <main
      className="workshop-lab"
      data-workshop-ready={assets.length === WORKSHOP_LINEUP.length}
      data-workshop-assets={JSON.stringify(assets)}
    >
      <header>
        <Link to="/lab/models">Models</Link>
        <h1>Workshop · Craft Yard</h1>
        <label>
          View{" "}
          <select
            aria-label="View"
            value={settings.focus === "lineup" ? settings.distance : settings.focus}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              const choice = e.target.value;
              next.set("focus", choice === "workshop" ? choice : "lineup");
              next.set("distance", choice === "workshop" ? "5" : choice);
              setParams(next);
            }}
          >
            <option value="14">Gameplay</option>
            <option value="10">Closer</option>
            <option value="20">Farther</option>
            <option value="workshop">Workshop detail</option>
          </select>
        </label>
        <label>
          Turn{" "}
          <select aria-label="Turn" value={settings.yaw} onChange={(e) => change("yaw", e.target.value)}>
            <option value="30">Three-quarter</option>
            <option value="0">Front</option>
            <option value="90">Left</option>
            <option value="180">Back</option>
            <option value="270">Right</option>
          </select>
        </label>
        <label>
          Light{" "}
          <select aria-label="Light" value={settings.lighting} onChange={(e) => change("lighting", e.target.value)}>
            <option value="day">Day</option>
            <option value="sunset">Sunset</option>
          </select>
        </label>
      </header>
      <p role="status">{status}. Compared at game scale.</p>
      <div className="workshop-lab-labels">
        {WORKSHOP_LINEUP.map((asset) => (
          <span key={asset.path}>{asset.label}</span>
        ))}
      </div>
      <div ref={host} className="workshop-lab-canvas" />
      <footer>Drag to orbit · scroll to inspect · all three buildings at their game scale</footer>
    </main>
  );
}
