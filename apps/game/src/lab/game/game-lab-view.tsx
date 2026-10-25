import { Position } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { dayTurnScenario } from "./day-turn-scenario";
import { installLabChain, LAB_GAME, type LabScenario } from "./lab-chain";
import { realmScenario } from "./realm-scenario";
import { spireScenario } from "./spire-scenario";
import { paintedBuildingsScenario } from "./painted-buildings-scenario";

/** The games the lab plays, by name: each a fixture and the chain's answers to the commands it proves. */
const SCENARIOS: Partial<Record<string, () => LabScenario>> = {
  spire: spireScenario,
  realm: realmScenario,
  "painted-buildings": paintedBuildingsScenario,
  "day-turn": dayTurnScenario("live"),
  "day-later": dayTurnScenario("later"),
  "day-turn-slow": dayTurnScenario("live", "late"),
  "day-later-short": dayTurnScenario("later", "capped"),
};

/**
 * Dev only: the game itself on a fixture. /lab/game?scenario=spire installs the tab's chain for that scenario
 * (lab-chain.ts) and opens the game's own map route on it (`&scene=hex`: the realm's, as a reload there does), so a
 * player's input goes through the game's scenes, HUD and client; each command it signs is recorded in
 * window.__labChain.
 */
export const GameLabView = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get("scenario") ?? "spire";
  const scenario = SCENARIOS[name];
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!scenario) return;
    const game = scenario();
    installLabChain(game).then(
      () => navigate(mapHref(game.opensOn, params), { replace: true }),
      (error: unknown) => setFailed(String(error)),
    );
  }, [scenario, navigate, params]);
  return (
    <div className="lab-loading" role="status">
      {scenario ? (failed ?? `Opening the ${name} game…`) : `No lab game named ${name}`}
    </div>
  );
};

/**
 * The game's route on the scenario's tile, the map's unless the page asks for the realm's, as the doorway opens a
 * player's map on their site; the page's other options (the renderer mode, dev overlays) are the game's and go on with
 * it.
 */
const mapHref = (tile: { col: number; row: number }, params: URLSearchParams): string => {
  const at = Position.fromContract({ x: tile.col, y: tile.row }).getNormalized();
  const options = new URLSearchParams(params);
  const scene = options.get("scene") === "hex" ? "hex" : "map";
  options.delete("scenario");
  options.delete("scene");
  options.set("col", String(at.x));
  options.set("row", String(at.y));
  return `/g/${LAB_GAME.chainId}/${LAB_GAME.gameId}/${scene}?${options.toString()}`;
};
