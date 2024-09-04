use array::SpanTrait;
use eternum::alias::ID;
use eternum::models::position::Coord;
use eternum::models::config::BattleConfig;
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
    fn is_structure(self: Structure) -> bool {
        self.category != StructureCategory::None
    }

    fn can_be_attacked(self: Structure, config: BattleConfig) -> (bool, ByteArray) {
        let now = starknet::get_block_timestamp();
        if self.created_at + config.structure_grace_period > now  {
            let remaining_time_seconds = (self.created_at + config.structure_grace_period - now);
            let remaining_time_minutes = remaining_time_seconds / 60;
            return (false, format!("Structure is still in battle grace period, cannot be attacked for {} minutes ({} seconds)", remaining_time_minutes, remaining_time_seconds));
        }

        if self.category == StructureCategory::Bank {
            return (false, "Banks cannot be attacked");
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
