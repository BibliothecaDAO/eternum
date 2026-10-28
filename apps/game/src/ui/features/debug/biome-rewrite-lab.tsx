import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  mountBiomeRewrite,
  type BiomeRewriteSettings,
  type BiomeRewriteStats,
} from "@/three/debug/model-lab/biome-rewrite/biome-rewrite-renderer";
import { BIOME_REWRITE_APPROACHES, type BiomeRewriteApproach } from "@/three/debug/model-lab/biome-rewrite/approaches";

/** Study: one sand-and-water region, drawn by one of several approaches, with a realm and an army on its coast. */
export function BiomeRewriteLab() {
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<BiomeRewriteStats | null>(null);
  const approach = params.get("approach") as BiomeRewriteApproach;
  const settings: BiomeRewriteSettings = {
    approach: BIOME_REWRITE_APPROACHES.some(({ id }) => id === approach) ? approach : "procedural",
    view: params.get("view") === "close" ? "close" : "play",
  };
  const signature = JSON.stringify(settings);
  useEffect(() => {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    let shown = "";
    setStats(null);
    setError("");
    void mountBiomeRewrite(host.current!, JSON.parse(signature), controller.signal, (next) => {
      const text = JSON.stringify({ ...next, buildMs: Math.round(next.buildMs) });
      if (text === shown) return;
      shown = text;
      setStats(next);
    })
      .then((view) => {
        dispose = view.dispose;
        if (controller.signal.aborted) dispose();
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
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
        background: "#172322",
        color: "#eee",
      }}
    >
      <header style={{ padding: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/lab/models">Models</Link>
        <strong>Sand and water</strong>
        <label>
          Approach{" "}
          <select aria-label="Approach" value={settings.approach} onChange={(e) => change("approach", e.target.value)}>
            {BIOME_REWRITE_APPROACHES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          View{" "}
          <select aria-label="View" value={settings.view} onChange={(e) => change("view", e.target.value)}>
            <option value="play">Play</option>
            <option value="close">Close</option>
          </select>
        </label>
        {stats && (
          <span>
            {Math.round(stats.triangles).toLocaleString()} triangles · {stats.materials} materials · {stats.sceneDraws}{" "}
            draws · built in {Math.round(stats.buildMs)} ms
          </span>
        )}
        {error && <span role="alert">{error}</span>}
      </header>
      <div ref={host} style={{ flex: 1, minHeight: 0 }} data-biome-rewrite-ready={Boolean(stats)} />
    </main>
  );
}
