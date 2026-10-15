import type { GameModeId } from "@/config/game-modes";

/**
 * Which HUD a game shows. Frontier shows its own, once its rules arrive, and never the other modes' shared HUD, whose
 * surfaces include the shared deploy modal: a Frontier player deploys only from Frontier's own sheet. Every other
 * mode shows the shared HUD.
 */
export const hudFor = (mode: GameModeId, frontierRulesKnown: boolean): "frontier" | "shared" | "none" =>
  mode === "frontier" ? (frontierRulesKnown ? "frontier" : "none") : "shared";
