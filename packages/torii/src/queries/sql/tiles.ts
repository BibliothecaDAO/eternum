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
} as const;
