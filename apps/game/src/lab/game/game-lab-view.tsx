import { Position } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { installLabChain, LAB_GAME } from "./lab-chain";
import { LAB_SCENARIOS, startLabGame } from "./lab-games";

/**
 * Dev only: the game itself on a fixture. /lab/game?scenario=spire installs the tab's chain for that scenario
 * (lab-chain.ts) and opens the game's own map route on it, so a player's input goes through the game's scenes, HUD and
 * client; each command it signs is recorded in window.__labChain. Opening it again starts the scenario over; a reload
 * of the game's route goes on with it (LabGameRoute).
 */
export const GameLabView = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get("scenario") ?? "spire";
  const scenario = LAB_SCENARIOS[name];
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!scenario) return;
    installLabChain(scenario, startLabGame(name).startedAt).then(
      (game) => {
        game.startDevice?.();
        navigate(mapHref(game.opensOn, params), { replace: true });
      },
      (error: unknown) => setFailed(String(error)),
    );
  }, [scenario, name, navigate, params]);
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
