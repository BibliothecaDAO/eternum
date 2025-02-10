use array::SpanTrait;
use s1_eternum::alias::ID;
use s1_eternum::models::config::{BattleConfig, TickConfig, TickTrait};
use s1_eternum::models::position::Coord;
use s1_eternum::models::owner::Owner;
use s1_eternum::models::troop::{GuardTroops, Troops, TroopType, TroopTier};
use s1_eternum::models::stamina::Stamina;
use starknet::ContractAddress;
use traits::Into;


// todo: obtain each value as needed not all at once
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Structure {
    #[key]
    entity_id: ID,
    category: StructureCategory,
    owner: Owner,
    coord: Coord,
    guards: GuardTroops,
    troop: StructureTroop,
    created_at: u64,
}


// todo hmm getting structure will cost more for 
// players with more explorers
#[derive(Introspect, Copy, Drop, Serde)]
struct StructureTroop {
    // maximum total explorer + guards allowed for this structure
    max_troops_allowed: u32,
    // maximum number of guards allowed for this structure
    max_guards_allowed: u32,
    // number of guards currently in this structure
    guard_count: u32,
    // list of explorers associated with this structure
    explorers: Span<ID>,
}

// implement Default trait

#[generate_trait]
impl StructureImpl of StructureTrait {

    fn default() -> Structure {
        let troops: Troops = Troops {
            category: TroopType::Knight,
            tier: TroopTier::T1,
            count: 0,
            stamina: Stamina {
                amount: 0,
                updated_tick: 0,
            },
        };
        Structure {
            entity_id: 0,
            category: StructureCategory::None,
            owner: Owner {
                entity_id: 0,
                address: Zeroable::zero(),
            },
            coord: Coord { x: 0, y: 0 },
            troop: StructureTroop {
                max_troops_allowed: 0,
                max_guards_allowed: 0,
                guard_count: 0,
                explorers: array![].span(),
            },
            guards: GuardTroops {
                delta: troops,
                charlie: troops,
                bravo: troops,
                alpha: troops,
                delta_destroyed_tick: 0,
                charlie_destroyed_tick: 0,
                bravo_destroyed_tick: 0,
                alpha_destroyed_tick: 0,
            },
            created_at: 0,
        }
    }

    fn new(entity_id: ID, category: StructureCategory, coord: Coord, owner: Owner) -> Structure {
        assert!(category != StructureCategory::None, "category cannot be none");
        let mut structure: Structure = Self::default();
        structure.entity_id = entity_id;
        structure.category = category;
        structure.coord = coord;
        structure.owner = owner;

        match category {
            StructureCategory::Realm => {
                structure.troop.max_troops_allowed = 2;
                structure.troop.max_guards_allowed = 1; // 1 guard, 1 explorer
            },
            StructureCategory::Hyperstructure => {
                structure.troop.max_troops_allowed = 4;
                structure.troop.max_guards_allowed = 4; // 4 guards, 0 explorers
            },
            StructureCategory::Bank => {
                structure.troop.max_troops_allowed = 4;
                structure.troop.max_guards_allowed = 4; // 4 guards, 0 explorers
            },
            StructureCategory::FragmentMine => {
                structure.troop.max_troops_allowed = 1;
                structure.troop.max_guards_allowed = 1; // 1 guard, 0 explorers
            },
            _ => {
                panic!("invalid structure category");
            }
        }
        structure.created_at = starknet::get_block_timestamp();
        structure
    }

    fn assert_exists(self: Structure) {
        assert!(self.exists(), "entity {} is not a structure", self.entity_id)
    }

    fn assert_no_initial_attack_immunity(self: Structure, battle_config: BattleConfig, tick_config: TickConfig) {
        let (no_initial_attack_immunity, reason) = self.no_initial_attack_immunity(battle_config, tick_config);
        assert!(no_initial_attack_immunity, "{}", reason);
    }

    fn exists(self: Structure) -> bool {
        self.category != StructureCategory::None
    }

    fn no_initial_attack_immunity(
        self: Structure, battle_config: BattleConfig, tick_config: TickConfig
    ) -> (bool, ByteArray) {
        // Fragment mines have no immunity
        if self.category == StructureCategory::FragmentMine {
            return (true, "");
        }

        let current_tick = tick_config.current();
        let mut allow_attack_tick: u64 = 0;
        if self.category == StructureCategory::Hyperstructure {
            allow_attack_tick = tick_config.at(self.created_at) + battle_config.hyperstructure_immunity_ticks.into();
        } else {
            allow_attack_tick = tick_config.at(self.created_at) + battle_config.regular_immunity_ticks.into();
        }

        if current_tick < allow_attack_tick {
            let remaining_ticks = allow_attack_tick - current_tick;
            return (
                false,
                format!("structure and related entities cannot be attacked for another {} ticks", remaining_ticks)
            );
        }

        return (true, "");
    }
}


#[derive(PartialEq, Copy, Drop, Serde, Introspect, Default)]
enum StructureCategory {
    #[default]
    None,
    Realm,
    Hyperstructure,
    Bank,
    FragmentMine
}

impl StructureCategoryIntoFelt252 of Into<StructureCategory, felt252> {
    fn into(self: StructureCategory) -> felt252 {
        match self {
            StructureCategory::None => 0,
            StructureCategory::Realm => 1,
            StructureCategory::Hyperstructure => 2,
            StructureCategory::Bank => 3,
            StructureCategory::FragmentMine => 4,
        }
    }
}
