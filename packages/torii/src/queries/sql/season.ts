// SeasonEnded is s1-only (the s2 single world tracks game end on
// GameRegistry.status) — fetchSeasonEnded short-circuits on the s2 arm.
export const SEASON_QUERIES = {
  SEASON_ENDED: `
    SELECT 
        winner_address,
        timestamp
    FROM \`s1_eternum-SeasonEnded\`
    ORDER BY timestamp DESC
    LIMIT 1;
  `,
} as const;
