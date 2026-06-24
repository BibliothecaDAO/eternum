//! Active movement tests for current packed TileOpt movement flows.

#[cfg(test)]
mod tests {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorageTrait;
    use snforge_std::{
        start_cheat_block_timestamp_global, start_cheat_caller_address, start_cheat_chain_id_global,
        start_cheat_transaction_hash_global, stop_cheat_caller_address, stop_cheat_transaction_hash_global,
    };
    use crate::alias::ID;
    use crate::constants::{RESOURCE_PRECISION, ResourceTypes};
    use crate::models::config::{MapConfig, WorldConfigUtilImpl};
    use crate::models::map::{BiomeDiscovered, Tile, TileTrait};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordTrait, Direction};
    use crate::models::resource::production::production::Production;
    use crate::models::resource::resource::ResourceImpl;
    use crate::models::rng::RNG;
    use crate::models::troop::{ExplorerTroops, TroopTier, TroopType};
    use crate::systems::combat::contracts::troop_management::{
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait,
    };
    use crate::systems::combat::contracts::troop_movement::{
        ITroopMovementSystemsDispatcher, ITroopMovementSystemsDispatcherTrait,
    };
    use crate::utils::map::biomes::get_biome_from_world;
    use crate::utils::testing::helpers::{
        MOCK_MAP_CONFIG, MOCK_TICK_CONFIG, MOCK_TROOP_STAMINA_CONFIG, setup_troop_management_world,
        spawn_guard_test_realm, tgrant_resources,
    };

    fn get_no_treasure_map_config() -> MapConfig {
        let mut config = MOCK_MAP_CONFIG();
        config.shards_mines_win_probability = 0;
        config.shards_mines_fail_probability = 10_000;
        config.hyps_win_prob = 0;
        config.hyps_fail_prob = 10_000;
        config.holysite_win_probability = 0;
        config.holysite_fail_probability = 10_000;
        config.agent_discovery_prob = 0;
        config.agent_discovery_fail_prob = 10_000;
        config.camp_win_probability = 0;
        config.camp_fail_probability = 10_000;
        config.bitcoin_mine_win_probability = 0;
        config.bitcoin_mine_fail_probability = 10_000;
        config
    }

    fn read_tile(ref world: dojo::world::WorldStorage, coord: Coord) -> Tile {
        let tile_opt: TileOpt = world.read_model((coord.alt, coord.x, coord.y));
        tile_opt.into()
    }

    fn setup_no_treasure_explorer() -> (
        dojo::world::WorldStorage,
        starknet::ContractAddress,
        ITroopMovementSystemsDispatcher,
        ID,
        starknet::ContractAddress,
        ID,
        Coord,
        Coord,
        Direction,
    ) {
        let mut world = setup_troop_management_world();
        start_cheat_chain_id_global('SN_TEST');
        WorldConfigUtilImpl::set_member(ref world, selector!("map_config"), get_no_treasure_map_config());

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let troop_amount = 1 * RESOURCE_PRECISION;
        tgrant_resources(
            ref world,
            realm_id,
            array![
                (ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::WHEAT, 100 * RESOURCE_PRECISION),
                (ResourceTypes::FISH, 100 * RESOURCE_PRECISION),
            ]
                .span(),
        );

        let (management_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let management = ITroopManagementSystemsDispatcher { contract_address: management_addr };
        let (movement_addr, _) = world.dns(@"troop_movement_systems").unwrap();
        let movement = ITroopMovementSystemsDispatcher { contract_address: movement_addr };

        let spawn_direction = Direction::NorthEast;
        start_cheat_block_timestamp_global(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        start_cheat_caller_address(management_addr, realm_owner);
        let explorer_id = management
            .explorer_create(realm_id, TroopType::Knight, TroopTier::T1, troop_amount, spawn_direction);
        stop_cheat_caller_address(management_addr);

        let source_coord = realm_coord.neighbor(spawn_direction);
        let target_direction = Direction::East;
        let target_coord = source_coord.neighbor(target_direction);

        (
            world,
            movement_addr,
            movement,
            realm_id,
            realm_owner,
            explorer_id,
            source_coord,
            target_coord,
            target_direction,
        )
    }

    fn run_combined_explore_and_extract(
        movement_addr: starknet::ContractAddress,
        movement: ITroopMovementSystemsDispatcher,
        realm_owner: starknet::ContractAddress,
        explorer_id: ID,
        target_direction: Direction,
    ) {
        start_cheat_caller_address(movement_addr, realm_owner);
        movement.explorer_explore_and_extract(explorer_id, array![target_direction].span());
        stop_cheat_caller_address(movement_addr);
    }

    fn run_legacy_explore_then_extract(
        movement_addr: starknet::ContractAddress,
        movement: ITroopMovementSystemsDispatcher,
        realm_owner: starknet::ContractAddress,
        explorer_id: ID,
        target_direction: Direction,
    ) {
        start_cheat_caller_address(movement_addr, realm_owner);
        movement.explorer_move(explorer_id, array![target_direction].span(), true);
        movement.explorer_extract_reward(explorer_id);
        stop_cheat_caller_address(movement_addr);
    }

    fn assert_explore_position_and_tiles(
        ref world: dojo::world::WorldStorage, explorer_id: ID, source_coord: Coord, target_coord: Coord,
    ) {
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.coord == target_coord, "explorer should end on explored target");

        let source_tile = read_tile(ref world, source_coord);
        assert!(source_tile.occupier_id == 0, "source tile should be empty");

        let target_tile = read_tile(ref world, target_coord);
        assert!(target_tile.discovered(), "target tile should be discovered");
        assert!(target_tile.occupier_id == explorer_id, "target tile should be occupied by explorer");
        assert!(target_tile.reward_extracted, "target reward should be extracted");
    }

    fn assert_explore_without_treasure_result(
        ref world: dojo::world::WorldStorage, realm_id: ID, explorer_id: ID, source_coord: Coord, target_coord: Coord,
    ) {
        assert_explore_position_and_tiles(ref world, explorer_id, source_coord, target_coord);

        let wheat_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::WHEAT);
        assert!(wheat_balance < 100 * RESOURCE_PRECISION, "explore should still burn food");
    }

    fn enable_food_production(ref world: dojo::world::WorldStorage, realm_id: ID, wheat_rate: u64, fish_rate: u64) {
        ResourceImpl::write_production(
            ref world,
            realm_id,
            ResourceTypes::WHEAT,
            Production { building_count: 1, production_rate: wheat_rate, output_amount_left: 0, last_updated_at: 0 },
        );
        ResourceImpl::write_production(
            ref world,
            realm_id,
            ResourceTypes::FISH,
            Production { building_count: 1, production_rate: fish_rate, output_amount_left: 0, last_updated_at: 0 },
        );
    }

    fn assert_food_production_was_harvested_and_burned(
        ref world: dojo::world::WorldStorage, realm_id: ID, wheat_rate: u64, fish_rate: u64,
    ) {
        let now = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        let now_u32: u32 = now.try_into().unwrap();
        let troop_stamina_config = MOCK_TROOP_STAMINA_CONFIG();
        let expected_wheat = 100 * RESOURCE_PRECISION
            + (now.into() * wheat_rate.into())
            - troop_stamina_config.stamina_explore_wheat_cost.into();
        let expected_fish = 100 * RESOURCE_PRECISION
            + (now.into() * fish_rate.into())
            - troop_stamina_config.stamina_explore_fish_cost.into();

        let wheat_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::WHEAT);
        let fish_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::FISH);
        assert!(wheat_balance == expected_wheat, "wheat production should be harvested before burn");
        assert!(fish_balance == expected_fish, "fish production should be harvested before burn");

        let wheat_production = ResourceImpl::read_production(ref world, realm_id, ResourceTypes::WHEAT);
        let fish_production = ResourceImpl::read_production(ref world, realm_id, ResourceTypes::FISH);
        assert!(wheat_production.last_updated_at == now_u32, "wheat production timestamp should update");
        assert!(fish_production.last_updated_at == now_u32, "fish production timestamp should update");
    }

    fn exploration_reward_resource_types() -> Array<u8> {
        array![
            ResourceTypes::WOOD, ResourceTypes::STONE, ResourceTypes::COAL, ResourceTypes::COPPER,
            ResourceTypes::OBSIDIAN, ResourceTypes::SILVER, ResourceTypes::IRONWOOD, ResourceTypes::COLD_IRON,
            ResourceTypes::GOLD, ResourceTypes::HARTWOOD, ResourceTypes::DIAMONDS, ResourceTypes::SAPPHIRE,
            ResourceTypes::RUBY, ResourceTypes::DEEP_CRYSTAL, ResourceTypes::IGNIUM, ResourceTypes::ETHEREAL_SILICA,
            ResourceTypes::TRUE_ICE, ResourceTypes::TWILIGHT_QUARTZ, ResourceTypes::ALCHEMICAL_SILVER,
            ResourceTypes::ADAMANTINE, ResourceTypes::MITHRAL, ResourceTypes::DRAGONHIDE, ResourceTypes::EARTHEN_SHARD,
        ]
    }

    fn assert_reward_balances_match(
        ref legacy_world: dojo::world::WorldStorage,
        legacy_explorer_id: ID,
        ref combined_world: dojo::world::WorldStorage,
        combined_explorer_id: ID,
    ) {
        let mut resource_types = exploration_reward_resource_types();
        let mut legacy_total = 0;
        let mut combined_total = 0;
        loop {
            match resource_types.pop_front() {
                Option::Some(resource_type) => {
                    let legacy_balance = ResourceImpl::read_balance(
                        ref legacy_world, legacy_explorer_id, resource_type,
                    );
                    let combined_balance = ResourceImpl::read_balance(
                        ref combined_world, combined_explorer_id, resource_type,
                    );
                    assert!(legacy_balance == combined_balance, "reward balance should match legacy path");
                    legacy_total += legacy_balance;
                    combined_total += combined_balance;
                },
                Option::None => { break; },
            }
        }

        let expected_total = MOCK_MAP_CONFIG().reward_resource_amount.into() * RESOURCE_PRECISION;
        assert!(legacy_total == expected_total, "legacy reward total should match config");
        assert!(combined_total == expected_total, "combined reward total should match config");
    }

    fn mark_target_biome_discovered(
        ref world: dojo::world::WorldStorage, realm_owner: starknet::ContractAddress, target_coord: Coord,
    ) {
        let biome = get_biome_from_world(world, target_coord.alt, target_coord.x.into(), target_coord.y.into());
        let biome_u8: u8 = biome.into();
        world.write_model(@BiomeDiscovered { by_address: realm_owner, biome: biome_u8, discovered: true });
    }

    #[test]
    fn test_no_treasure_explorer_setup_baseline() {
        let (mut world, _, _, _, _, explorer_id, source_coord, _, _) = setup_no_treasure_explorer();

        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.coord == source_coord, "explorer should start adjacent to realm");
    }

    #[test]
    fn test_legacy_explorer_move_then_extract_without_treasure() {
        let (
            mut world,
            movement_addr,
            movement,
            realm_id,
            realm_owner,
            explorer_id,
            source_coord,
            target_coord,
            target_direction,
        ) =
            setup_no_treasure_explorer();

        run_legacy_explore_then_extract(movement_addr, movement, realm_owner, explorer_id, target_direction);

        assert_explore_without_treasure_result(ref world, realm_id, explorer_id, source_coord, target_coord);
    }

    #[test]
    fn test_explorer_explore_and_extract_marks_target_reward_extracted_without_treasure() {
        let (
            mut world,
            movement_addr,
            movement,
            realm_id,
            realm_owner,
            explorer_id,
            source_coord,
            target_coord,
            target_direction,
        ) =
            setup_no_treasure_explorer();

        run_combined_explore_and_extract(movement_addr, movement, realm_owner, explorer_id, target_direction);

        assert_explore_without_treasure_result(ref world, realm_id, explorer_id, source_coord, target_coord);
    }

    #[test]
    fn test_explorer_explore_and_extract_reuses_discovered_biome_without_changing_outcome() {
        let (
            mut world,
            movement_addr,
            movement,
            realm_id,
            realm_owner,
            explorer_id,
            source_coord,
            target_coord,
            target_direction,
        ) =
            setup_no_treasure_explorer();

        mark_target_biome_discovered(ref world, realm_owner, target_coord);

        run_combined_explore_and_extract(movement_addr, movement, realm_owner, explorer_id, target_direction);

        assert_explore_without_treasure_result(ref world, realm_id, explorer_id, source_coord, target_coord);
    }

    #[test]
    fn test_explorer_explore_and_extract_grants_same_reward_as_legacy_extract() {
        let (
            mut legacy_world,
            legacy_movement_addr,
            legacy_movement,
            _legacy_realm_id,
            legacy_realm_owner,
            legacy_explorer_id,
            _legacy_source_coord,
            _legacy_target_coord,
            legacy_target_direction,
        ) =
            setup_no_treasure_explorer();
        let reward_tx_hash = 0x4558504c4f52455f5245574152445f4d41544348;
        start_cheat_transaction_hash_global(reward_tx_hash);
        run_legacy_explore_then_extract(
            legacy_movement_addr, legacy_movement, legacy_realm_owner, legacy_explorer_id, legacy_target_direction,
        );
        stop_cheat_transaction_hash_global();

        let (
            mut combined_world,
            combined_movement_addr,
            combined_movement,
            _combined_realm_id,
            combined_realm_owner,
            combined_explorer_id,
            _combined_source_coord,
            _combined_target_coord,
            combined_target_direction,
        ) =
            setup_no_treasure_explorer();
        start_cheat_transaction_hash_global(reward_tx_hash);
        run_combined_explore_and_extract(
            combined_movement_addr,
            combined_movement,
            combined_realm_owner,
            combined_explorer_id,
            combined_target_direction,
        );
        stop_cheat_transaction_hash_global();

        assert_reward_balances_match(ref legacy_world, legacy_explorer_id, ref combined_world, combined_explorer_id);
    }

    #[test]
    fn test_explorer_explore_and_extract_stores_same_final_rng_seed_as_legacy_path() {
        let (
            mut legacy_world,
            legacy_movement_addr,
            legacy_movement,
            _realm_id,
            legacy_realm_owner,
            legacy_explorer_id,
            _source_coord,
            _target_coord,
            legacy_target_direction,
        ) =
            setup_no_treasure_explorer();

        let explore_tx_hash = 0x4558504c4f52455f54585f48415348;
        start_cheat_transaction_hash_global(explore_tx_hash);
        run_legacy_explore_then_extract(
            legacy_movement_addr, legacy_movement, legacy_realm_owner, legacy_explorer_id, legacy_target_direction,
        );
        stop_cheat_transaction_hash_global();

        let (
            mut combined_world,
            combined_movement_addr,
            combined_movement,
            _combined_realm_id,
            combined_realm_owner,
            combined_explorer_id,
            _combined_source_coord,
            _combined_target_coord,
            combined_target_direction,
        ) =
            setup_no_treasure_explorer();

        start_cheat_transaction_hash_global(explore_tx_hash);
        run_combined_explore_and_extract(
            combined_movement_addr,
            combined_movement,
            combined_realm_owner,
            combined_explorer_id,
            combined_target_direction,
        );
        stop_cheat_transaction_hash_global();

        let legacy_rng: RNG = legacy_world.read_model(explore_tx_hash);
        let combined_rng: RNG = combined_world.read_model(explore_tx_hash);
        assert!(combined_rng.seed == legacy_rng.seed, "combined explore rng seed should match legacy path");
    }

    #[test]
    fn test_explorer_explore_and_extract_advances_seeded_rng_like_legacy_path() {
        let (
            mut legacy_world,
            legacy_movement_addr,
            legacy_movement,
            _legacy_realm_id,
            legacy_realm_owner,
            legacy_explorer_id,
            _legacy_source_coord,
            _legacy_target_coord,
            legacy_target_direction,
        ) =
            setup_no_treasure_explorer();

        let explore_tx_hash = 0x5345454445445f4558504c4f52455f54585f48415348;
        let seeded_rng = 987654321;
        legacy_world.write_model(@RNG { tx_hash: explore_tx_hash, seed: seeded_rng });

        start_cheat_transaction_hash_global(explore_tx_hash);
        run_legacy_explore_then_extract(
            legacy_movement_addr, legacy_movement, legacy_realm_owner, legacy_explorer_id, legacy_target_direction,
        );
        stop_cheat_transaction_hash_global();

        let (
            mut combined_world,
            combined_movement_addr,
            combined_movement,
            combined_realm_id,
            combined_realm_owner,
            combined_explorer_id,
            combined_source_coord,
            combined_target_coord,
            combined_target_direction,
        ) =
            setup_no_treasure_explorer();
        combined_world.write_model(@RNG { tx_hash: explore_tx_hash, seed: seeded_rng });

        start_cheat_transaction_hash_global(explore_tx_hash);
        run_combined_explore_and_extract(
            combined_movement_addr,
            combined_movement,
            combined_realm_owner,
            combined_explorer_id,
            combined_target_direction,
        );
        stop_cheat_transaction_hash_global();

        assert_explore_without_treasure_result(
            ref combined_world, combined_realm_id, combined_explorer_id, combined_source_coord, combined_target_coord,
        );

        let legacy_rng: RNG = legacy_world.read_model(explore_tx_hash);
        let combined_rng: RNG = combined_world.read_model(explore_tx_hash);
        assert!(combined_rng.seed == legacy_rng.seed, "combined seeded rng should match legacy path");
    }

    #[test]
    fn test_explorer_explore_and_extract_advances_seeded_rng_like_legacy_path_with_reused_biome() {
        let (
            mut legacy_world,
            legacy_movement_addr,
            legacy_movement,
            _legacy_realm_id,
            legacy_realm_owner,
            legacy_explorer_id,
            _legacy_source_coord,
            legacy_target_coord,
            legacy_target_direction,
        ) =
            setup_no_treasure_explorer();

        let explore_tx_hash = 0x5345454445445f52455045415445445f4558504c4f5245;
        let seeded_rng = 987654321;
        legacy_world.write_model(@RNG { tx_hash: explore_tx_hash, seed: seeded_rng });
        mark_target_biome_discovered(ref legacy_world, legacy_realm_owner, legacy_target_coord);

        start_cheat_transaction_hash_global(explore_tx_hash);
        run_legacy_explore_then_extract(
            legacy_movement_addr, legacy_movement, legacy_realm_owner, legacy_explorer_id, legacy_target_direction,
        );
        stop_cheat_transaction_hash_global();

        let (
            mut combined_world,
            combined_movement_addr,
            combined_movement,
            combined_realm_id,
            combined_realm_owner,
            combined_explorer_id,
            combined_source_coord,
            combined_target_coord,
            combined_target_direction,
        ) =
            setup_no_treasure_explorer();
        combined_world.write_model(@RNG { tx_hash: explore_tx_hash, seed: seeded_rng });
        mark_target_biome_discovered(ref combined_world, combined_realm_owner, combined_target_coord);

        start_cheat_transaction_hash_global(explore_tx_hash);
        run_combined_explore_and_extract(
            combined_movement_addr,
            combined_movement,
            combined_realm_owner,
            combined_explorer_id,
            combined_target_direction,
        );
        stop_cheat_transaction_hash_global();

        assert_explore_without_treasure_result(
            ref combined_world, combined_realm_id, combined_explorer_id, combined_source_coord, combined_target_coord,
        );

        let legacy_rng: RNG = legacy_world.read_model(explore_tx_hash);
        let combined_rng: RNG = combined_world.read_model(explore_tx_hash);
        assert!(combined_rng.seed == legacy_rng.seed, "combined reused-biome rng should match legacy path");
    }

    #[test]
    fn test_explorer_explore_and_extract_burns_single_step_explore_stamina() {
        let (
            mut world,
            movement_addr,
            movement,
            _realm_id,
            realm_owner,
            explorer_id,
            _source_coord,
            _target_coord,
            target_direction,
        ) =
            setup_no_treasure_explorer();

        run_combined_explore_and_extract(movement_addr, movement, realm_owner, explorer_id, target_direction);

        let explorer: ExplorerTroops = world.read_model(explorer_id);
        let expected_stamina = MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into()
            - MOCK_TROOP_STAMINA_CONFIG().stamina_explore_stamina_cost.into();
        assert!(explorer.troops.stamina.amount == expected_stamina, "single explore should burn one stamina step");
    }

    #[test]
    fn test_explorer_explore_and_extract_harvests_active_food_production_before_burn() {
        let (
            mut world,
            movement_addr,
            movement,
            realm_id,
            realm_owner,
            explorer_id,
            source_coord,
            target_coord,
            target_direction,
        ) =
            setup_no_treasure_explorer();

        let wheat_rate = 10;
        let fish_rate = 7;
        enable_food_production(ref world, realm_id, wheat_rate, fish_rate);

        run_combined_explore_and_extract(movement_addr, movement, realm_owner, explorer_id, target_direction);

        assert_explore_position_and_tiles(ref world, explorer_id, source_coord, target_coord);
        assert_food_production_was_harvested_and_burned(ref world, realm_id, wheat_rate, fish_rate);
    }
}
