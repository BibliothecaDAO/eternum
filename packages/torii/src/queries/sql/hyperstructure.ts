// 64 is 8*8 hexagons, which is the radius of the hyperstructure in hexagons
export const HYPERSTRUCTURE_QUERIES = {
  HYPERSTRUCTURES_WITH_REALM_COUNT: `
    SELECT 
        h.entity_id as hyperstructure_entity_id,
        h.\`base.coord_x\` as hyperstructure_coord_x,
        h.\`base.coord_y\` as hyperstructure_coord_y,
        COUNT(
            CASE 
                WHEN r.category = 1 
                AND (
                    (r.\`base.coord_x\` - h.\`base.coord_x\`) * (r.\`base.coord_x\` - h.\`base.coord_x\`) +
                    (r.\`base.coord_y\` - h.\`base.coord_y\`) * (r.\`base.coord_y\` - h.\`base.coord_y\`)
                ) <= {radius}
                THEN 1 
                ELSE NULL 
            END
        ) as realm_count_within_radius
    FROM [s1_eternum-Structure] h
    LEFT JOIN [s1_eternum-Structure] r ON r.category = 1
    WHERE h.category = 2
    GROUP BY h.entity_id, h.\`base.coord_x\`, h.\`base.coord_y\`
    ORDER BY h.entity_id;
  `,
} as const;
