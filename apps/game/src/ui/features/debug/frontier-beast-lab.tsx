import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StructureType } from "@bibliothecadao/types";
import { mountStaticLineup, type LineupAsset, type LineupSettings } from "@/three/debug/model-lab/static-model-lineup";
import {
  FRONTIER_BEASTS,
  frontierBeast,
  frontierSiteComposition,
  FALLEN_REALM_RUIN_PATH,
} from "@/three/structures/frontier-beast";
import { CAMP_MODEL_PATH } from "@/three/constants/scene-constants";
import { Plate } from "@/three/map-plates/map-plates";
import type { StructurePlate } from "@/three/map-plates/map-plate-model";
import { SiteCardView } from "../frontier/sites/site-card-view";
import { BEAST_NAMES } from "@/ui/design-system/kit/words";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import "./workshop-model-lab.css";
import "./frontier-beast-lab.css";
import "@/three/map-plates/map-plates.css";

const MODELS: readonly LineupAsset[] = [
  { label: `${BEAST_NAMES.troll} · shipped`, parts: [{ path: FRONTIER_BEASTS.troll.path, scale: 1.2 }] },
  { label: `${BEAST_NAMES.minotaur} · Loot T1 study`, parts: [{ path: "/models/frontier/beast-minotaur.glb" }] },
  { label: `${BEAST_NAMES.wyvern} · shipped`, parts: [{ path: FRONTIER_BEASTS.wyvern.path, scale: 1.35 }] },
  { label: `${BEAST_NAMES.chimera} · Loot T2 study`, parts: [{ path: "/models/frontier/beast-chimera.glb" }] },
  { label: `${BEAST_NAMES.hydra} · shipped`, parts: [{ path: FRONTIER_BEASTS.hydra.path, scale: 1.45 }] },
  { label: `${BEAST_NAMES.cyclops} · Loot T3 study`, parts: [{ path: "/models/frontier/beast-cyclops.glb" }] },
];
const SITES = [
  { kind: "Camp", category: StructureType.Camp, base: CAMP_MODEL_PATH },
  { kind: "Rift", category: StructureType.Rift, base: "/models/reward-tiles/rift.glb" },
  { kind: "Ruin", category: StructureType.Ruin, base: FALLEN_REALM_RUIN_PATH },
  { kind: "Stragglers", category: StructureType.Stragglers, base: "" },
] as const;
const SITE_MODELS: readonly LineupAsset[] = SITES.map(({ kind, category, base }) => {
  const beast = frontierBeast(0, category);
  const composition = frontierSiteComposition(category);
  return {
    label: `${kind} · ${beast.name}`,
    parts: [
      ...(composition.baseScale ? [{ path: base, scale: composition.baseScale, z: composition.baseZ }] : []),
      { path: FRONTIER_BEASTS[beast.beast].path, scale: beast.scale, z: composition.beastZ },
    ],
  };
});
const STRAGGLERS = (["Knight", "Paladin", "Crossbowman"] as const).map((troop) => {
  const beast = frontierBeast(0, StructureType.Stragglers, troop);
  return {
    label: `${beast.name} · Loot T${FRONTIER_BEASTS[beast.beast].lootTier}`,
    parts: [{ path: FRONTIER_BEASTS[beast.beast].path, scale: beast.scale }],
  };
});

export function FrontierBeastLab() {
  const [params, setParams] = useSearchParams();
  const group = params.get("group") ?? "models";
  const lineup = group === "sites" ? SITE_MODELS : group === "stragglers" ? STRAGGLERS : MODELS;
  const index = Number(params.get("focus"));
  const focus =
    params.has("focus") && Number.isInteger(index) && index >= 0 && index < lineup.length ? index : "lineup";
  const settings: LineupSettings = {
    focus,
    distance: focus === "lineup" ? 20 : 6,
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
  const [troop, setTroop] = useState<"Knight" | "Paladin" | "Crossbowman">("Knight");
  const beast = frontierBeast(0, SITES[site].category, troop);
  const plate: StructurePlate = {
    kind: "structure",
    relation: "neutral",
    owner: beast.name,
    name: SITES[site].kind,
    place: "Woecrag",
    named: false,
    icon: "ruin",
    guards: [{ type: troop.toLowerCase() as "knight" | "paladin" | "crossbowman", tier: 1, count: 2800, beast: true }],
    arrivals: [],
  };
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
        setStatus("Loaded · game renderer, world scale");
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
            <option value="models">New models beside shipped</option>
            <option value="sites">Standing sites</option>
            <option value="stragglers">Stragglers</option>
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
          <select aria-label="Combat class" value={troop} onChange={(e) => setTroop(e.target.value as typeof troop)}>
            {["Knight", "Paladin", "Crossbowman"].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <button onClick={() => setPanel(true)}>Select site</button>
        </div>
        <div data-before>
          <small>Before</small>
          <Plate
            plate={{ ...plate, owner: "The Vanguard", guards: [{ ...plate.guards![0], beast: undefined }] }}
            open
          />
        </div>
        <div data-after>
          <small>After · combat T1</small>
          <Plate plate={plate} open />
        </div>
        <div className="beast-icon-studies">
          <small>Combat tier artwork · 20 px</small>
          {([1, 2, 3] as const).map((tier) => (
            <span key={tier}>
              <Icon name={beastMeaning(tier)} size={20} /> T{tier}
            </span>
          ))}
        </div>
      </div>
      {panel && (
        <SiteCardView
          site={SITES[site].kind}
          beast={{ name: beast.name, tier: 1, combatClass: troop }}
          army={{ art: "knight-t1", troops: 5000 }}
          guard={2800}
          fight={{ outcome: "wins", exchanges: 2, troopsLost: 550, guardLeft: 800 }}
          pay={site === 0 ? { icon: "labor", amount: 1400 } : site === 1 ? { icon: "essence", amount: 8400 } : null}
          xp={132}
          verb={null}
          onClose={() => setPanel(false)}
        />
      )}
    </main>
  );
}
