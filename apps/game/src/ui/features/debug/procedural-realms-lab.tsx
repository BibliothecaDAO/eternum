import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  mountProceduralRealms,
  type ProceduralRealmsSettings,
  type ProceduralRealmsStats,
} from "@/three/debug/model-lab/procedural-realms/procedural-realms-renderer";
import type { RealmKitLevel } from "@/three/debug/model-lab/procedural-realms/realm-kit-design";

const AGES = ["Settlement", "City", "Kingdom", "Empire"];

/** Study: today's realm cut into a kit and reassembled per Realm NFT, beside the shipped model. */
export function ProceduralRealmsLab() {
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ProceduralRealmsStats | null>(null);
  const settings: ProceduralRealmsSettings = {
    level: Math.max(0, Math.min(3, Number(params.get("level") ?? 2))) as RealmKitLevel,
    distance: Number(params.get("distance") ?? 0),
    focus: Number(params.get("focus") ?? 2),
  };
  const signature = JSON.stringify(settings);
  useEffect(() => {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    let shown = "";
    setStats(null);
    setError("");
    void mountProceduralRealms(host.current!, JSON.parse(signature), controller.signal, (next) => {
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
        <strong>Procedural realms</strong>
        <label>
          Age{" "}
          <select aria-label="Age" value={settings.level} onChange={(e) => change("level", e.target.value)}>
            {AGES.map((age, index) => (
              <option key={age} value={index}>
                {age}
              </option>
            ))}
          </select>
        </label>
        {stats && (
          <span>
            {stats.kitModules} modules · {stats.kitDraws} kit batches ({stats.kitMaterials} materials) for 13 realms ·{" "}
            {stats.realmTriangles.min.toLocaleString()}–{stats.realmTriangles.max.toLocaleString()} triangles each ·{" "}
            {stats.sceneDraws} draws in view
          </span>
        )}
        {error && <span role="alert">{error}</span>}
      </header>
      <div
        ref={host}
        style={{ flex: 1, minHeight: 0, position: "relative" }}
        data-procedural-ready={Boolean(stats)}
        data-kit-draws={stats?.kitDraws}
        data-scene-draws={stats?.sceneDraws}
      >
        {stats?.slots.map((slot) => (
          <span
            key={slot.label}
            style={{
              position: "absolute",
              left: slot.x,
              top: slot.y,
              transform: "translateX(-50%)",
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(10, 16, 16, 0.72)",
              font: "600 12px/1.3 system-ui",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {slot.label}
          </span>
        ))}
      </div>
    </main>
  );
}
