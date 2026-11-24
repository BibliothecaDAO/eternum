import { siteDisplayName, type BeastBand } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BEASTS,
  LAYER_NAMES,
  StructureType,
  beastModel,
  beastOfModel,
  beastsOfFamily,
  frontierSiteName,
  guardedSiteKind,
  type BeastRow,
} from "@bibliothecadao/types";
import { mountStaticLineup, type LineupAsset, type LineupSettings } from "@/three/debug/model-lab/static-model-lineup";
import {
  FRONTIER_BEASTS,
  FRONTIER_CAMP_MODEL_PATH,
  frontierBeast,
  frontierSiteComposition,
  FALLEN_REALM_RUIN_PATH,
  largestBeastScale,
} from "@/three/structures/frontier-beast";
import { RiftModelPath } from "@/three/constants/scene-constants";
import { Token } from "@/three/map-plates/map-plate-token";
import { Plate } from "@/three/map-plates/map-plates";
import { buildStructurePlate } from "@/three/map-plates/map-plate-model";
import { SiteCardView } from "../frontier/sites/site-card-view";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { frontierSeasonOnePreset } from "../../../../../../config/source/frontier/season-one";
import { previewRuinGuardBounds } from "../../../../../../contracts/l3/world-native/schema/site-previews.gen";
import "./workshop-model-lab.css";
import "./frontier-beast-lab.css";
import "@/three/map-plates/map-plates.css";

const MODEL_BEASTS = Object.keys(FRONTIER_BEASTS).map((beast) => ({ beast: beast as keyof typeof FRONTIER_BEASTS }));
const MODELS: readonly LineupAsset[] = MODEL_BEASTS.map(({ beast }) => ({
  label: beastOfModel(beast).name,
  parts: [{ path: FRONTIER_BEASTS[beast].path, scale: largestBeastScale(beast) }],
}));
const SITES = [
  { kind: "Camp", category: StructureType.Camp, base: FRONTIER_CAMP_MODEL_PATH },
  { kind: "Rift", category: StructureType.Rift, base: RiftModelPath },
  { kind: "Ruin", category: StructureType.Ruin, base: FALLEN_REALM_RUIN_PATH },
  { kind: "Beasts", category: StructureType.Beasts, base: "" },
] as const;
const siteModels = (layer: number): readonly LineupAsset[] =>
  SITES.map(({ category, base }) => {
    const beast = frontierBeast(layer, category, "lowly");
    const composition = frontierSiteComposition(category);
    return {
      label: guardedSiteKind(category, beast),
      parts: [
        ...(composition.baseScale ? [{ path: base, scale: composition.baseScale, z: composition.baseZ }] : []),
        {
          path: FRONTIER_BEASTS[beast.beast].path,
          scale: beast.scale,
          z: composition.beastZ,
          y: composition.beastY,
        },
      ],
    };
  });
const roamingModels = (layer: number): readonly LineupAsset[] =>
  (["lowly", "stronger"] as const).map((band) => {
    const beast = frontierBeast(layer, StructureType.Beasts, band);
    return {
      label: `${beast.name} · ${band}`,
      parts: [{ path: FRONTIER_BEASTS[beast.beast].path, scale: beast.scale }],
    };
  });

const FIXED_LINEUPS: Readonly<Record<string, readonly LineupAsset[]>> = {
  models: MODELS,
  families: Object.values<BeastRow>(BEASTS).map((beast) => ({
    label: `${beast.name} · ${LAYER_NAMES[beast.layer]} ${beast.family}`,
    parts: [{ path: FRONTIER_BEASTS[beastModel(beast)].path, scale: beast.scale }],
  })),
  ruins: beastsOfFamily("ruin").map((beast) => ({
    label: `${beast.name} · ${LAYER_NAMES[beast.layer]}`,
    parts: [
      { path: FALLEN_REALM_RUIN_PATH, scale: 1 },
      { path: FRONTIER_BEASTS[beastModel(beast)].path, scale: beast.scale },
    ],
  })),
};
const LAYERED_LINEUPS: Readonly<Record<string, (layer: number) => readonly LineupAsset[]>> = {
  sites: siteModels,
  beasts: roamingModels,
};

export function FrontierBeastLab() {
  const [params, setParams] = useSearchParams();
  const group = params.get("group") ?? "models";
  const [depth, setDepth] = useState(0);
  const lineupLayer = LAYERED_LINEUPS[group] ? depth : 0;
  const lineup = useMemo(
    () => LAYERED_LINEUPS[group]?.(lineupLayer) ?? FIXED_LINEUPS[group] ?? MODELS,
    [group, lineupLayer],
  );
  const index = Number(params.get("focus"));
  const focus =
    params.has("focus") && Number.isInteger(index) && index >= 0 && index < lineup.length ? index : "lineup";
  const settings: LineupSettings = {
    focus,
    distance: focus === "lineup" ? Math.max(20, lineup.length * 2.5) : 3.5,
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
  const beast = frontierBeast(depth, SITES[site].category, band);
  const bounds = frontierSeasonOnePreset.depths[depth]!;
  const strength = [
    bounds.siteGuardLower,
    bounds.riftGuardLower,
    previewRuinGuardBounds(depth + 1, depth)[0],
    band === "lowly" ? bounds.beastWeakLower : bounds.beastStrongLower,
  ][site]!;
  const plate = buildStructurePlate({
    entityId: 29,
    level: 0,
    hasWonder: false,
    structureName: siteDisplayName(29),
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
            <option value="models">Production species</option>
            <option value="families">Every beast by family and layer</option>
            <option value="ruins">Ruin layers</option>
            <option value="sites">Standing sites</option>
            <option value="beasts">Roaming beasts</option>
          </select>
        </label>
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
      </header>
      <p role="status">{status}</p>
      <div ref={host} className="workshop-lab-canvas" />
      <>
        <div className="beast-proof ui">
          <div>
            <label>
              Site{" "}
              <select aria-label="Site" value={site} onChange={(e) => setSite(Number(e.target.value))}>
                {SITES.map((entry, i) => (
                  <option key={frontierSiteName(entry.category)} value={i}>
                    {frontierSiteName(entry.category)}
                  </option>
                ))}
              </select>
            </label>
            <select aria-label="Layer" value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
              {LAYER_NAMES.slice(0, 3).map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
            {site === 3 && (
              <select aria-label="Beast strength" value={band} onChange={(e) => setBand(e.target.value as BeastBand)}>
                {(["lowly", "stronger"] as const).map((strengthBand) => (
                  <option key={strengthBand} value={strengthBand}>
                    {strengthBand === "lowly" ? "Lowly" : "Stronger"} ·{" "}
                    {frontierBeast(depth, StructureType.Beasts, strengthBand).name}
                  </option>
                ))}
              </select>
            )}
            <button onClick={() => setPanel(true)}>Select site</button>
          </div>
          <div data-after>
            <small>Selected plate, and its token at rest</small>
            <Plate plate={plate} />
            <Token plate={plate} />
          </div>
          <div className="beast-icon-studies">
            <small>Species portraits · 20 px</small>
            {MODEL_BEASTS.map(({ beast: species }) => (
              <span key={species} title={beastOfModel(species).name}>
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
              troopsLost: Math.floor(strength / 5),
              guardLeft: Math.floor(strength / 3),
            }}
            pay={site === 0 ? { icon: "labor", amount: 1400 } : site === 1 ? { icon: "essence", amount: 8400 } : null}
            verb={null}
            onClose={() => setPanel(false)}
          />
        )}
      </>
    </main>
  );
}
