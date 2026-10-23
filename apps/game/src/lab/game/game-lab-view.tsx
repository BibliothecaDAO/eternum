import { Position } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { dayTurnScenario } from "./day-turn-scenario";
import { installLabChain, LAB_GAME, type LabScenario } from "./lab-chain";
import { realmScenario } from "./realm-scenario";
import { spireScenario } from "./spire-scenario";

/** The games the lab plays, by name: each a fixture and the chain's answers to the commands it proves. */
const SCENARIOS: Partial<Record<string, () => LabScenario>> = {
  spire: spireScenario,
  realm: realmScenario,
  "day-turn": dayTurnScenario("live"),
  "day-later": dayTurnScenario("later"),
};

/**
 * Dev only: the game itself on a fixture. /lab/game?scenario=spire installs the tab's chain for that scenario
 * (lab-chain.ts) and opens the game's own map route on it, so a player's input goes through the game's scenes, HUD and
 * client; each command it signs is recorded in window.__labChain.
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
 * The game's map route on the scenario's tile, as the doorway opens a player's map on their site; the page's other
 * options (the renderer mode, dev overlays) are the game's and go on with it.
 */
const mapHref = (tile: { col: number; row: number }, params: URLSearchParams): string => {
  const at = Position.fromContract({ x: tile.col, y: tile.row }).getNormalized();
  const options = new URLSearchParams(params);
  options.delete("scenario");
  options.set("col", String(at.x));
  options.set("row", String(at.y));
  return `/g/${LAB_GAME.chainId}/${LAB_GAME.gameId}/map?${options.toString()}`;
};
