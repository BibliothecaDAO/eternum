use crate::alias::ID;

#[starknet::interface]
pub trait IRealmSystems<T> {
    fn settle(ref self: T, game_id: u32, name: felt252) -> ID;
    fn settle_dev(ref self: T, game_id: u32, name: felt252, realm_id: u32) -> ID;
}

#[dojo::contract]
pub mod realm_systems {
    use core::num::traits::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        BlitzExplorationConfig, BlitzSettlement, BlitzSettlementConfig, RealmCountConfig, SeasonConfigImpl,
        WorldConfigUtilImpl,
    };
    use crate::models::events::{RealmCreatedStory, Story, StoryEvent};
    use crate::models::ledger::{LedgerRegistrationImpl, PlayerSettlement, PlayerSettlementImpl};
    use crate::models::map::{Tile, TileImpl};
    use crate::models::map2::TileOpt;
    use crate::models::name::AddressName;
    use crate::models::position::Coord;
    use crate::models::realm::RealmNameAndAttrsDecodingImpl;
    use crate::models::realm_allocation::RealmAllocationImpl;
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::systems::realm::utils::contracts::{
        IRealmInternalSystemsDispatcher, IRealmInternalSystemsDispatcherTrait,
    };
    use crate::systems::utils::realm_metadata::realm_attributes;
    use crate::systems::utils::settlement::SettlementPoolImpl;
    use crate::utils::cartridge::vrf::Source;

    #[abi(embed_v0)]
    impl RealmSystemsImpl of super::IRealmSystems<ContractState> {
        fn settle(ref self: ContractState, game_id: u32, name: felt252) -> ID {
            let mut world = self.world(DEFAULT_NS());
            settle_realm(ref world, game_id, name, Option::None)
        }

        fn settle_dev(ref self: ContractState, game_id: u32, name: felt252, realm_id: u32) -> ID {
            let mut world = self.world(DEFAULT_NS());
            assert!(SeasonConfigImpl::get(world, game_id).dev_mode_on, "Eternum: dev mode required");
            settle_realm(ref world, game_id, name, Option::Some(realm_id))
        }
    }

    fn settle_realm(ref world: WorldStorage, game_id: u32, name: felt252, selected_realm_id: Option<u32>) -> ID {
        SeasonConfigImpl::get(world, game_id).assert_settling_started_and_not_over();
        let blitz: bool = WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"));
        assert!(!blitz, "Eternum: Not Season Game Mode");
        assert!(name.is_non_zero(), "Eternum: Name cannot be empty");
        let player = starknet::get_caller_address();
        let owner = if selected_realm_id.is_some() {
            PlayerSettlementImpl::owner(world, player)
        } else {
            PlayerSettlementImpl::reserve(ref world, game_id, player)
        };
        let mut count: RealmCountConfig = WorldConfigUtilImpl::get_member(
            world, game_id, selector!("realm_count_config"),
        );
        let seed = rng_library::get_dispatcher(@world).get_random_number(game_id, Source::Nonce(player), world);
        let (realm_id, wonder, order, resources) = match selected_realm_id {
            Option::Some(realm_id) => {
                let (wonder, order, resources) = realm_attributes(realm_id);
                (realm_id, wonder, order, resources)
            },
            Option::None => resolve_realm_attributes(world, game_id, player, seed),
        };
        RealmAllocationImpl::reserve(ref world, game_id, realm_id, player);
        let coord = claim_settlement(ref world, game_id, count.count, seed);
        let structure_id = create_and_provision_realm(
            ref world, game_id, player, realm_id, resources, order, wonder, coord,
        );
        count.count += 1;
        WorldConfigUtilImpl::set_member(ref world, game_id, selector!("realm_count_config"), count);
        world.write_model(@PlayerSettlement { game_id, owner, player, structure_id });
        let previous: BlitzSettlement = world.read_model((game_id, player));
        let mut structure_ids: Array<ID> = array![];
        for id in previous.structure_ids {
            structure_ids.append(*id);
        }
        structure_ids.append(structure_id);
        world.write_model(@BlitzSettlement { game_id, player, structure_ids: structure_ids.span() });
        world.write_model(@AddressName { address: player.into(), name });
        emit_settlement(ref world, game_id, player, structure_id, coord);
        structure_id
    }

    fn resolve_realm_attributes(
        world: WorldStorage, game_id: u32, player: ContractAddress, seed: u256,
    ) -> (ID, u8, u8, Array<u8>) {
        if !LedgerRegistrationImpl::entry_requires_ledger(world) {
            let remaining = RealmAllocationImpl::remaining(world, game_id);
            assert!(remaining > 0, "Eternum: all canonical realms allocated");
            let index = rng_library::get_dispatcher(@world)
                .get_random_in_range(seed, 71419, remaining.into())
                .try_into()
                .unwrap();
            let realm_id = RealmAllocationImpl::at(world, game_id, index);
            let (wonder, order, resources) = realm_attributes(realm_id);
            return (realm_id, wonder, order, resources);
        }
        let registration = LedgerRegistrationImpl::for_season_account(world, game_id, player);
        let (metadata, _, _) = registration.metadata;
        let (_, _, _, _, _, wonder, order, resources) = RealmNameAndAttrsDecodingImpl::decode(metadata);
        assert!(!resources.is_empty(), "Eternum: realm has no production traits");
        assert!(order >= 1 && order <= 16, "Eternum: invalid realm Order");
        (registration.realm_id.try_into().expect('realm id exceeds u32'), wonder, order, resources)
    }

    fn claim_settlement(ref world: WorldStorage, game_id: u32, settled_count: u16, seed: u256) -> Coord {
        let mut config: BlitzSettlementConfig = WorldConfigUtilImpl::get_member(
            world, game_id, selector!("blitz_settlement_config"),
        );
        assert!(config.single_realm_mode && !config.two_player_mode, "Eternum: season settlement requires one realm");
        let exploration: BlitzExplorationConfig = WorldConfigUtilImpl::get_member(
            world, game_id, selector!("blitz_exploration_config"),
        );
        let target = SettlementPoolImpl::target_open_settlement_count(settled_count, 0xffff, false);
        // Open entry continues while armies explore. Discard positions occupied since the pool was filled.
        for _ in 0..64_u32 {
            SettlementPoolImpl::fill_open_settlement_pool(
                ref world, game_id, ref config, exploration.reward_profile_id, target,
            );
            let coords = SettlementPoolImpl::claim_open_settlement(ref world, game_id, ref config, seed);
            assert!(coords.len() == 1, "Eternum: invalid season settlement pool");
            let coord = *coords.at(0);
            let tile: TileOpt = world.read_model((game_id, coord.alt, coord.x, coord.y));
            let tile: Tile = tile.into();
            if tile.not_occupied() {
                WorldConfigUtilImpl::set_member(ref world, game_id, selector!("blitz_settlement_config"), config);
                return coord;
            }
        }
        panic!("Eternum: no vacant settlement in search limit");
    }

    fn create_and_provision_realm(
        ref world: WorldStorage,
        game_id: u32,
        player: ContractAddress,
        realm_id: ID,
        resources: Array<u8>,
        order: u8,
        wonder: u8,
        coord: Coord,
    ) -> ID {
        let (address, _) = world.dns(@"realm_internal_systems").unwrap();
        let realms = IRealmInternalSystemsDispatcher { contract_address: address };
        let structure_id = realms
            .create_internal(game_id, player, realm_id, resources, order, wonder, coord, true, true);
        realms.provision_internal(game_id, structure_id);
        structure_id
    }

    fn emit_settlement(ref world: WorldStorage, game_id: u32, player: ContractAddress, structure_id: ID, coord: Coord) {
        let now = starknet::get_block_timestamp();
        world
            .emit_event(
                @StoryEvent {
                    game_id,
                    id: world.dispatcher.uuid(),
                    owner: Option::Some(player),
                    entity_id: Option::Some(structure_id),
                    tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                    story: Story::RealmCreatedStory(RealmCreatedStory { coord }),
                    timestamp: now,
                },
            );
    }
}
