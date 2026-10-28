import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  mountProceduralBiomes,
  type ProceduralBiomesSettings,
  type ProceduralBiomesStats,
} from "@/three/debug/model-lab/procedural-biomes/procedural-biomes-renderer";
import { BIOME_TARGETS, type BiomeStudyId } from "@/three/debug/model-lab/procedural-biomes/biome-target-composition";

const BIOMES = Object.keys(BIOME_TARGETS) as BiomeStudyId[];

/** Study: one biome as the game draws it today, or composed as a place from the same meshes. */
export function ProceduralBiomesLab() {
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ProceduralBiomesStats | null>(null);
  const biome = params.get("biome") as BiomeStudyId;
  const settings: ProceduralBiomesSettings = {
    biome: BIOMES.includes(biome) ? biome : "forest",
    look: params.get("look") === "target" ? "target" : "today",
    distance: Number(params.get("distance") ?? 20),
  };
  const signature = JSON.stringify(settings);
  useEffect(() => {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    let shown = "";
    setStats(null);
    setError("");
    void mountProceduralBiomes(host.current!, JSON.parse(signature), controller.signal, (next) => {
      const text = JSON.stringify(next);
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
        <strong>Procedural biomes</strong>
        <label>
          Biome{" "}
          <select aria-label="Biome" value={settings.biome} onChange={(e) => change("biome", e.target.value)}>
            {BIOMES.map((id) => (
              <option key={id} value={id}>
                {BIOME_TARGETS[id].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Look{" "}
          <select aria-label="Look" value={settings.look} onChange={(e) => change("look", e.target.value)}>
            <option value="today">Today</option>
            <option value="target">Target</option>
          </select>
        </label>
        {stats && (
          <span>
            {stats.props > 0 && `${stats.props} props in ${stats.studyDraws} batch · `}
            {stats.sceneDraws} draws in view
          </span>
        )}
        {error && <span role="alert">{error}</span>}
      </header>
      <div ref={host} style={{ flex: 1, minHeight: 0 }} data-procedural-ready={Boolean(stats)} />
    </main>
  );
}
