use array::SpanTrait;
use s0_eternum::alias::ID;
use s0_eternum::models::config::{BattleConfig, TickConfig, TickTrait};
use s0_eternum::models::position::Coord;
use starknet::ContractAddress;
use traits::Into;

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Structure {
    #[key]
    entity_id: ID,
    category: StructureCategory,
    created_at: u64
}


#[generate_trait]
impl StructureImpl of StructureTrait {
    fn assert_is_structure(self: Structure) {
        assert!(self.is_structure(), "entity {} is not a structure", self.entity_id)
    }

    fn assert_no_initial_attack_immunity(self: Structure, battle_config: BattleConfig, tick_config: TickConfig) {
        let (no_initial_attack_immunity, reason) = self.no_initial_attack_immunity(battle_config, tick_config);
        assert!(no_initial_attack_immunity, "{}", reason);
    }

    fn is_structure(self: Structure) -> bool {
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


#[derive(PartialEq, Copy, Drop, Serde, Introspect)]
enum StructureCategory {
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


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct StructureCount {
    #[key]
    coord: Coord,
    count: u8
}

#[generate_trait]
impl StructureCountImpl of StructureCountTrait {
    fn assert_none(self: StructureCount) {
        assert!(self.count == 0, "structure exists at this location");
    }

    fn is_none(self: StructureCount) -> bool {
        self.count == 0
    }
}
