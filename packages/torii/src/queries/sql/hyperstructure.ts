// 64 is 8*8 hexagons, which is the radius of the hyperstructure in hexagons
export const HYPERSTRUCTURE_QUERIES = {
  HYPERSTRUCTURES_WITH_REALM_COUNT: `
    WITH latest_battles AS (
        -- Get latest battles where this hyperstructure was the defender
        SELECT DISTINCT
            defender_id,
            FIRST_VALUE(attacker_id) OVER (
                PARTITION BY defender_id 
                ORDER BY timestamp DESC
            ) as latest_attacker_id,
            FIRST_VALUE(timestamp) OVER (
                PARTITION BY defender_id 
                ORDER BY timestamp DESC
            ) as latest_attack_timestamp
        FROM \`s1_eternum-BattleEvent\`
        WHERE timestamp > 1757487964
    ),
    latest_defenses AS (
        -- Get latest battles where this hyperstructure was the attacker
        SELECT DISTINCT
            attacker_id,
            FIRST_VALUE(defender_id) OVER (
                PARTITION BY attacker_id 
                ORDER BY timestamp DESC
            ) as latest_defender_id,
            FIRST_VALUE(timestamp) OVER (
                PARTITION BY attacker_id 
                ORDER BY timestamp DESC
            ) as latest_defense_timestamp
        FROM \`s1_eternum-BattleEvent\`
        WHERE timestamp > 1757487964
    )
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
        ) as realm_count_within_radius,
        
        -- Battle data
        lb.latest_attacker_id,
        lb.latest_attack_timestamp,
        ld.latest_defender_id,
        ld.latest_defense_timestamp
        
    FROM \`s1_eternum-Structure\` h
    LEFT JOIN \`s1_eternum-Structure\` r ON r.category = 1
    LEFT JOIN latest_battles lb ON lb.defender_id = h.entity_id
    LEFT JOIN latest_defenses ld ON ld.attacker_id = h.entity_id
    WHERE h.category = 2
    GROUP BY h.entity_id, h.\`base.coord_x\`, h.\`base.coord_y\`, 
             lb.latest_attacker_id, lb.latest_attack_timestamp,
             ld.latest_defender_id, ld.latest_defense_timestamp
    ORDER BY h.entity_id;
  `,
} as const;
