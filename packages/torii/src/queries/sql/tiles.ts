export const TILES_QUERIES = {
  ALL_TILES: `
    SELECT DISTINCT
        data
    FROM \`s1_eternum-TileOpt\`
    ORDER BY alt, col, row;
  `,

  TILES_BY_COORDS: `
    SELECT
        data
    FROM \`s1_eternum-TileOpt\`
    WHERE (col, row) IN ({coords});
  `,

  TILES_IN_BOUNDS: `
    SELECT
        data
    FROM \`s1_eternum-TileOpt\`
    WHERE col >= {minX}
      AND col <= {maxX}
      AND row >= {minY}
      AND row <= {maxY}
    ORDER BY alt, col, row;
  `,
} as const;
