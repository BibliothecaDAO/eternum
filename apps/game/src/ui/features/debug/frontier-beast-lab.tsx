import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StructureType } from "@bibliothecadao/types";
import { mountStaticLineup, type LineupAsset, type LineupSettings } from "@/three/debug/model-lab/static-model-lineup";
import {
  FRONTIER_BEASTS,
  frontierBeast,
  frontierSiteComposition,
  FALLEN_REALM_RUIN_PATH,
  type BeastBand,
} from "@/three/structures/frontier-beast";
import { CAMP_MODEL_PATH } from "@/three/constants/scene-constants";
import { Plate } from "@/three/map-plates/map-plates";
import { buildStructurePlate } from "@/three/map-plates/map-plate-model";
import { SiteCardView } from "../frontier/sites/site-card-view";
import { BEAST_NAMES } from "@/ui/design-system/kit/words";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import "./workshop-model-lab.css";
import "./frontier-beast-lab.css";
import "@/three/map-plates/map-plates.css";

const MODEL_BEASTS = [
  frontierBeast(0),
  frontierBeast(1),
  frontierBeast(2),
  frontierBeast(0, StructureType.Beasts, "lowly"),
  frontierBeast(0, StructureType.Beasts, "stronger"),
];
const MODELS: readonly LineupAsset[] = MODEL_BEASTS.map(({ beast, name, scale }) => ({
  label: name,
  parts: [{ path: FRONTIER_BEASTS[beast].path, scale }],
}));
const REFINEMENTS = Object.fromEntries(
  MODEL_BEASTS.map(({ beast, name, scale }) => [
    `refined-${beast}`,
    [
      { label: `${name} · current`, parts: [{ path: FRONTIER_BEASTS[beast].path, scale }] },
      { label: `${name} · refined study`, parts: [{ path: `/models/frontier/studies/beast-${beast}.glb`, scale }] },
    ] satisfies readonly LineupAsset[],
  ]),
);
const SITES = [
  { kind: "Camp", category: StructureType.Camp, base: CAMP_MODEL_PATH },
  { kind: "Rift", category: StructureType.Rift, base: "/models/reward-tiles/rift.glb" },
  { kind: "Ruin", category: StructureType.Ruin, base: FALLEN_REALM_RUIN_PATH },
  { kind: "Beasts", category: StructureType.Beasts, base: "" },
] as const;
const SITE_MODELS: readonly LineupAsset[] = SITES.map(({ kind, category, base }) => {
  const beast = frontierBeast(0, category, "lowly");
  const composition = frontierSiteComposition(category);
  return {
    label: `${kind} · ${beast.name}`,
    parts: [
      ...(composition.baseScale ? [{ path: base, scale: composition.baseScale, z: composition.baseZ }] : []),
      { path: FRONTIER_BEASTS[beast.beast].path, scale: beast.scale, z: composition.beastZ },
    ],
  };
});
const BEAST_MODELS = (["lowly", "stronger"] as const).map((band) => {
  const beast = frontierBeast(0, StructureType.Beasts, band);
  return { label: `${beast.name} · ${band}`, parts: [{ path: FRONTIER_BEASTS[beast.beast].path, scale: beast.scale }] };
});

export function FrontierBeastLab() {
  const [params, setParams] = useSearchParams();
  const group = params.get("group") ?? "models";
  const lineup = REFINEMENTS[group] ?? (group === "sites" ? SITE_MODELS : group === "beasts" ? BEAST_MODELS : MODELS);
  const index = Number(params.get("focus"));
  const focus =
    params.has("focus") && Number.isInteger(index) && index >= 0 && index < lineup.length ? index : "lineup";
  const settings: LineupSettings = {
    focus,
    distance: focus === "lineup" ? (REFINEMENTS[group] ? 10 : 20) : 3.5,
    yaw: Number(params.get("yaw") ?? 30),
    lighting: params.get("lighting") === "sunset" ? "sunset" : "day",
  };
  const latest = useRef(settings);
  latest.current = settings;
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<Awaited<ReturnType<typeof mountStaticLineup>> | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState(false);
  const [site, setSite] = useState(2);
  const [band, setBand] = useState<BeastBand>("lowly");
  const [depth, setDepth] = useState(0);
  useEffect(() => {
    if (!group.startsWith("refined-")) return;
    const species = group.slice("refined-".length);
    const roaming = species === "minotaur" || species === "cyclops";
    setSite(roaming ? 3 : 2);
    setBand(species === "cyclops" ? "stronger" : "lowly");
    setDepth(species === "wyvern" ? 1 : species === "hydra" ? 2 : 0);
  }, [group]);
  const beast = frontierBeast(depth, SITES[site].category, band);
  const strength = site === 3 ? (band === "lowly" ? 325 : 500) : 2800;
  const plate = buildStructurePlate({
    entityId: 29,
    structureName: "",
    structureType: SITES[site].category,
    isMine: false,
    isAlly: false,
    owner: { address: 0n, ownerName: "", guildName: "" },
    frontierBeast: beast,
    guardArmies: [{ slot: 0, category: "Knight", tier: 1, count: strength }],
  });
  useEffect(() => {
    const controller = new AbortController();
    let mounted: typeof renderer.current = null;
    setReady(false);
    setStatus("Loading…");
    void mountStaticLineup(host.current!, latest.current, controller.signal, lineup)
      .then((value) => {
        mounted = value;
        if (controller.signal.aborted) return value.dispose();
        renderer.current = value;
        value.update(latest.current);
        setReady(true);
        setStatus("Loaded · game renderer, world scale · refinements await owner review");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(`Error: ${String(error)}`);
      });
    return () => {
      controller.abort();
      mounted?.dispose();
      renderer.current = null;
    };
  }, [lineup]);
  useEffect(() => {
    renderer.current?.update(latest.current);
  }, [settings.focus, settings.yaw, settings.lighting]);
  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      if (key === "group" || (key === "focus" && value === "lineup")) next.delete("focus");
      return next;
    });
  return (
    <main className="workshop-lab beast-lab" data-beasts-ready={ready} data-group={group} data-hud-mode="frontier">
      <header>
        <Link to="/lab/models">Models</Link>
        <h1>Frontier beasts</h1>
        <label>
          Set{" "}
          <select aria-label="Set" value={group} onChange={(e) => change("group", e.target.value)}>
            <option value="models">Five current species</option>
            {MODEL_BEASTS.map(({ beast, name }) => (
              <option key={beast} value={`refined-${beast}`}>
                {name} · compare refinement
              </option>
            ))}
            <option value="sites">Standing sites</option>
            <option value="beasts">Roaming beasts</option>
          </select>
        </label>
        <label>
          View{" "}
          <select aria-label="View" value={focus} onChange={(e) => change("focus", e.target.value)}>
            <option value="lineup">Gameplay lineup</option>
            {lineup.map((entry, i) => (
              <option key={entry.label} value={i}>
                {entry.label} · detail
              </option>
            ))}
          </select>
        </label>
        <label>
          Turn{" "}
          <select aria-label="Turn" value={settings.yaw} onChange={(e) => change("yaw", e.target.value)}>
            {[0, 30, 90, 180, 270].map((yaw) => (
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
      </header>
      <p role="status">{status}</p>
      <div ref={host} className="workshop-lab-canvas" />
      <div className="beast-proof ui">
        <div>
          <label>
            Site{" "}
            <select aria-label="Site" value={site} onChange={(e) => setSite(Number(e.target.value))}>
              {SITES.map((entry, i) => (
                <option key={entry.kind} value={i}>
                  {entry.kind}
                </option>
              ))}
            </select>
          </label>
          {site === 3 ? (
            <select aria-label="Beast strength" value={band} onChange={(e) => setBand(e.target.value as BeastBand)}>
              <option value="lowly">Lowly · {BEAST_NAMES.minotaur}</option>
              <option value="stronger">Stronger · {BEAST_NAMES.cyclops}</option>
            </select>
          ) : (
            <select aria-label="Depth" value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
              {["Surface", "I", "II", "III"].map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <button onClick={() => setPanel(true)}>Select site</button>
        </div>
        <div data-after>
          <small>Selected plate</small>
          <Plate plate={plate} open />
        </div>
        <div className="beast-icon-studies">
          <small>Species portraits · 20 px</small>
          {MODEL_BEASTS.map(({ beast: species }) => (
            <span key={species} title={BEAST_NAMES[species]}>
              <Icon name={beastMeaning(species)} size={20} />
            </span>
          ))}
        </div>
      </div>
      {panel && (
        <SiteCardView
          site={SITES[site].kind}
          beast={{ ...beast, combatClass: "Knight" }}
          army={{ art: "knight-t1", troops: 5000 }}
          guard={strength}
          fight={{
            outcome: "wins",
            exchanges: 2,
            troopsLost: Math.floor(strength / 5),
            guardLeft: Math.floor(strength / 3),
          }}
          pay={site === 0 ? { icon: "labor", amount: 1400 } : site === 1 ? { icon: "essence", amount: 8400 } : null}
          xp={132}
          verb={null}
          onClose={() => setPanel(false)}
        />
      )}
    </main>
  );
}
