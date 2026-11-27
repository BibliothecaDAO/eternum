import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { mountDeepSeries, type DeepSeriesSettings } from "@/three/debug/model-lab/deep-series-renderer";

const VIEW_DISTANCES = [
  [5, "Detail"],
  [8, "Close"],
  [16, "Gameplay"],
] as const;

const DEFAULT_DISTANCE = VIEW_DISTANCES[2][0];
const YAW_OPTIONS = [-35, 0, 35, 180] as const;
const DEFAULT_YAW = YAW_OPTIONS[0];

export function DeepSeriesLab() {
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading");
  const [loaded, setLoaded] = useState("");
  const settings: DeepSeriesSettings = {
    set: params.get("set") === "sites" ? "sites" : "gates",
    distance: Number(params.get("distance") ?? DEFAULT_DISTANCE),
    yaw: Number(params.get("yaw") ?? DEFAULT_YAW),
  };
  const signature = JSON.stringify(settings);

  useEffect(() => {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    setStatus("Loading");
    void mountDeepSeries(host.current!, JSON.parse(signature), controller.signal)
      .then((view) => {
        dispose = view.dispose;
        if (controller.signal.aborted) dispose();
        else {
          setStatus(view.labels.join(" · "));
          setLoaded(signature);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(`Error: ${error.message}`);
      });
    return () => {
      controller.abort();
      dispose?.();
    };
  }, [signature]);

  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });

  return (
    <main
      style={{
        height: "var(--lab-viewport-height, 100vh)",
        display: "flex",
        flexDirection: "column",
        background: "#17202b",
        color: "#eee",
      }}
    >
      <header style={{ padding: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/lab/models">Models</Link>
        <strong>Deep · gates & sites</strong>
        <label>
          Set{" "}
          <select aria-label="Set" value={settings.set} onChange={(e) => change("set", e.target.value)}>
            <option value="gates">Gates</option>
            <option value="sites">Sites</option>
          </select>
        </label>
        <label>
          View{" "}
          <select aria-label="Distance" value={settings.distance} onChange={(e) => change("distance", e.target.value)}>
            {VIEW_DISTANCES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Turn{" "}
          <select aria-label="Turn" value={settings.yaw} onChange={(e) => change("yaw", e.target.value)}>
            {YAW_OPTIONS.map((yaw) => (
              <option key={yaw} value={yaw}>
                {yaw}°
              </option>
            ))}
          </select>
        </label>
      </header>
      <p role="status" style={{ padding: "0 16px" }}>
        {status}
      </p>
      <div
        ref={host}
        style={{ flex: 1, minHeight: 0 }}
        data-deep-series-ready={loaded === signature && status !== "Loading" && !status.startsWith("Error")}
        data-deep-series-loaded={loaded}
      />
    </main>
  );
}
