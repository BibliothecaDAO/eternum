use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct EntityName {
    pub name: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SetEntityName {
    pub entity_id: u64,
    pub name: felt252,
}

pub const DEFAULT_REALM_SKIN: u8 = 0;
pub const BASE_REALM_SKIN: u8 = 1;
pub const SEASON_ONE_REALM_SKIN: u8 = 2;
pub const WONDER_REALM_SKIN: u8 = 3;

pub fn holds_realm_skin(seal_held: bool, aspect: u8, has_wonder: bool, family: u8) -> bool {
    if family == DEFAULT_REALM_SKIN || family == BASE_REALM_SKIN {
        return true;
    }
    if family == WONDER_REALM_SKIN {
        return has_wonder;
    }
    family == SEASON_ONE_REALM_SKIN && seal_held && aspect != 0
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmSkin {
    pub family: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SetRealmSkin {
    pub entity_id: u64,
    pub family: u8,
}

#[starknet::interface]
pub trait INames<T> {
    #[cfg(feature: "test_support")]
    fn entity_name(self: @T, key: crate::resources::ResourceKey) -> EntityName;
    fn set_entity_name(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: SetEntityName,
        context: crate::commands::ActionContext,
    );
    #[cfg(feature: "test_support")]
    fn realm_skin(self: @T, key: crate::resources::ResourceKey) -> RealmSkin;
    fn set_realm_skin(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: SetRealmSkin,
        context: crate::commands::ActionContext,
    );
}
