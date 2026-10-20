import { siteDisplayName, type BeastBand } from "@bibliothecadao/eternum";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StructureType } from "@bibliothecadao/types";
import { mountStaticLineup, type LineupAsset, type LineupSettings } from "@/three/debug/model-lab/static-model-lineup";
import {
  FRONTIER_BEASTS,
  frontierBeast,
  frontierSiteComposition,
  FALLEN_REALM_RUIN_PATH,
  FALLEN_REALM_DEPTHS,
} from "@/three/structures/frontier-beast";
import { CAMP_MODEL_PATH } from "@/three/constants/scene-constants";
import { Token } from "@/three/map-plates/map-plate-token";
import { Plate } from "@/three/map-plates/map-plates";
import { buildStructurePlate } from "@/three/map-plates/map-plate-model";
import { SiteCardView } from "../frontier/sites/site-card-view";
import { BEAST_NAMES, BEAST_STUDY_NAMES } from "@/ui/design-system/kit/words";
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
const STUDY_BEASTS = MODEL_BEASTS.filter(({ beast }) => beast === "wyvern" || beast === "hydra");
const SPECIES_MODELS = Object.fromEntries(
  STUDY_BEASTS.map(({ beast, name, scale }) => [
    `species-${beast}`,
    [
      { label: `${name} · current`, parts: [{ path: FRONTIER_BEASTS[beast].path, scale }] },
      { label: `${name} · creature study`, parts: [{ path: `/lab/frontier-beasts/beast-${beast}.glb`, scale }] },
    ] satisfies readonly LineupAsset[],
  ]),
);
const CREATURE_MODELS: readonly LineupAsset[] = STUDY_BEASTS.map(({ beast, name, scale }) => ({
  label: name,
  parts: [{ path: `/lab/frontier-beasts/beast-${beast}.glb`, scale }],
}));
const WEAK_BEAST = frontierBeast(0, StructureType.Beasts, "lowly");
const WEAK_OPTIONS = [
  { species: "ghoul", model: true, detail: "Low carrion crawler · long claws and a ridged back" },
  { species: "kappa", model: true, detail: "Shell-backed demon · hooked beak and crown bowl" },
  { species: "wraith", model: true, detail: "Hollow spirit · bone mask and a torn shroud" },
  { species: "golem", model: false, detail: "Crumbling construct · concept only" },
] as const;
const WEAK_MODELS: readonly LineupAsset[] = [
  {
    label: `${WEAK_BEAST.name} · placeholder`,
    parts: [{ path: FRONTIER_BEASTS[WEAK_BEAST.beast].path, scale: WEAK_BEAST.scale }],
  },
  ...WEAK_OPTIONS.filter(({ model }) => model).map(({ species }) => ({
    label: `${BEAST_STUDY_NAMES[species]} · study`,
    parts: [{ path: `/lab/frontier-beasts/beast-${species}.glb`, scale: WEAK_BEAST.scale }],
  })),
  {
    label: `${BEAST_NAMES.cyclops} · stronger`,
    parts: [{ path: FRONTIER_BEASTS.cyclops.path, scale: frontierBeast(0, StructureType.Beasts, "stronger").scale }],
  },
];
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

const LINEUPS: Readonly<Record<string, readonly LineupAsset[]>> = {
  models: MODELS,
  "weak-options": WEAK_MODELS,
  creatures: CREATURE_MODELS,
  sites: SITE_MODELS,
  beasts: BEAST_MODELS,
  ruins: FALLEN_REALM_DEPTHS.map(({ beast, scale }, depth) => ({
    label: `${BEAST_NAMES[beast]} · depth ${depth}`,
    parts: [
      { path: FALLEN_REALM_RUIN_PATH, scale: 1 },
      { path: FRONTIER_BEASTS[beast].path, scale },
    ],
  })),
  ...SPECIES_MODELS,
};

export function FrontierBeastLab() {
  const [params, setParams] = useSearchParams();
  const group = params.get("group") ?? "models";
  const concepts = group === "weak-concepts";
  const lineup = LINEUPS[group] ?? MODELS;
  const index = Number(params.get("focus"));
  const focus =
    params.has("focus") && Number.isInteger(index) && index >= 0 && index < lineup.length ? index : "lineup";
  const settings: LineupSettings = {
    focus,
    distance: focus === "lineup" ? (SPECIES_MODELS[group] ? 10 : 20) : 3.5,
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
    if (group.startsWith("weak-")) {
      setSite(3);
      setBand("lowly");
      return;
    }
    if (!SPECIES_MODELS[group]) return;
    setSite(2);
    setDepth(group === "species-wyvern" ? 1 : 2);
  }, [group]);
  const beast = frontierBeast(depth, SITES[site].category, band);
  const strength = site === 3 ? (band === "lowly" ? 325 : 500) : 2800;
  const plate = buildStructurePlate({
    entityId: 29,
    structureName: siteDisplayName(29),
    structureType: SITES[site].category,
    isMine: false,
    isAlly: false,
    owner: { address: 0n, ownerName: "", guildName: "" },
    frontierBeast: beast,
    guardArmies: [{ slot: 0, category: "Knight", tier: 1, count: strength }],
  });
  useEffect(() => {
    if (concepts) {
      setReady(true);
      setStatus("Four concepts · three model studies · production keeps the placeholder");
      return;
    }
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
        setStatus("Loaded · game renderer, world scale · current models and creature studies");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(`Error: ${String(error)}`);
      });
    return () => {
      controller.abort();
      mounted?.dispose();
      renderer.current = null;
    };
  }, [lineup, concepts]);
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
            <option value="models">Five production species</option>
            <option value="creatures">Creature studies</option>
            <option value="weak-concepts">Weak monsters · concepts</option>
            <option value="weak-options">Weak monsters · models</option>
            {STUDY_BEASTS.map(({ beast, name }) => (
              <option key={beast} value={`species-${beast}`}>
                {name} · comparison
              </option>
            ))}
            <option value="ruins">Ruin depths</option>
            <option value="sites">Standing sites</option>
            <option value="beasts">Roaming beasts</option>
          </select>
        </label>
        {!concepts && (
          <>
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
          </>
        )}
      </header>
      <p role="status">{status}</p>
      {concepts ? (
        <section className="beast-concepts" aria-label="Weak monster concepts">
          {WEAK_OPTIONS.map(({ species, model, detail }, index) => (
            <figure key={species}>
              <a href={`/lab/frontier-beasts/${species}-concept.png`} target="_blank" rel="noreferrer">
                <img
                  src={`/lab/frontier-beasts/${species}-concept.png`}
                  alt={`${BEAST_STUDY_NAMES[species]} concept turnaround`}
                />
              </a>
              <figcaption>
                <strong>{BEAST_STUDY_NAMES[species]}</strong>
                <span>{detail}</span>
                {model && (
                  <Link to={`?family=beasts&group=weak-options&focus=${index + 1}&rendererMode=webgpu-force-webgl`}>
                    View model
                  </Link>
                )}
              </figcaption>
            </figure>
          ))}
        </section>
      ) : (
        <div ref={host} className="workshop-lab-canvas" />
      )}
      {!concepts && (
        <>
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
              <small>Selected plate, and its token at rest</small>
              <Plate plate={plate} view="open" />
              <Token plate={plate} />
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
        </>
      )}
    </main>
  );
}
