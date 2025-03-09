use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::{alias::ID, models::{guild::{GuildMember}, position::{PositionIntoCoord}}};

use starknet::ContractAddress;


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct HyperstructureGlobals {
    #[key]
    pub world_id: ID,
    pub created_count: u32,
    pub completed_count: u32,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Hyperstructure {
    #[key]
    pub entity_id: ID,
    pub last_updated_by: ContractAddress,
    pub last_updated_timestamp: u64,
    pub current_epoch: u16,
    pub initialized: bool,
    pub completed: bool,
    pub access: Access,
    pub randomness: felt252,
}

#[derive(PartialEq, Copy, Drop, Serde, IntrospectPacked)]
pub enum Access {
    Public,
    Private,
    GuildOnly,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Progress {
    #[key]
    pub hyperstructure_entity_id: ID,
    #[key]
    pub resource_type: u8,
    pub amount: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Contribution {
    #[key]
    pub hyperstructure_entity_id: ID,
    #[key]
    pub player_address: ContractAddress,
    #[key]
    pub resource_type: u8,
    pub amount: u128,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Epoch {
    #[key]
    pub hyperstructure_entity_id: ID,
    #[key]
    pub index: u16,
    pub start_timestamp: u64,
    pub owners: Span<(ContractAddress, u16)>,
}

#[generate_trait]
pub impl EpochImpl of EpochTrait {
    fn get(ref world: WorldStorage, hyperstructure_entity_id: ID, index: u16) -> Epoch {
        let epoch: Epoch = world.read_model((hyperstructure_entity_id, index));
        epoch
    }
}

#[generate_trait]
pub impl HyperstructureImpl of HyperstructureTrait {
    fn assert_access(self: Hyperstructure, ref world: WorldStorage, owner_address: ContractAddress) {
        let contributor_address = starknet::get_caller_address();
        match self.access {
            Access::Public => {},
            Access::Private => { assert!(contributor_address == owner_address, "Hyperstructure is private"); },
            Access::GuildOnly => {
                let guild_member: GuildMember = world.read_model(contributor_address);
                let owner_guild_member: GuildMember = world.read_model(owner_address);
                assert!(guild_member.guild_entity_id == owner_guild_member.guild_entity_id, "not in the same guild");
            },
        }
    }
}
