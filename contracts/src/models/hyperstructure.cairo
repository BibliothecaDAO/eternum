use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::{
    alias::ID,
    constants::{
        HYPERSTRUCTURE_CONFIG_ID, ResourceTypes, get_resources_without_earthenshards,
        get_contributable_resources_with_rarity, RESOURCE_PRECISION
    },
    models::{
        owner::{Owner}, position::{Coord, Position, PositionIntoCoord}, realm::{Realm},
        resources::{Resource, ResourceCustomImpl, ResourceCost},
        structure::{Structure, StructureCount, StructureCountCustomTrait, StructureCategory}, guild::{GuildMember}
    },
    systems::{transport::contracts::travel_systems::travel_systems::InternalTravelSystemsImpl},
};

use eternum::{constants::WORLD_CONFIG_ID};
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
pub impl EpochCustomImpl of EpochCustomTrait {
    fn get(world: IWorldDispatcher, hyperstructure_entity_id: ID, index: u16) -> Epoch {
        let epoch = get!(world, (hyperstructure_entity_id, index), Epoch);
        epoch
    }
}

#[generate_trait]
pub impl HyperstructureCustomImpl of HyperstructureCustomTrait {
    fn assert_access(self: Hyperstructure, world: IWorldDispatcher) {
        let contributor_address = starknet::get_caller_address();
        let hyperstructure_owner = get!(world, self.entity_id, Owner);

        match self.access {
            Access::Public => {},
            Access::Private => {
                assert!(contributor_address == hyperstructure_owner.address, "Hyperstructure is private");
            },
            Access::GuildOnly => {
                let guild_member = get!(world, contributor_address, GuildMember);

                let owner_guild_member = get!(world, hyperstructure_owner.address, GuildMember);
                assert!(guild_member.guild_entity_id == owner_guild_member.guild_entity_id, "not in the same guild");
            }
        }
    }
}
