import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  mountFrontierPaintedLab,
  type FrontierPaintedLabSettings,
} from "@/three/debug/model-lab/frontier-painted-lab-renderer";
import {
  FRONTIER_PAINTED_BUILDINGS,
  FRONTIER_PAINTED_GROUPS,
  type FrontierPaintedGroup,
} from "@/three/structures/frontier-painted-buildings";
import "./frontier-painted-lab.css";

const DISTANCES = [4, 10, 14, 20, 28];
const YAWS = [0, 60, 120, 180, 240, 300];

/** The painted Frontier building set at game scale, one group at a time, with the shipped models it would replace. */
export function FrontierPaintedLab() {
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<Awaited<ReturnType<typeof mountFrontierPaintedLab>> | null>(null);
  const [status, setStatus] = useState("Loading the set…");
  const [assets, setAssets] = useState<string[]>([]);
  const inGame = params.get("scene") === "game";
  const settings = readSettings(params);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (inGame) return;
    const controller = new AbortController();
    let mounted: typeof view.current = null;
    setAssets([]);
    setStatus("Loading the set…");
    void mountFrontierPaintedLab(host.current!, settingsRef.current, controller.signal)
      .then((next) => {
        mounted = next;
        if (controller.signal.aborted) return next.dispose();
        view.current = next;
        setAssets(next.assets);
        setStatus(groupLabel(settingsRef.current.group));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(`Error: ${String(error)}`);
      });
    return () => {
      controller.abort();
      mounted?.dispose();
      view.current = null;
    };
  }, [settings.group, settings.compare, settings.shipped, inGame]);

  useEffect(() => {
    view.current?.update(settingsRef.current);
  }, [settings.distance, settings.focus, settings.yaw, settings.lighting, settings.camera]);

  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });

  return (
    <main
      className="frontier-painted-lab"
      data-painted-ready={assets.length > 0}
      data-painted-assets={JSON.stringify(assets)}
    >
      <header>
        <Link to="/lab/models">Models</Link>
        <h1>Frontier buildings · painted set</h1>
        <button type="button" onClick={() => change("scene", inGame ? "models" : "game")}>
          {inGame ? "Compare models" : "Try the board and map"}
        </button>
        {!inGame && (
          <>
            <label>
              Set{" "}
              <select aria-label="Set" value={settings.group} onChange={(e) => change("group", e.target.value)}>
                {FRONTIER_PAINTED_GROUPS.map(({ group, label }) => (
                  <option key={group} value={group}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compare{" "}
              <select
                aria-label="Compare"
                value={settings.shipped ? "only-shipped" : settings.compare ? "shipped" : "set"}
                onChange={(e) => change("compare", e.target.value)}
              >
                <option value="set">Painted set</option>
                <option value="only-shipped">Shipped set</option>
                <option value="shipped">With the shipped models behind</option>
              </select>
            </label>
            <label>
              Focus{" "}
              <select
                aria-label="Focus"
                value={settings.focus === null ? "set" : members(settings.group)[settings.focus].id}
                onChange={(e) => change("focus", e.target.value)}
              >
                <option value="set">Whole set</option>
                {members(settings.group).map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Camera{" "}
              <select aria-label="Camera" value={settings.camera} onChange={(e) => change("camera", e.target.value)}>
                <option value="board">Realm board</option>
                <option value="worldmap">World map</option>
              </select>
            </label>
            <label>
              View{" "}
              <select aria-label="View" value={settings.distance} onChange={(e) => change("distance", e.target.value)}>
                <option value="14">Gameplay</option>
                <option value="4">Detail</option>
                <option value="10">Closer</option>
                <option value="20">Farther</option>
                <option value="28">Whole set</option>
              </select>
            </label>
            <label>
              Turn{" "}
              <select
                aria-label="Turn"
                value={settings.yaw}
                disabled={settings.group === "realms"}
                title={settings.group === "realms" ? "Realm castles face the camera, as in the game" : undefined}
                onChange={(e) => change("yaw", e.target.value)}
              >
                {YAWS.map((yaw) => (
                  <option key={yaw} value={yaw}>
                    {yaw}°
                  </option>
                ))}
              </select>
            </label>
            <label>
              Light{" "}
              <select aria-label="Light" value={settings.lighting} onChange={(e) => change("lighting", e.target.value)}>
                <option value="day">Day</option>
                <option value="sunset">Sunset</option>
              </select>
            </label>
          </>
        )}
      </header>
      <p role="status">
        {inGame
          ? "Local Frontier game. Use Realm and World to inspect the Kingdom, eight buildings and nearby sites."
          : `${status}. Game renderer, terrain and lighting at game scale.`}
      </p>
      {inGame ? (
        <iframe
          title="Frontier board and map"
          className="frontier-painted-lab-canvas"
          src="/lab/game?scenario=painted-buildings"
        />
      ) : (
        <div ref={host} className="frontier-painted-lab-canvas" />
      )}
      <footer>
        {inGame
          ? "Select an empty plot to preview a building · return to Compare models for the full set"
          : "Drag to orbit · scroll to inspect · a board building turns in steps of 60° while its banner holds its heading · realm castles face the camera"}
      </footer>
    </main>
  );
}

function readSettings(params: URLSearchParams): FrontierPaintedLabSettings {
  const group = FRONTIER_PAINTED_GROUPS.find(({ group }) => group === params.get("group"))?.group ?? "realms";
  const distance = Number(params.get("distance") ?? 14);
  const yaw = Number(params.get("yaw") ?? 0);
  const focus = members(group).findIndex((building) => building.id === params.get("focus"));
  return {
    group,
    compare: params.get("compare") === "shipped",
    shipped: params.get("compare") === "only-shipped",
    camera: params.get("camera") === "worldmap" ? "worldmap" : "board",
    focus: focus < 0 ? null : focus,
    distance: DISTANCES.includes(distance) ? distance : 14,
    // Realm castles face the camera in the game; they do not turn here either.
    yaw: group !== "realms" && YAWS.includes(yaw) ? yaw : 0,
    lighting: params.get("lighting") === "sunset" ? "sunset" : "day",
  };
}

function members(group: FrontierPaintedGroup) {
  return FRONTIER_PAINTED_BUILDINGS.filter((building) => building.group === group);
}

function groupLabel(group: FrontierPaintedGroup): string {
  return FRONTIER_PAINTED_GROUPS.find((entry) => entry.group === group)?.label ?? group;
}
