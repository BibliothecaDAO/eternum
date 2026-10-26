import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { mountRiftGroundLab, type RiftGroundLabSettings } from "@/three/debug/model-lab/rift-ground-lab-renderer";
import "./rift-ground-lab.css";

/** Compare the rift's ground at the same scale before approving its map integration. */
export function RiftGroundLab() {
  const [params, setParams] = useSearchParams();
  const biome = params.get("biome");
  const settings: RiftGroundLabSettings = {
    biome: biome === "desert" || biome === "snow" ? biome : "grassland",
    view: params.get("view") === "play" ? "play" : "detail",
  };
  const host = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLDivElement>(null);
  const after = useRef<HTMLDivElement>(null);
  const view = useRef<Awaited<ReturnType<typeof mountRiftGroundLab>> | null>(null);
  const latest = useRef(settings);
  latest.current = settings;
  const [status, setStatus] = useState("Loading terrain…");
  useEffect(() => {
    const controller = new AbortController();
    let mounted: typeof view.current = null;
    setStatus("Loading terrain…");
    delete host.current!.dataset.riftRendered;
    void mountRiftGroundLab(host.current!, [before.current!, after.current!], latest.current, controller.signal)
      .then((next) => {
        mounted = next;
        if (controller.signal.aborted) return next.dispose();
        view.current = next;
        next.update(latest.current);
        setStatus("Same dark fae, terrain and light. Proposal for review.");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(`Error: ${String(error)}`);
      });
    return () => {
      controller.abort();
      mounted?.dispose();
      view.current = null;
    };
  }, [settings.biome]);
  useEffect(() => {
    view.current?.update(latest.current);
  }, [settings.view]);
  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });
  return (
    <main className="rift-ground-lab">
      <header>
        <Link to="/lab/models?family=frontier-painted&group=sites">Painted buildings</Link>
        <h1>Essence rift · soil infestation</h1>
        <label>
          Biome{" "}
          <select aria-label="Biome" value={settings.biome} onChange={(event) => change("biome", event.target.value)}>
            <option value="grassland">Grassland</option>
            <option value="desert">Desert</option>
            <option value="snow">Snow</option>
          </select>
        </label>
        <label>
          View{" "}
          <select aria-label="View" value={settings.view} onChange={(event) => change("view", event.target.value)}>
            <option value="detail">Close</option>
            <option value="play">Play zoom</option>
          </select>
        </label>
      </header>
      <p role="status">{status}</p>
      <div ref={host} className="rift-ground-comparison">
        <div ref={before} className="rift-ground-panel" aria-label="Current rift">
          <h2>Current</h2>
        </div>
        <div ref={after} className="rift-ground-panel" aria-label="Proposed rift">
          <h2>Infested ground</h2>
        </div>
      </div>
    </main>
  );
}
