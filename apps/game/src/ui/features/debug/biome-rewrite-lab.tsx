import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  mountBiomeRewrite,
  type BiomeRewriteSettings,
  type BiomeRewriteStats,
} from "@/three/debug/model-lab/biome-rewrite/biome-rewrite-renderer";
import { TERRAIN_BIOME_DESCRIPTORS, TERRAIN_BIOME_ORDER } from "@/three/terrain/terrain-palette";
import type { BiomeType } from "@bibliothecadao/types";

/** Study: every biome drawn by one heightfield and its shaders, on the Living Biomes field or a real map region. */
export function BiomeRewriteLab() {
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<BiomeRewriteStats | null>(null);
  const focus = params.get("focus") as BiomeType | null;
  const settings: BiomeRewriteSettings = {
    field: params.get("field") === "seeded" ? "seeded" : "bench",
    focus: focus && (TERRAIN_BIOME_ORDER as readonly BiomeType[]).includes(focus) ? focus : "field",
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
        <strong>Biome rewrite</strong>
        <label>
          Field{" "}
          <select aria-label="Field" value={settings.field} onChange={(e) => change("field", e.target.value)}>
            <option value="bench">World biomes</option>
            <option value="seeded">Map region</option>
          </select>
        </label>
        <label>
          View{" "}
          <select aria-label="Focus" value={settings.focus} onChange={(e) => change("focus", e.target.value)}>
            <option value="field">Whole field</option>
            {TERRAIN_BIOME_ORDER.map((biome) => (
              <option key={biome} value={biome}>
                {TERRAIN_BIOME_DESCRIPTORS[biome].label}
              </option>
            ))}
          </select>
        </label>
        {stats && (
          <span>
            {Math.round(stats.triangles).toLocaleString()} triangles · {stats.props} props · {stats.batches} batches ·{" "}
            {stats.sceneDraws} draws · built in {Math.round(stats.buildMs)} ms
          </span>
        )}
        {error && <span role="alert">{error}</span>}
      </header>
      <div ref={host} style={{ flex: 1, minHeight: 0 }} data-biome-rewrite-ready={Boolean(stats)} />
    </main>
  );
}
