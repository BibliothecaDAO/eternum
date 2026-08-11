// SeasonEnded carries game_id on s2 (winner announcement per game); on the
// legacy arm the {GF} marker resolves to 1=1.
export const SEASON_QUERIES = {
  SEASON_ENDED: `
    SELECT 
        winner_address,
        timestamp
    FROM \`s1_eternum-SeasonEnded\`
    WHERE {GF}
    ORDER BY timestamp DESC
    LIMIT 1;
  `,
} as const;
