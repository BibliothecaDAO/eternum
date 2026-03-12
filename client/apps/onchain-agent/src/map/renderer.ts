import type { TileState, ExplorerInfo, StructureInfo } from "@bibliothecadao/client";
import type { StaminaConfig } from "@bibliothecadao/torii";
import { projectExplorerStamina } from "../world/stamina.js";

const OCCUPIER_ASCII: Record<number, string> = {
  0: ".",
  1: "R",
  2: "R",
  3: "R",
  4: "R",
  5: "W",
  6: "W",
  7: "W",
  8: "W",
  9: "H",
  10: "H",
  11: "H",
  12: "M",
  13: "V",
  14: "B",
  15: "k",
  16: "k",
  17: "k",
  18: "p",
  19: "p",
  20: "p",
  21: "x",
  22: "x",
  23: "x",
  24: "K",
  25: "K",
  26: "K",
  27: "P",
  28: "P",
  29: "P",
  30: "X",
  31: "X",
  32: "X",
  33: "Q",
  34: "C",
  35: "S",
};

/** Circled variants for agent-owned entities. */
const OWNED_ASCII: Record<number, string> = {
  1: "Ⓡ",
  2: "Ⓡ",
  3: "Ⓡ",
  4: "Ⓡ", // Realm
  5: "Ⓦ",
  6: "Ⓦ",
  7: "Ⓦ",
  8: "Ⓦ", // Wonder
  9: "Ⓗ",
  10: "Ⓗ",
  11: "Ⓗ", // Hyperstructure
  12: "Ⓜ",
  13: "Ⓥ",
  14: "Ⓑ", // Mine, Village, Bank
  15: "ⓚ",
  16: "ⓚ",
  17: "ⓚ", // Explorer (knight regular)
  18: "ⓟ",
  19: "ⓟ",
  20: "ⓟ", // Explorer (paladin regular)
  21: "ⓧ",
  22: "ⓧ",
  23: "ⓧ", // Explorer (crossbow regular)
  24: "Ⓚ",
  25: "Ⓚ",
  26: "Ⓚ", // Explorer (knight daydreams)
  27: "Ⓟ",
  28: "Ⓟ",
  29: "Ⓟ", // Explorer (paladin daydreams)
  30: "Ⓧ",
  31: "Ⓧ",
  32: "Ⓧ", // Explorer (crossbow daydreams)
};

/** Explorer occupier types: 15–32. */
function isExplorerType(occupierType: number): boolean {
  return occupierType >= 15 && occupierType <= 32;
}

export interface MapSnapshot {
  /** The full ASCII map text (legend + ruler + numbered rows). */
  text: string;
  /** Number of header lines before the first map row. */
  headerLines: number;
  /** Total map rows rendered. */
  rowCount: number;
  /** Total cell columns rendered. */
  colCount: number;
  /** All tiles used to build this snapshot. */
  tiles: TileState[];
  /** Fast lookup by world hex coordinate ("x,y" → TileState). */
  gridIndex: Map<string, TileState>;
  /** Resolve a map row:col (1-indexed) back to hex coordinates. */
  resolve(row: number, col: number): { x: number; y: number } | null;
  /** Get tile data at a map row:col (1-indexed). Null if unexplored. */
  tileAt(row: number, col: number): TileState | null;
  /** Fixed coordinate anchor — pass to subsequent renders to keep row:col stable. */
  anchor: MapAnchor;
}

/** Fixed coordinate anchor — locks minX/minY so row:col positions are stable across renders. */
export interface MapAnchor {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function renderMap(
  tiles: TileState[],
  ownedEntityIds?: Set<number>,
  explorerDetails?: Map<number, ExplorerInfo>,
  staminaConfig?: StaminaConfig,
  mapAnchor?: MapAnchor,
  structureDetails?: Map<number, StructureInfo>,
): MapSnapshot {
  if (tiles.length === 0) {
    return {
      text: "No explored tiles.",
      headerLines: 0,
      rowCount: 0,
      colCount: 0,
      tiles: [],
      gridIndex: new Map(),
      resolve: () => null,
      tileAt: () => null,
      anchor: mapAnchor ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    };
  }

  // Compute the bounding box of explored tiles, but anchor the coordinate
  // system to a fixed center so that row:col positions are stable across
  // renders (new tile exploration doesn't shift existing coordinates).
  // We use the midpoint of all tiles as the anchor on first render;
  // subsequent renders use the same anchor via the stored minX/minY.
  let rawMinX = Infinity,
    rawMaxX = -Infinity;
  let rawMinY = Infinity,
    rawMaxY = -Infinity;
  const grid = new Map<string, TileState>();

  for (const t of tiles) {
    if (t.position.x < rawMinX) rawMinX = t.position.x;
    if (t.position.x > rawMaxX) rawMaxX = t.position.x;
    if (t.position.y < rawMinY) rawMinY = t.position.y;
    if (t.position.y > rawMaxY) rawMaxY = t.position.y;
    grid.set(`${t.position.x},${t.position.y}`, t);
  }

  // Use the fixed anchor if provided (keeps coordinates stable across renders).
  // If no anchor, use the current bounding box (first render).
  const minX = mapAnchor?.minX ?? rawMinX;
  const minY = mapAnchor?.minY ?? rawMinY;
  // maxX/maxY always expand to include all tiles
  const maxX = Math.max(mapAnchor?.maxX ?? rawMaxX, rawMaxX);
  const maxY = Math.max(mapAnchor?.maxY ?? rawMaxY, rawMaxY);

  const totalRows = maxY - minY + 1;
  const totalCols = maxX - minX + 1;
  const rowNumWidth = String(totalRows).length;
  const prefix = (n: number) => String(n).padStart(rowNumWidth) + "| ";
  const blankPrefix = " ".repeat(rowNumWidth) + "  ";

  const lines: string[] = [];

  // Legend (compact)
  lines.push("LEGEND: . explored  R realm  W wonder  H hyperstructure  M mine  V village  B bank");
  lines.push("        k/p/x explorers (regular)  K/P/X explorers (daydreams)  Q quest  C chest  S spire");
  lines.push("  MINE: Ⓡ realm  Ⓦ wonder  Ⓗ hyper  Ⓜ mine  Ⓥ village  Ⓑ bank  ⓚ/ⓟ/ⓧ Ⓚ/Ⓟ/Ⓧ explorers");
  lines.push("");

  // Column numbers — label every 5th column, aligned to the 2-char cell grid
  {
    const gutter = " ".repeat(rowNumWidth + 2);
    let colLine = gutter;
    for (let c = 1; c <= totalCols; c++) {
      if (c % 5 === 0) {
        const s = String(c);
        colLine = colLine.slice(0, colLine.length - (s.length - 1)) + s + " ";
      } else {
        colLine += "  ";
      }
    }
    lines.push(colLine.trimEnd());
  }

  const headerLines = lines.length;

  // Map rows — north (maxY) at top
  for (let y = maxY; y >= minY; y--) {
    const mapRow = maxY - y + 1;
    const indent = y % 2 === 0 ? " " : "";
    let row = indent;
    for (let x = minX; x <= maxX; x++) {
      const t = grid.get(`${x},${y}`);
      if (!t) {
        row += "  ";
      } else {
        const isOwned = ownedEntityIds && t.occupierId > 0 && ownedEntityIds.has(t.occupierId);
        const ch = isOwned
          ? (OWNED_ASCII[t.occupierType] ?? OCCUPIER_ASCII[t.occupierType] ?? "?")
          : (OCCUPIER_ASCII[t.occupierType] ?? "?");
        row += ch + " ";
      }
    }
    lines.push(prefix(mapRow) + row.trimEnd());
  }

  // Annotate own entities grouped by type
  if (ownedEntityIds && ownedEntityIds.size > 0) {
    const structureItems: string[] = [];
    const armyItems: string[] = [];

    for (let y = maxY; y >= minY; y--) {
      const mapRow = maxY - y + 1;
      for (let x = minX; x <= maxX; x++) {
        const t = grid.get(`${x},${y}`);
        if (!t || t.occupierId <= 0 || !ownedEntityIds.has(t.occupierId)) continue;
        const col = x - minX + 1;
        const ch = OWNED_ASCII[t.occupierType] ?? OCCUPIER_ASCII[t.occupierType] ?? "?";

        if (isExplorerType(t.occupierType)) {
          const detail = explorerDetails?.get(t.occupierId);
          if (detail) {
            const projected = staminaConfig ? projectExplorerStamina(detail, staminaConfig) : detail.stamina;
            armyItems.push(
              `  ${ch} ${mapRow}:${col} | ${detail.troopCount.toLocaleString()} ${detail.troopType} ${detail.troopTier} | stamina=${projected}`,
            );
          } else {
            armyItems.push(`  ${ch} ${mapRow}:${col}`);
          }
        } else {
          const info = structureDetails?.get(t.occupierId);
          if (info) {
            // Show level, army slots, and troop reserves
            const troops = info.resources
              .filter((r) => /Knight|Paladin|Crossbowman/.test(r.name) && r.amount > 0)
              .map((r) => `${r.amount.toLocaleString()} ${r.name}`)
              .join(", ");
            const troopStr = troops ? ` | troops: ${troops}` : "";
            structureItems.push(
              `  ${ch} ${mapRow}:${col} | ${info.category} lv${info.level} | armies ${info.explorerCount}/${info.maxExplorerCount}${troopStr}`,
            );
          } else {
            structureItems.push(`  ${ch} ${mapRow}:${col}`);
          }
        }
      }
    }

    if (structureItems.length > 0 || armyItems.length > 0) {
      lines.push("");
      lines.push("YOUR ENTITIES:");
      if (structureItems.length > 0) {
        lines.push(`  Structures (${structureItems.length}):`);
        lines.push(...structureItems);
      }
      if (armyItems.length > 0) {
        lines.push(`  Armies (${armyItems.length}):`);
        lines.push(...armyItems);
      }
    }
  }

  // Points of interest — hyperstructures, mines, villages, enemy structures
  {
    const hyperstructures: string[] = [];
    const mines: string[] = [];
    const villages: string[] = [];
    const banks: string[] = [];
    const quests: string[] = [];
    const chests: string[] = [];

    for (let y = maxY; y >= minY; y--) {
      const mapRow = maxY - y + 1;
      for (let x = minX; x <= maxX; x++) {
        const t = grid.get(`${x},${y}`);
        if (!t || t.occupierType === 0) continue;
        // Skip own entities — already listed above
        if (ownedEntityIds && t.occupierId > 0 && ownedEntityIds.has(t.occupierId)) continue;
        // Skip explorers — too noisy
        if (isExplorerType(t.occupierType)) continue;

        const col = x - minX + 1;
        const loc = `${mapRow}:${col}`;
        const ot = t.occupierType;
        if (ot >= 9 && ot <= 11) hyperstructures.push(`  H ${loc}`);
        else if (ot === 12) mines.push(`  M ${loc}`);
        else if (ot === 13) villages.push(`  V ${loc}`);
        else if (ot === 14) banks.push(`  B ${loc}`);
        else if (ot === 33) quests.push(`  Q ${loc}`);
        else if (ot === 34) chests.push(`  C ${loc}`);
      }
    }

    const sections = [
      hyperstructures.length > 0 ? [`  Hyperstructures (${hyperstructures.length}):`, ...hyperstructures] : [],
      mines.length > 0 ? [`  Fragment Mines (${mines.length}):`, ...mines] : [],
      villages.length > 0 ? [`  Villages (${villages.length}):`, ...villages] : [],
      banks.length > 0 ? [`  Banks (${banks.length}):`, ...banks] : [],
      quests.length > 0 ? [`  Quests (${quests.length}):`, ...quests] : [],
      chests.length > 0 ? [`  Chests (${chests.length}):`, ...chests] : [],
    ].filter((s) => s.length > 0);

    if (sections.length > 0) {
      lines.push("");
      lines.push("POINTS OF INTEREST:");
      for (const section of sections) {
        lines.push(...section);
      }
    }
  }

  const text = lines.join("\n");

  function resolve(mapRow: number, col: number): { x: number; y: number } | null {
    if (mapRow < 1 || mapRow > totalRows || col < 1 || col > totalCols) return null;
    const y = maxY - (mapRow - 1);
    const x = minX + (col - 1);
    return { x, y };
  }

  function tileAt(mapRow: number, col: number): TileState | null {
    const pos = resolve(mapRow, col);
    if (!pos) return null;
    return grid.get(`${pos.x},${pos.y}`) ?? null;
  }

  const anchor: MapAnchor = { minX, minY, maxX, maxY };
  return {
    text,
    headerLines,
    rowCount: totalRows,
    colCount: totalCols,
    tiles,
    gridIndex: grid,
    resolve,
    tileAt,
    anchor,
  };
}
