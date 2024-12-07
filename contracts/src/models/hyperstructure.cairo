use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use s0_eternum::{
    alias::ID,
    constants::{
        HYPERSTRUCTURE_CONFIG_ID, ResourceTypes, get_resources_without_earthenshards,
        get_contributable_resources_with_rarity, RESOURCE_PRECISION
    },
    models::{
        owner::{Owner}, position::{Coord, Position, PositionIntoCoord}, realm::{Realm},
        resources::{Resource, ResourceImpl, ResourceCost},
        structure::{Structure, StructureCount, StructureCountTrait, StructureCategory}, guild::{GuildMember}
    },
    systems::{transport::contracts::travel_systems::travel_systems::InternalTravelSystemsImpl},
};

use s0_eternum::{constants::WORLD_CONFIG_ID};
use starknet::ContractAddress;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Hyperstructure {
    #[key]
    entity_id: ID,
    current_epoch: u16,
    completed: bool,
    last_updated_by: ContractAddress,
    last_updated_timestamp: u64,
    access: Access,
    randomness: felt252,
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
    hyperstructure_entity_id: ID,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Contribution {
    #[key]
    hyperstructure_entity_id: ID,
    #[key]
    player_address: ContractAddress,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Epoch {
    #[key]
    hyperstructure_entity_id: ID,
    #[key]
    index: u16,
    start_timestamp: u64,
    owners: Span<(ContractAddress, u16)>,
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
    fn assert_access(self: Hyperstructure, ref world: WorldStorage) {
        let contributor_address = starknet::get_caller_address();
        let hyperstructure_owner: Owner = world.read_model(self.entity_id);

        match self.access {
            Access::Public => {},
            Access::Private => {
                assert!(contributor_address == hyperstructure_owner.address, "Hyperstructure is private");
            },
            Access::GuildOnly => {
                let guild_member: GuildMember = world.read_model(contributor_address);
                let owner_guild_member: GuildMember = world.read_model(hyperstructure_owner.address);
                assert!(guild_member.guild_entity_id == owner_guild_member.guild_entity_id, "not in the same guild");
            }
        }
    }
}
