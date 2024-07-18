use array::SpanTrait;
use eternum::alias::ID;
use eternum::models::position::Coord;
use eternum::utils::unpack::unpack_resource_types;
use starknet::ContractAddress;
use traits::Into;

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Structure {
    #[key]
    entity_id: u128,
    category: StructureCategory
}


#[generate_trait]
impl StructureCustomImpl of StructureCustomTrait {
    fn assert_is_structure(self: Structure) {
        assert!(self.is_structure(), "entity {} is not a structure", self.entity_id)
    }
    fn is_structure(self: Structure) -> bool {
        self.category != StructureCategory::None
    }
}


#[derive(PartialEq, Copy, Drop, Serde,  Introspect)]
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


#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct StructureCount {
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
