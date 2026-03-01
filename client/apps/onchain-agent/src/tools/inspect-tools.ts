/**
 * Unified inspect tool — look up any hex or entity by coordinates or entity ID.
 * Returns enriched data from the cached world state with display coords,
 * direction labels, formatted numbers — same quality as the tick prompt.
 */
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { EternumClient } from "@bibliothecadao/client";
import { getNeighborHexes, getDirectionBetweenAdjacentHexes, BiomeIdToType } from "@bibliothecadao/types";
import { setCachedWorldState } from "../adapter/action-registry";
import {
  buildWorldState,
  toContract,
  getMapCenter,
  type EternumWorldState,
  type EternumEntity,
} from "../adapter/world-state";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

function logToolResponse(toolName: string, params: any, response: string) {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug",
      "tool-responses.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    writeFileSync(debugPath, `\n[${ts}] ${toolName}(${JSON.stringify(params)})\n${response}\n`, { flag: "a" });
  } catch (_) {}
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${+(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${+(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${+(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${+(abs / 1e3).toFixed(2)}K`;
  return `${sign}${abs}`;
}

function toDisplay(contractCoord: number): number {
  return contractCoord - getMapCenter();
}

function fmtPos(x: number, y: number): string {
  return `(${toDisplay(x)},${toDisplay(y)})`;
}

function biomeName(id: number): string {
  if (id === 0) return "Unexplored";
  return BiomeIdToType[id] ?? `Biome${id}`;
}

function formatTimeAgo(unixSeconds: number): string {
  if (!unixSeconds) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Format a full entity detail block — same quality as tick prompt. */
function formatEntityDetail(e: EternumEntity, ownedEntities: EternumEntity[]): string {
  const lines: string[] = [];
  const rel = computeRelLabel(e.position.x, e.position.y, ownedEntities);

  if (e.type === "structure") {
    const owner = e.isOwned ? "MINE" : e.ownerName || e.owner.slice(0, 10) + "...";
    lines.push(`[${e.structureType ?? "?"}] id=${e.entityId} lvl=${e.level ?? 0} owner=${owner} pos=${fmtPos(e.position.x, e.position.y)} ${rel}`);

    if (e.resources && e.resources.size > 0) {
      const resParts = Array.from(e.resources.entries())
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${fmtNum(v)}`);
      if (resParts.length > 0) lines.push(`  Resources: ${resParts.join(", ")}`);
    }
    if (e.buildingSlots) {
      const { used, total, buildings } = e.buildingSlots;
      lines.push(`  Slots: ${used}/${total} (${total - used} free)${buildings.length > 0 ? ` — ${buildings.join(", ")}` : ""}`);
    }
    if (e.freeSlots && e.freeSlots.length > 0 && e.buildingSlots && e.buildingSlots.total - e.buildingSlots.used > 0) {
      lines.push(`  Free paths: ${e.freeSlots.join(",")}`);
    }
    if (e.population) {
      lines.push(`  Pop: ${e.population.current}/${e.population.capacity}`);
    }
    if (e.nextUpgrade) {
      lines.push(`  Upgrade → ${e.nextUpgrade.name}: ${e.nextUpgrade.cost}`);
    } else if (e.nextUpgrade === null) {
      lines.push(`  Max level`);
    }
    if (e.armies && e.armies.current > 0) {
      lines.push(`  Armies: ${e.armies.current}/${e.armies.max}`);
    }
    if (e.guardSlots) {
      for (const s of e.guardSlots) {
        lines.push(`  Guard ${s.slot}: ${s.troops}`);
      }
    }
    if (e.troopsInReserve && e.troopsInReserve.length > 0) {
      lines.push(`  Reserves: ${e.troopsInReserve.join(", ")}`);
    }
    if (e.lastAttack) {
      lines.push(`  Last attacked by #${e.lastAttack.attackerId} ${formatTimeAgo(e.lastAttack.timestamp)}`);
    }
  } else {
    // Army
    const owner = e.isOwned ? "MINE" : e.ownerName || e.owner.slice(0, 10) + "...";
    const battle = e.isInBattle ? " IN BATTLE" : "";
    lines.push(`[Army] id=${e.entityId} ${e.troopSummary ?? "no troops"} str=${fmtNum(e.strength ?? 0)} stam=${fmtNum(e.stamina ?? 0)} owner=${owner} pos=${fmtPos(e.position.x, e.position.y)}${battle} ${rel}`);
    if (e.lastAttack) {
      const pos = e.lastAttack.pos ? ` from ${fmtPos(e.lastAttack.pos.x, e.lastAttack.pos.y)}` : "";
      lines.push(`  Last attacked by #${e.lastAttack.attackerId}${pos} ${formatTimeAgo(e.lastAttack.timestamp)}`);
    }
    if (e.lastDefense) {
      lines.push(`  Last defended against #${e.lastDefense.defenderId} ${formatTimeAgo(e.lastDefense.timestamp)}`);
    }
  }

  return lines.join("\n");
}

/** Compute relative label from a position to nearest owned entity. */
function computeRelLabel(x: number, y: number, owned: EternumEntity[]): string {
  if (owned.length === 0) return "";
  let nearest = owned[0];
  let bestDist = Infinity;
  for (const e of owned) {
    const dx = e.position.x - x;
    const dy = e.position.y - y;
    const d = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev approx
    if (d < bestDist) { bestDist = d; nearest = e; }
  }
  if (bestDist === 0) return "";

  const dx = x - nearest.position.x;
  const dy = y - nearest.position.y;
  let dir = "";
  if (dy > 0 && dx === 0) dir = "N";
  else if (dy > 0 && dx > 0) dir = "NE";
  else if (dy > 0 && dx < 0) dir = "NW";
  else if (dy < 0 && dx === 0) dir = "S";
  else if (dy < 0 && dx > 0) dir = "SE";
  else if (dy < 0 && dx < 0) dir = "SW";
  else if (dx > 0) dir = "E";
  else dir = "W";

  const label = nearest.type === "structure" ? nearest.structureType ?? "structure" : "army";

  if (bestDist === 1) {
    const hexDir = getDirectionBetweenAdjacentHexes(
      { col: nearest.position.x, row: nearest.position.y },
      { col: x, row: y },
    );
    if (hexDir !== null) {
      return `[adjacent ${dir} of your ${label}#${nearest.entityId}, move dir=${hexDir}]`;
    }
  }
  return `[${bestDist} ${dir} of your ${label}#${nearest.entityId}]`;
}

const inspectSchema = {
  type: "object" as const,
  properties: {
    x: { type: "number" as const, description: "Display x coordinate to inspect" },
    y: { type: "number" as const, description: "Display y coordinate to inspect" },
    entityId: { type: "number" as const, description: "Entity ID to inspect (alternative to coordinates)" },
  },
};

export function createInspectTools(client: EternumClient, accountAddress: string): AgentTool<any>[] {

  const inspectTool: AgentTool<any> = {
    name: "inspect",
    label: "Inspect",
    description:
      "Inspect a hex tile or entity. Pass display coordinates (x, y) to see everything at and around that position, " +
      "or pass entityId to look up a specific structure/army. Returns enriched data with display coords, " +
      "direction labels, biome info, and formatted values — same quality as the tick prompt.",
    parameters: inspectSchema,
    async execute(_toolCallId, params: { x?: number; y?: number; entityId?: number }) {
      try {
        // Fetch fresh world state
        const state = await buildWorldState(client, accountAddress);
        setCachedWorldState(state);

        const ownedEntities = state.entities.filter((e) => e.isOwned);
        let targetX: number;
        let targetY: number;

        if (params.entityId !== undefined) {
          // Look up by entity ID
          const entity = state.entities.find((e) => e.entityId === params.entityId);
          if (!entity) {
            const text = `Entity #${params.entityId} not found in current view radius.`;
            logToolResponse("inspect", params, text);
            return { content: [{ type: "text" as const, text }], details: { found: false } };
          }
          targetX = entity.position.x;
          targetY = entity.position.y;
        } else if (params.x !== undefined && params.y !== undefined) {
          // Convert display coords to contract coords
          targetX = toContract(params.x);
          targetY = toContract(params.y);
        } else {
          const text = "Pass either (x, y) display coordinates or entityId.";
          logToolResponse("inspect", params, text);
          return { content: [{ type: "text" as const, text }], details: { found: false } };
        }

        const lines: string[] = [];
        lines.push(`## Inspect ${fmtPos(targetX, targetY)}`);

        // Tile info
        const tileKey = `${targetX},${targetY}`;
        const tile = state.tileMap.get(tileKey);
        if (tile) {
          lines.push(`Biome: ${biomeName(tile.biome)}`);
          if (tile.occupierType > 0) {
            lines.push(`Occupier: type=${tile.occupierType} id=${tile.occupierId}`);
          }
        } else {
          lines.push(`Tile: Unexplored`);
        }

        // Entities at this position
        const entitiesHere = state.entities.filter(
          (e) => e.position.x === targetX && e.position.y === targetY,
        );
        if (entitiesHere.length > 0) {
          lines.push("");
          lines.push(`### Entities at this position (${entitiesHere.length})`);
          for (const e of entitiesHere) {
            lines.push(formatEntityDetail(e, ownedEntities));
          }
        }

        // Neighbors — what's on the 6 adjacent hexes
        const neighbors = getNeighborHexes(targetX, targetY);
        const neighborEntities: { dir: number; dirName: string; entities: EternumEntity[]; biome: string }[] = [];

        const dirNames = ["East", "NE", "NW", "West", "SW", "SE"];
        for (const n of neighbors) {
          const nKey = `${n.col},${n.row}`;
          const nTile = state.tileMap.get(nKey);
          const nEnts = state.entities.filter(
            (e) => e.position.x === n.col && e.position.y === n.row,
          );
          const biome = nTile ? biomeName(nTile.biome) : "Unexplored";
          if (nEnts.length > 0 || biome !== "Unexplored") {
            neighborEntities.push({
              dir: n.direction,
              dirName: dirNames[n.direction],
              entities: nEnts,
              biome,
            });
          }
        }

        if (neighborEntities.length > 0) {
          lines.push("");
          lines.push(`### Adjacent hexes`);
          for (const n of neighborEntities) {
            const entStr = n.entities.length > 0
              ? n.entities.map((e) => {
                  if (e.type === "structure") return `${e.structureType} #${e.entityId} (${e.isOwned ? "MINE" : e.ownerName || "enemy"})`;
                  return `Army #${e.entityId} ${e.troopSummary ?? ""} str=${fmtNum(e.strength ?? 0)} (${e.isOwned ? "MINE" : e.ownerName || "enemy"})`;
                }).join("; ")
              : "empty";
            lines.push(`  dir=${n.dir} (${n.dirName}): ${n.biome} — ${entStr}`);
          }
        }

        // Recent battles involving entities at this position
        const entityIdsHere = new Set(entitiesHere.map((e) => e.entityId));
        const battles = state.recentBattles.filter(
          (b) => entityIdsHere.has(b.attackerId) || entityIdsHere.has(b.defenderId),
        );
        if (battles.length > 0) {
          lines.push("");
          lines.push(`### Recent battles here`);
          for (const b of battles) {
            const ago = formatTimeAgo(b.timestamp);
            if (b.type === "raid") {
              lines.push(`  Raid: #${b.attackerId} → #${b.defenderId} — ${b.raidSuccess ? "SUCCESS" : "FAILED"} ${ago}`);
            } else {
              const winner = b.winnerId ? `winner=#${b.winnerId}` : "no winner";
              lines.push(`  Battle: #${b.attackerId} vs #${b.defenderId} — ${winner} ${ago}`);
            }
          }
        }

        const text = lines.join("\n");
        logToolResponse("inspect", params, text);
        return { content: [{ type: "text" as const, text }], details: { found: true } };
      } catch (err: any) {
        const text = `Error inspecting: ${err?.message ?? err}`;
        logToolResponse("inspect", params, text);
        return { content: [{ type: "text" as const, text }], details: { found: false } };
      }
    },
  };

  return [inspectTool];
}
