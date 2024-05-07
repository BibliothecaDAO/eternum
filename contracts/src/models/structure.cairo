use array::SpanTrait;
use eternum::alias::ID;
use eternum::models::position::Coord;
use eternum::utils::unpack::unpack_resource_types;
use starknet::ContractAddress;
use traits::Into;

#[derive(Model, Copy, Drop, Serde)]
struct Structure {
    #[key]
    entity_id: u128,
    category: StructureCategory
}


#[generate_trait]
impl StructureImpl of StructureTrait {
    fn assert_is_structure(self: Structure) {
        assert!(self.is_structure(), "entity {} is not a structure", self.entity_id)
    }
    fn is_structure(self: Structure) -> bool {
        self.category != StructureCategory::None
    }
}


#[derive(PartialEq, Copy, Drop, Serde, PrintTrait, Introspect)]
enum StructureCategory {
    None,
    Realm,
    Hyperstructure,
    Bank
}

impl StructureCategoryIntoFelt252 of Into<StructureCategory, felt252> {
    fn into(self: StructureCategory) -> felt252 {
        match self {
            StructureCategory::None => 0,
            StructureCategory::Realm => 1,
            StructureCategory::Hyperstructure => 2,
            StructureCategory::Bank => 3,
        }
    }
}


#[derive(Model, Copy, Drop, Serde)]
struct StructureCount {
    #[key]
    coord: Coord,
    count: u8
}

#[generate_trait]
impl StructureCountImpl of StructureCountTrait {
    fn assert_none(self: StructureCount) {
        assert!(self.count == 0, "structure exists at this location");
    }
}
