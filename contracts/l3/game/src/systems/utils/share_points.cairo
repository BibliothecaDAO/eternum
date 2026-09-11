use core::num::traits::Zero;
use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use starknet::ContractAddress;
use crate::alias::ID;
use crate::models::config::{SeasonConfigImpl, VictoryPointsGrantConfig, WorldConfigUtilImpl};
use crate::models::events::{PointsActivity, PointsRegisteredStory, Story, StoryEvent};
use crate::models::hyperstructure::{
    CompletedHyperstructureImpl, Hyperstructure, HyperstructureGlobals, HyperstructureShareholders,
    PlayerRegisteredPointsImpl,
};
use crate::utils::achievements::index::{AchievementTrait, Tasks};
use crate::utils::math::PercentageValueImpl;

pub fn settle_completed_hyperstructures(ref world: WorldStorage, game_id: u32) {
    let globals: HyperstructureGlobals = world.read_model(game_id);
    for index in 0..globals.completed_count {
        let hyperstructure_id = CompletedHyperstructureImpl::get(world, game_id, index);
        settle_hyperstructure_shares(ref world, game_id, hyperstructure_id);
    }
}

/// Checkpoint every shareholder before changing shares or the multiplier.
/// The season cutoff applies even when a checkpoint runs after the game ends.
pub fn settle_hyperstructure_shares(ref world: WorldStorage, game_id: u32, hyperstructure_id: ID) {
    let hyperstructure: Hyperstructure = world.read_model((game_id, hyperstructure_id));
    assert!(hyperstructure.initialized, "hyperstructure has not been initialized");
    assert!(hyperstructure.completed, "hyperstructure has not been completed");
    let season = SeasonConfigImpl::get(world, game_id);
    let now = starknet::get_block_timestamp();
    let cutoff = if !season.dev_mode_on && now > season.end_at {
        season.end_at
    } else {
        now
    };
    let mut shares: HyperstructureShareholders = world.read_model((game_id, hyperstructure_id));
    if cutoff <= shares.start_at {
        return;
    }
    let config: VictoryPointsGrantConfig = WorldConfigUtilImpl::get_member(
        world, game_id, selector!("victory_points_grant_config"),
    );
    for (address, percentage) in shares.shareholders {
        if address.is_non_zero() {
            let points: u256 = Into::<u64, u256>::into(cutoff - shares.start_at)
                * config.hyp_points_per_second.into()
                * hyperstructure.points_multiplier.into()
                * (*percentage).into()
                / PercentageValueImpl::_100().into();
            record_share_points(ref world, game_id, hyperstructure_id, *address, points.try_into().unwrap());
        }
    }
    shares.start_at = cutoff;
    world.write_model(@shares);
}

fn record_share_points(
    ref world: WorldStorage, game_id: u32, hyperstructure_id: ID, address: ContractAddress, points: u128,
) {
    if points == 0 {
        return;
    }
    PlayerRegisteredPointsImpl::register_points(ref world, game_id, address, points);
    let achievement_points = points / 1_000_000;
    let achievement_points: u32 = if achievement_points > 0xffffffff {
        0xffffffff
    } else {
        achievement_points.try_into().unwrap()
    };
    let now = starknet::get_block_timestamp();
    AchievementTrait::progress(world, address.into(), Tasks::VICTORY_POINTS, achievement_points, now);
    world
        .emit_event(
            @StoryEvent {
                game_id,
                id: world.dispatcher.uuid(),
                owner: Option::Some(address),
                entity_id: Option::Some(hyperstructure_id),
                tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                story: Story::PointsRegisteredStory(
                    PointsRegisteredStory {
                        owner_address: address, activity: PointsActivity::HyperstructureSharePoints, points,
                    },
                ),
                timestamp: now,
            },
        );
}

#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorage;
    use dojo_snf_test::{NamespaceDef, TestResource, spawn_test_world};
    use snforge_std::start_cheat_block_timestamp_global;
    use crate::constants::DEFAULT_NS_STR;
    use crate::models::config::{VictoryPointsGrantConfig, WorldConfigUtilImpl};
    use crate::models::game::{GameRegistry, GameStatus};
    use crate::models::hyperstructure::{
        CompletedHyperstructureImpl, Hyperstructure, HyperstructureShareholders, PlayerRegisteredPoints,
    };
    use crate::models::season::SeasonPrize;
    use super::{settle_completed_hyperstructures, settle_hyperstructure_shares};

    fn setup() -> WorldStorage {
        let mut world = spawn_test_world(
            [
                NamespaceDef {
                    namespace: DEFAULT_NS_STR(),
                    resources: [
                        TestResource::Model("GameRegistry"), TestResource::Model("PresetConfig"),
                        TestResource::Model("Hyperstructure"), TestResource::Model("HyperstructureShareholders"),
                        TestResource::Model("SharePointsCheckpoint"), TestResource::Model("HyperstructureGlobals"),
                        TestResource::Model("CompletedHyperstructure"), TestResource::Model("HyperstructureIndex"),
                        TestResource::Model("PlayerRegisteredPoints"), TestResource::Model("SeasonPrize"),
                        TestResource::Event("StoryEvent"), TestResource::Event("TrophyProgression"),
                    ]
                        .span(),
                }
            ]
                .span(),
        );
        world
            .write_model_test(
                @GameRegistry {
                    game_id: 1,
                    name: 'test',
                    series_id: 0,
                    game_number_in_series: 0,
                    preset_id: 1,
                    creator: 1.try_into().unwrap(),
                    status: GameStatus::Live,
                    dev_mode_on: false,
                    start_settling_at: 1,
                    start_main_at: 10,
                    end_at: 200,
                    end_grace_seconds: 0,
                    registration_grace_seconds: 0,
                    final_trial_id: 0,
                    seed: 0,
                },
            );
        WorldConfigUtilImpl::set_member(
            ref world,
            1,
            selector!("victory_points_grant_config"),
            VictoryPointsGrantConfig {
                hyp_points_per_second: 1_000_000,
                claim_hyperstructure_points: 0,
                claim_otherstructure_points: 0,
                explore_tiles_points: 0,
                relic_open_points: 0,
            },
        );
        world
            .write_model_test(
                @Hyperstructure {
                    game_id: 1,
                    hyperstructure_id: 7,
                    initialized: true,
                    completed: true,
                    access: Default::default(),
                    randomness: 0,
                    points_multiplier: 2,
                },
            );
        world
            .write_model_test(
                @HyperstructureShareholders {
                    game_id: 1,
                    hyperstructure_id: 7,
                    start_at: 100,
                    shareholders: array![(11.try_into().unwrap(), 2500), (12.try_into().unwrap(), 7500)].span(),
                },
            );
        CompletedHyperstructureImpl::record(ref world, 1, 7);
        world
    }

    #[test]
    fn checkpoints_are_idempotent_and_stop_at_season_end() {
        let mut world = setup();
        start_cheat_block_timestamp_global(100);
        settle_hyperstructure_shares(ref world, 1, 7);
        start_cheat_block_timestamp_global(300);
        settle_completed_hyperstructures(ref world, 1);
        settle_completed_hyperstructures(ref world, 1);
        let first: PlayerRegisteredPoints = world.read_model((1_u32, starknet::contract_address_const::<11>()));
        let second: PlayerRegisteredPoints = world.read_model((1_u32, starknet::contract_address_const::<12>()));
        let season: SeasonPrize = world.read_model(1_u32);
        let shares: HyperstructureShareholders = world.read_model((1_u32, 7_felt252));
        assert!(first.registered_points == 50_000_000, "quarter share incorrect");
        assert!(second.registered_points == 150_000_000, "three-quarter share incorrect");
        assert!(season.total_registered_points == 200_000_000, "global total is inconsistent");
        assert!(shares.start_at == 200, "cursor exceeded season cutoff");
    }

    #[test]
    fn old_shareholders_keep_points_before_rate_and_share_change() {
        let mut world = setup();
        start_cheat_block_timestamp_global(150);
        settle_hyperstructure_shares(ref world, 1, 7);
        let mut hyperstructure: Hyperstructure = world.read_model((1_u32, 7_felt252));
        hyperstructure.points_multiplier = 1;
        world.write_model_test(@hyperstructure);
        world
            .write_model_test(
                @HyperstructureShareholders {
                    game_id: 1,
                    hyperstructure_id: 7,
                    start_at: 150,
                    shareholders: array![(13.try_into().unwrap(), 10000)].span(),
                },
            );
        start_cheat_block_timestamp_global(200);
        settle_hyperstructure_shares(ref world, 1, 7);
        let old: PlayerRegisteredPoints = world.read_model((1_u32, starknet::contract_address_const::<12>()));
        let new: PlayerRegisteredPoints = world.read_model((1_u32, starknet::contract_address_const::<13>()));
        assert!(old.registered_points == 75_000_000, "old interval used new multiplier");
        assert!(new.registered_points == 50_000_000, "new owner received earlier points");
    }
}
