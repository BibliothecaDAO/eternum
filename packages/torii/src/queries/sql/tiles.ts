// {GF} markers resolve to the active game filter (see applySqlGameScope).
export const TILES_QUERIES = {
  ALL_TILES: `
    SELECT DISTINCT
        data
    FROM \`s1_eternum-TileOpt\`
    WHERE {GF}
    ORDER BY alt, col, row;
  `,

  TILES_IN_BOUNDS: `
    SELECT
        data
    FROM \`s1_eternum-TileOpt\`
    WHERE {GF}
      AND col >= {minX}
      AND col <= {maxX}
      AND row >= {minY}
      AND row <= {maxY}
    ORDER BY alt, col, row;
  `,
} as const;
