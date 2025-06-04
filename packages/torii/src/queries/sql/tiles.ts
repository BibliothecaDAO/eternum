export const TILES_QUERIES = {
  ALL_TILES: `
    SELECT DISTINCT
        col,
        row,
        biome,
        occupier_id,
        occupier_type,
        occupier_is_structure
    FROM \`s1_eternum-Tile\`
    ORDER BY col, row;
  `,

  TILES_BY_COORDS: `
    SELECT 
        col,
        row,
        biome,
        occupier_id,
        occupier_type,
        occupier_is_structure
    FROM \`s1_eternum-Tile\`
    WHERE (col, row) IN ({coords});
  `,
} as const;
