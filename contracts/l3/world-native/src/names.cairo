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
pub const DEVCON_REALM_SKIN: u8 = 4;
pub const GOLDEN_DEVCON_REALM_SKIN: u8 = 5;

pub fn holds_realm_skin(
    seal_held: bool,
    aspect: u8,
    has_wonder: bool,
    devcon_held: bool,
    golden_devcon_held: bool,
    dev_unlocked: bool,
    family: u8,
) -> bool {
    if family == DEFAULT_REALM_SKIN || family == BASE_REALM_SKIN {
        return true;
    }
    if family == WONDER_REALM_SKIN {
        return has_wonder || (dev_unlocked && aspect != 0);
    }
    if family == SEASON_ONE_REALM_SKIN {
        return (seal_held || dev_unlocked) && aspect != 0;
    }
    if family == DEVCON_REALM_SKIN {
        return devcon_held || golden_devcon_held || dev_unlocked;
    }
    if family == GOLDEN_DEVCON_REALM_SKIN {
        return golden_devcon_held || dev_unlocked;
    }
    false
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
