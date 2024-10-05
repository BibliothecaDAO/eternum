use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::{alias::ID, constants::WORLD_CONFIG_ID};
use starknet::ContractAddress;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Season {
    #[key]
    config_id: ID,
    is_over: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Hyperstructure {
    #[key]
    entity_id: ID,
    current_epoch: u16,
    completed: bool,
    last_updated_by: ContractAddress,
    last_updated_timestamp: u64,
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
pub impl SeasonCustomImpl of SeasonCustomTrait {
    fn end_season(world: IWorldDispatcher) {
        set!(world, (Season { config_id: WORLD_CONFIG_ID, is_over: true }));
    }

    fn assert_season_is_not_over(world: IWorldDispatcher) {
        let season = get!(world, WORLD_CONFIG_ID, Season);
        assert!(season.is_over == false, "Season is over");
    }
}

