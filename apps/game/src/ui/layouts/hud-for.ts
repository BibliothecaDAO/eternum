import type { GameModeId } from "@/config/game-modes";

/**
 * Which HUD a game shows. Frontier shows its own, once its rules arrive, and never War room, whose surfaces include
 * the shared deploy modal: a Frontier player deploys only from Frontier's own sheet. Every other mode (Blitz and
 * Eternum) shows War room.
 */
export const hudFor = (mode: GameModeId, frontierRulesKnown: boolean): "frontier" | "war-room" | "none" =>
  mode === "frontier" ? (frontierRulesKnown ? "frontier" : "none") : "war-room";
