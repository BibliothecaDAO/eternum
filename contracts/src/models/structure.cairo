use array::SpanTrait;
use eternum::alias::ID;
use eternum::models::config::{BattleConfig, TickConfig, TickTrait};
use eternum::models::position::Coord;
use eternum::utils::unpack::unpack_resource_types;
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
impl StructureCustomImpl of StructureCustomTrait {
    fn assert_is_structure(self: Structure) {
        assert!(self.is_structure(), "entity {} is not a structure", self.entity_id)
    }

    fn assert_can_be_attacked(self: Structure, battle_config: BattleConfig, tick_config: TickConfig) {
        let (can_be_attacked, reason) = self.can_be_attacked(battle_config, tick_config);
        assert!(can_be_attacked, "{}", reason);
    }

    fn is_structure(self: Structure) -> bool {
        self.category != StructureCategory::None
    }

    fn can_be_attacked(self: Structure, battle_config: BattleConfig, tick_config: TickConfig) -> (bool, ByteArray) {
        let current_tick = tick_config.current();
        let allow_attack_tick = tick_config.at(self.created_at) + battle_config.battle_grace_tick_count.into();

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
impl StructureCountCustomImpl of StructureCountCustomTrait {
    fn assert_none(self: StructureCount) {
        assert!(self.count == 0, "structure exists at this location");
    }
}
