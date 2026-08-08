#[cfg(test)]
mod two_games {
    use core::num::traits::zero::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo_snf_test::{NamespaceDef, TestResource, spawn_test_world};
    use starknet::ContractAddress;
    use crate::constants::DEFAULT_NS_STR;
    use crate::models::agent::{AgentConfig, AgentCount};
    use crate::models::config::{BlitzEntryTokenRegister, BlitzSettlement};
    use crate::models::game::{GameRegistry, GameRegistryImpl, GameStatus};
    use crate::models::guild::{GuildMember, GuildWhitelist};
    use crate::models::hyperstructure::PlayerRegisteredPoints;
    use crate::models::map::{Tile, TileImpl};
    use crate::models::map2::TileOpt;
    use crate::models::mmr::{MMRClaimed, MMRGameMeta};
    use crate::models::position::Coord;
    use crate::models::rank::PlayerRank;
    use crate::models::resource::resource::ResourceAllowance;
    use crate::models::series_chest_reward::GameChestReward;
    use crate::models::structure::StructureOwnerStats;

    const GAME_A: u32 = 1;
    const GAME_B: u32 = 2;

    fn addr(value: felt252) -> ContractAddress {
        value.try_into().unwrap()
    }

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("GameRegistry"), TestResource::Model("TileOpt"), TestResource::Model("AgentCount"),
                TestResource::Model("PlayerRank"), TestResource::Model("MMRGameMeta"),
                TestResource::Model("MMRClaimed"), TestResource::Model("GuildMember"),
                TestResource::Model("GuildWhitelist"), TestResource::Model("StructureOwnerStats"),
                TestResource::Model("AgentConfig"), TestResource::Model("BlitzSettlement"),
                TestResource::Model("BlitzEntryTokenRegister"), TestResource::Model("PlayerRegisteredPoints"),
                TestResource::Model("ResourceAllowance"), TestResource::Model("GameChestReward"),
            ]
                .span(),
        }
    }

    fn game(game_id: u32, seed: felt252) -> GameRegistry {
        GameRegistry {
            game_id,
            name: if game_id == GAME_A {
                'game_a'
            } else {
                'game_b'
            },
            series_id: 'series',
            game_number_in_series: game_id.try_into().unwrap(),
            preset_id: 1,
            creator: addr('creator'),
            status: GameStatus::Live,
            dev_mode_on: false,
            start_settling_at: 100,
            start_main_at: 200,
            end_at: if game_id == GAME_A {
                1000
            } else {
                1200
            },
            end_grace_seconds: 60,
            registration_grace_seconds: 60,
            final_trial_id: 0,
            seed,
            fees_collected: 100,
            fees_paid_out: 0,
        }
    }

    #[test]
    fn two_concurrent_games_keep_overlapping_state_isolated() {
        let mut world = spawn_test_world([namespace_def()].span());
        world.write_model_test(@game(GAME_A, 111));
        world.write_model_test(@game(GAME_B, 222));

        let player = addr('player');
        let guild = addr('guild');
        let coord = Coord { alt: false, x: 42, y: 42 };

        let mut tile_a = TileImpl::keys_only(GAME_A, coord);
        tile_a.biome = 3;
        let mut tile_b = TileImpl::keys_only(GAME_B, coord);
        tile_b.biome = 7;
        let tile_opt_a: TileOpt = tile_a.into();
        let tile_opt_b: TileOpt = tile_b.into();
        world.write_model_test(@tile_opt_a);
        world.write_model_test(@tile_opt_b);

        world.write_model_test(@AgentCount { game_id: GAME_A, count: 4 });
        world.write_model_test(@AgentCount { game_id: GAME_B, count: 9 });
        world
            .write_model_test(
                @AgentConfig {
                    game_id: GAME_A,
                    max_lifetime_count: 10,
                    max_current_count: 4,
                    min_spawn_lords_amount: 1,
                    max_spawn_lords_amount: 2,
                },
            );
        world
            .write_model_test(
                @AgentConfig {
                    game_id: GAME_B,
                    max_lifetime_count: 20,
                    max_current_count: 8,
                    min_spawn_lords_amount: 2,
                    max_spawn_lords_amount: 4,
                },
            );
        world.write_model_test(@BlitzSettlement { game_id: GAME_A, player, structure_ids: array![11].span() });
        world.write_model_test(@BlitzSettlement { game_id: GAME_B, player, structure_ids: array![22].span() });
        world
            .write_model_test(
                @BlitzEntryTokenRegister { game_id: GAME_A, token_id: 7, issued: true, registered: true },
            );
        world
            .write_model_test(
                @ResourceAllowance {
                    game_id: GAME_A, owner_entity_id: 1, approved_entity_id: 2, resource_type: 3, amount: 50,
                },
            );
        world
            .write_model_test(
                @ResourceAllowance {
                    game_id: GAME_B, owner_entity_id: 1, approved_entity_id: 2, resource_type: 3, amount: 75,
                },
            );
        world
            .write_model_test(
                @PlayerRegisteredPoints {
                    game_id: GAME_A, address: player, registered_points: 500, prize_claimed: true,
                },
            );
        world
            .write_model_test(
                @PlayerRegisteredPoints {
                    game_id: GAME_B, address: player, registered_points: 900, prize_claimed: false,
                },
            );
        world.write_model_test(@GameChestReward { game_id: GAME_A, allocated_chests: 5, distributed_chests: 2 });
        world.write_model_test(@GameChestReward { game_id: GAME_B, allocated_chests: 8, distributed_chests: 0 });
        world.write_model_test(@PlayerRank { game_id: GAME_A, player, rank: 1, paid: true });
        world.write_model_test(@PlayerRank { game_id: GAME_B, player, rank: 5, paid: false });
        world.write_model_test(@MMRGameMeta { game_id: GAME_A, game_median: 900 });
        world.write_model_test(@MMRGameMeta { game_id: GAME_B, game_median: 1200 });
        world.write_model_test(@MMRClaimed { game_id: GAME_A, claimed_at: 500 });
        world.write_model_test(@GuildMember { game_id: GAME_A, member: player, guild_id: guild });
        world
            .write_model_test(@GuildWhitelist { game_id: GAME_B, guild_id: guild, address: player, whitelisted: true });
        world.write_model_test(@StructureOwnerStats { game_id: GAME_A, owner: player, structures_num: 2 });
        world.write_model_test(@StructureOwnerStats { game_id: GAME_B, owner: player, structures_num: 6 });

        let stored_tile_opt_a: TileOpt = world.read_model((GAME_A, coord.alt, coord.x, coord.y));
        let stored_tile_opt_b: TileOpt = world.read_model((GAME_B, coord.alt, coord.x, coord.y));
        let stored_tile_a: Tile = stored_tile_opt_a.into();
        let stored_tile_b: Tile = stored_tile_opt_b.into();
        let agents_a: AgentCount = world.read_model(GAME_A);
        let agents_b: AgentCount = world.read_model(GAME_B);
        let agent_config_a: AgentConfig = world.read_model(GAME_A);
        let agent_config_b: AgentConfig = world.read_model(GAME_B);
        let settlement_a: BlitzSettlement = world.read_model((GAME_A, player));
        let settlement_b: BlitzSettlement = world.read_model((GAME_B, player));
        let entry_token_a: BlitzEntryTokenRegister = world.read_model((GAME_A, 7));
        let entry_token_b: BlitzEntryTokenRegister = world.read_model((GAME_B, 7));
        let allowance_a: ResourceAllowance = world.read_model((GAME_A, 1, 2, 3));
        let allowance_b: ResourceAllowance = world.read_model((GAME_B, 1, 2, 3));
        let points_a: PlayerRegisteredPoints = world.read_model((GAME_A, player));
        let points_b: PlayerRegisteredPoints = world.read_model((GAME_B, player));
        let chests_a: GameChestReward = world.read_model(GAME_A);
        let chests_b: GameChestReward = world.read_model(GAME_B);
        let rank_a: PlayerRank = world.read_model((GAME_A, player));
        let rank_b: PlayerRank = world.read_model((GAME_B, player));
        let mmr_a: MMRGameMeta = world.read_model(GAME_A);
        let mmr_b: MMRGameMeta = world.read_model(GAME_B);
        let claim_b: MMRClaimed = world.read_model(GAME_B);
        let stats_a: StructureOwnerStats = world.read_model((GAME_A, player));
        let stats_b: StructureOwnerStats = world.read_model((GAME_B, player));

        assert!(stored_tile_a.biome == 3, "game A tile changed");
        assert!(stored_tile_b.biome == 7, "game B tile changed");
        assert!(agents_a.count == 4 && agents_b.count == 9, "agent counters crossed games");
        assert!(agent_config_a.max_current_count == 4, "game A agent cap changed");
        assert!(agent_config_b.max_current_count == 8, "game B agent cap changed");
        assert!(*settlement_a.structure_ids.at(0) == 11, "game A settlement changed");
        assert!(*settlement_b.structure_ids.at(0) == 22, "game B settlement changed");
        assert!(entry_token_a.registered && !entry_token_b.issued, "entry token binding crossed games");
        assert!(allowance_a.amount == 50 && allowance_b.amount == 75, "resource allowances crossed games");
        assert!(points_a.registered_points == 500 && points_a.prize_claimed, "game A points changed");
        assert!(points_b.registered_points == 900 && !points_b.prize_claimed, "game B points changed");
        assert!(chests_a.distributed_chests == 2 && chests_b.distributed_chests == 0, "chests crossed games");
        assert!(rank_a.rank == 1 && rank_a.paid, "game A rank changed");
        assert!(rank_b.rank == 5 && !rank_b.paid, "game B rank changed");
        assert!(mmr_a.game_median == 900 && mmr_b.game_median == 1200, "MMR metadata crossed games");
        assert!(claim_b.claimed_at.is_zero(), "game A MMR claim marked game B");
        assert!(stats_a.structures_num == 2 && stats_b.structures_num == 6, "owner stats crossed games");
        assert!(tile_a.to_seed(111) != tile_b.to_seed(222), "game-scoped VRF salts collided");
        assert!(
            GameRegistryImpl::get(world, GAME_A).end_at != GameRegistryImpl::get(world, GAME_B).end_at,
            "clocks collided",
        );

        let mut ended_a = GameRegistryImpl::get(world, GAME_A);
        ended_a.status = GameStatus::Ended;
        world.write_model_test(@ended_a);
        let live_b = GameRegistryImpl::get(world, GAME_B);
        assert!(live_b.status == GameStatus::Live, "ending game A ended game B");

        GameRegistryImpl::debit_fees(ref world, GAME_A, 40);
        assert!(GameRegistryImpl::available_fees(world, GAME_A) == 60, "game A escrow debit failed");
        assert!(GameRegistryImpl::available_fees(world, GAME_B) == 100, "game A debited game B escrow");
    }

    #[test]
    #[should_panic(expected: "Eternum: entities belong to different games")]
    fn mixed_game_entities_are_rejected() {
        GameRegistryImpl::assert_same_game(GAME_A, GAME_B);
    }
}
