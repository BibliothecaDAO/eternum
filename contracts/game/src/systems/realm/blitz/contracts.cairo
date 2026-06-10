use crate::alias::ID;

#[starknet::interface]
pub trait IBlitzRealmSystems<T> {
    fn obtain_entry_token(ref self: T);
    fn settle(
        ref self: T,
        name: felt252,
        entry_token_id: Option<u128>,
        cosmetic_token_ids: Span<u128>,
        grant_starting_troops: bool,
    );
    fn provision_realm(ref self: T, structure_id: ID);
}

#[dojo::contract]
pub mod blitz_realm_systems {
    use core::num::traits::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, blitz_produceable_resources};
    use crate::models::config::{
        BlitzCosmeticAttrsRegister, BlitzEntryTokenRegister, BlitzExplorationConfig, BlitzHypersSettlementConfig,
        BlitzHypersSettlementConfigImpl, BlitzRegistrationConfig, BlitzRegistrationConfigImpl, BlitzSettlement,
        BlitzSettlementConfig, BlitzSettlementConfigImpl, BlitzSettlementPosition, RealmCountConfig, SeasonConfigImpl,
        WorldConfigUtilImpl,
    };
    use crate::models::events::{RealmCreatedStory, Story, StoryEvent};
    use crate::models::name::AddressName;
    use crate::models::owner::OwnerAddressImpl;
    use crate::models::position::{Coord, CoordImpl};
    use crate::models::structure::{
        StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStats, StructureOwnerStoreImpl,
    };
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::systems::prize_distribution::contracts::prize_distribution_systems;
    use crate::systems::realm::utils::contracts::{
        IERC20Dispatcher, IERC20DispatcherTrait, IRealmInternalSystemsDispatcher, IRealmInternalSystemsDispatcherTrait,
    };
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::utils::cartridge::vrf::Source;
    use crate::utils::collectibles::iCollectiblesImpl;
    use crate::utils::interfaces::collectibles::{ICollectibleDispatcher, ICollectibleDispatcherTrait};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct BlitzSettlementEvent {
        #[key]
        player: ContractAddress,
        timestamp: u64,
    }

    ////////////////////////////////////////////////
    // Public Entrypoints
    ////////////////////////////////////////////////

    #[abi(embed_v0)]
    impl BlitzRealmSystemsImpl of super::IBlitzRealmSystems<ContractState> {
        fn obtain_entry_token(ref self: ContractState) {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );
            if blitz_registration_config.fee_amount.is_zero() {
                return;
            }

            let season_config = SeasonConfigImpl::get(world);
            let now = starknet::get_block_timestamp();
            assert!(
                season_config.dev_mode_on || now >= blitz_registration_config.registration_start_at.into(),
                "Eternum: Registration has not started",
            );
            assert!(
                season_config.dev_mode_on || now < season_config.start_main_at, "Eternum: Registration time is over",
            );
            assert!(
                !blitz_registration_config.is_registration_full(), "Eternum: All registration slots have been filled",
            );

            let caller: ContractAddress = starknet::get_caller_address();
            let existing_settlement: BlitzSettlement = world.read_model(caller);
            assert!(existing_settlement.structure_ids.len() == 0, "Eternum: Player is already settled");

            ////////////////////////////////////////////////
            // Mint Entry Token
            ////////////////////////////////////////////////

            BlitzEntryTokenInternalImpl::mint_entry_token(world, caller, blitz_registration_config);
        }

        fn settle(
            ref self: ContractState,
            name: felt252,
            entry_token_id: Option<u128>,
            cosmetic_token_ids: Span<u128>,
            grant_starting_troops: bool,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();
            let season_config = SeasonConfigImpl::get(world);
            let mut blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );
            let mut blitz_settlement_config: BlitzSettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_settlement_config"),
            );
            let blitz_exploration_config: BlitzExplorationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_exploration_config"),
            );

            ////////////////////////////////////////////////
            // Validate Blitz Entry
            ////////////////////////////////////////////////

            assert!(name.is_non_zero(), "Eternum: Name cannot be empty");

            let now = starknet::get_block_timestamp();
            assert!(
                season_config.dev_mode_on || now >= blitz_registration_config.registration_start_at.into(),
                "Eternum: Registration has not started",
            );
            assert!(
                season_config.dev_mode_on || now < season_config.start_main_at, "Eternum: Registration time is over",
            );
            assert!(
                !blitz_registration_config.is_registration_full(), "Eternum: All registration slots have been filled",
            );

            let existing_settlement: BlitzSettlement = world.read_model(caller);
            assert!(existing_settlement.structure_ids.len() == 0, "Eternum: Player is already settled");

            ////////////////////////////////////////////////
            // Validate Hyperstructure Reservations
            ////////////////////////////////////////////////

            BlitzHyperstructureReservationGuardInternalImpl::assert_reservations_complete(
                world, blitz_registration_config, blitz_settlement_config,
            );

            ////////////////////////////////////////////////
            // Prepare Entry Token
            ////////////////////////////////////////////////

            BlitzEntryTokenInternalImpl::resolve_and_consume_entry_token(
                ref world, caller, blitz_registration_config, entry_token_id,
            );

            ////////////////////////////////////////////////
            // Record Registration & Cosmetics
            ////////////////////////////////////////////////

            blitz_registration_config.increase_registration_count();

            BlitzCosmeticsInternalImpl::store_player_cosmetics(
                ref world,
                caller,
                blitz_registration_config.registration_count,
                blitz_registration_config,
                season_config.end_at,
                cosmetic_token_ids,
            );

            ////////////////////////////////////////////////
            // Open Current Settlement Window
            ////////////////////////////////////////////////

            let target_open_settlement_count = BlitzSettlementPoolInternalImpl::target_open_settlement_count(
                blitz_registration_config.registration_count - 1,
                blitz_registration_config.registration_count_max,
                blitz_settlement_config.two_player_mode,
            );
            BlitzSettlementPoolInternalImpl::fill_open_settlement_pool(
                ref world,
                ref blitz_settlement_config,
                blitz_exploration_config.reward_profile_id,
                target_open_settlement_count,
            );

            ////////////////////////////////////////////////
            // Claim Settlement & Create Realms
            ////////////////////////////////////////////////

            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher
                .get_random_number(Source::Nonce(starknet::get_caller_address()), world);
            let settlement_coords = BlitzSettlementPoolInternalImpl::claim_open_settlement(
                ref world, ref blitz_settlement_config, vrf_seed,
            );
            let settlement_structure_ids = BlitzRealmSettlementInternalImpl::create_player_realms(
                ref world, caller, settlement_coords, grant_starting_troops,
            );
            world.write_model(@BlitzSettlement { player: caller, structure_ids: settlement_structure_ids.span() });

            ////////////////////////////////////////////////
            // Persist Config & Finalize Player State
            ////////////////////////////////////////////////

            WorldConfigUtilImpl::set_member(
                ref world, selector!("blitz_registration_config"), blitz_registration_config,
            );
            WorldConfigUtilImpl::set_member(ref world, selector!("blitz_settlement_config"), blitz_settlement_config);

            BlitzRealmSettlementInternalImpl::store_player_name(ref world, caller, name);

            let now = starknet::get_block_timestamp();
            world.emit_event(@BlitzSettlementEvent { player: caller, timestamp: now.into() });
        }

        fn provision_realm(ref self: ContractState, structure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);

            ////////////////////////////////////////////////
            // Provisioning Window
            ////////////////////////////////////////////////

            season_config.assert_started_and_not_over();

            ////////////////////////////////////////////////
            // Validate Realm Ownership
            ////////////////////////////////////////////////

            let structure_owner = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(structure_base.category == StructureCategory::Realm.into(), "structure is not a realm");

            ////////////////////////////////////////////////
            // Provision Realm Economy
            ////////////////////////////////////////////////

            let (realm_internal_systems_address, _) = world.dns(@"realm_internal_systems").unwrap();
            IRealmInternalSystemsDispatcher { contract_address: realm_internal_systems_address }
                .provision_internal(structure_id);
        }
    }

    ////////////////////////////////////////////////
    // Hyperstructure Reservation Guards
    ////////////////////////////////////////////////

    #[generate_trait]
    impl BlitzHyperstructureReservationGuardInternalImpl of BlitzHyperstructureReservationGuardInternalTrait {
        fn assert_reservations_complete(
            world: WorldStorage,
            blitz_registration_config: BlitzRegistrationConfig,
            blitz_settlement_config: BlitzSettlementConfig,
        ) {
            let mut reservation_cursor: BlitzHypersSettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_hypers_settlement_config"),
            );

            reservation_cursor
                .max_ring_count =
                    BlitzHypersSettlementConfigImpl::max_ring_count_for_registration_count(
                        blitz_registration_config.registration_count_max.into(),
                        blitz_settlement_config.two_player_mode,
                    );

            assert!(
                !reservation_cursor.is_valid_ring(blitz_settlement_config.two_player_mode),
                "Eternum: Reserve all hyperstructure tiles before settling realms",
            );
        }
    }

    ////////////////////////////////////////////////
    // Entry Token Helpers
    ////////////////////////////////////////////////

    #[generate_trait]
    impl BlitzEntryTokenInternalImpl of BlitzEntryTokenInternalTrait {
        fn mint_entry_token(
            world: WorldStorage, owner: ContractAddress, blitz_registration_config: BlitzRegistrationConfig,
        ) -> u128 {
            let fee_token_contract: IERC20Dispatcher = IERC20Dispatcher {
                contract_address: blitz_registration_config.fee_token,
            };
            let prize_distribution_systems = prize_distribution_systems::get_dispatcher(@world);
            assert!(
                fee_token_contract
                    .transfer_from(
                        owner, prize_distribution_systems.contract_address, blitz_registration_config.fee_amount,
                    ),
                "Eternum: Fee transfer failed",
            );

            let entry_token_contract = ICollectibleDispatcher {
                contract_address: blitz_registration_config.entry_token_address,
            };
            entry_token_contract.mint(owner, blitz_registration_config.entry_token_attrs_raw());

            let owner_entry_token_balance: u128 = entry_token_contract.balance_of(owner).try_into().unwrap();
            assert!(owner_entry_token_balance.is_non_zero(), "Eternum: Failed to mint entry token");

            entry_token_contract
                .token_of_owner_by_index(owner, (owner_entry_token_balance - 1).into())
                .try_into()
                .unwrap()
        }

        fn resolve_and_consume_entry_token(
            ref world: WorldStorage,
            owner: ContractAddress,
            blitz_registration_config: BlitzRegistrationConfig,
            entry_token_id: Option<u128>,
        ) {
            if blitz_registration_config.fee_amount.is_zero() {
                return;
            }

            let token_id = match entry_token_id {
                Option::Some(token_id) => token_id,
                Option::None => Self::mint_entry_token(world, owner, blitz_registration_config),
            };

            let entry_token_contract = ICollectibleDispatcher {
                contract_address: blitz_registration_config.entry_token_address,
            };
            assert!(
                entry_token_contract.owner_of(token_id.into()) == owner, "Eternum: Entry token is not owned by caller",
            );

            let entry_token_settlement: BlitzEntryTokenRegister = world.read_model(token_id);
            assert!(!entry_token_settlement.registered, "Eternum: Entry token has already been used");

            let expected_lock_id = blitz_registration_config.entry_token_lock_id();
            let (lock_id, _) = entry_token_contract.token_lock_state(token_id.into());
            if lock_id.is_zero() {
                entry_token_contract.token_lock(token_id.into(), expected_lock_id);
            } else {
                assert!(lock_id == expected_lock_id, "Eternum: Entry token locked with wrong lock");
            }

            world.write_model(@BlitzEntryTokenRegister { token_id, registered: true });
        }
    }

    ////////////////////////////////////////////////
    // Cosmetics Helpers
    ////////////////////////////////////////////////

    #[generate_trait]
    impl BlitzCosmeticsInternalImpl of BlitzCosmeticsInternalTrait {
        fn store_player_cosmetics(
            ref world: WorldStorage,
            owner: ContractAddress,
            registration_count: u16,
            blitz_registration_config: BlitzRegistrationConfig,
            season_end_at: u64,
            cosmetic_token_ids: Span<u128>,
        ) {
            let collectibles_cosmetics_address = blitz_registration_config.collectibles_cosmetics_address;
            let collectibles_timelock_address = blitz_registration_config.collectibles_timelock_address;
            if collectibles_cosmetics_address.is_zero() || collectibles_timelock_address.is_zero() {
                return;
            }

            if registration_count == 1 {
                iCollectiblesImpl::create_lock(
                    collectibles_timelock_address, collectibles_cosmetics_address, season_end_at,
                );
            }

            if cosmetic_token_ids.is_empty() {
                return;
            }

            let player_cosmetic_attrs = iCollectiblesImpl::ensure_locked_and_retrieve_attrs(
                collectibles_cosmetics_address,
                owner,
                cosmetic_token_ids,
                season_end_at.into(),
                blitz_registration_config.collectibles_cosmetics_max,
            );

            world.write_model(@BlitzCosmeticAttrsRegister { player: owner, attrs: player_cosmetic_attrs });
        }
    }

    ////////////////////////////////////////////////
    // Settlement Pool Helpers
    ////////////////////////////////////////////////

    #[generate_trait]
    impl BlitzSettlementPoolInternalImpl of BlitzSettlementPoolInternalTrait {
        fn target_open_settlement_count(
            settled_player_count: u16, settlement_count_max: u16, two_player_mode: bool,
        ) -> u16 {
            if settled_player_count >= settlement_count_max {
                return 0;
            }

            let remaining_settlement_count = settlement_count_max - settled_player_count;
            if two_player_mode {
                return remaining_settlement_count;
            }

            let requested_open_settlement_count = if settled_player_count < 3 {
                6
            } else if settled_player_count < 15 {
                9
            } else {
                remaining_settlement_count
            };

            core::cmp::min(requested_open_settlement_count, remaining_settlement_count)
        }

        fn open_next_settlement(
            ref world: WorldStorage,
            ref blitz_settlement_config: BlitzSettlementConfig,
            map_center: Coord,
            reward_profile_id: u8,
        ) {
            let settlement_coords = blitz_settlement_config.generate_coords(map_center, reward_profile_id);
            let settlement_number = blitz_settlement_config.open_settlement_count + 1;

            world.write_model(@BlitzSettlementPosition { settlement_number, coords: settlement_coords.span() });

            blitz_settlement_config.next();
            blitz_settlement_config.open_settlement_count += 1;
        }

        fn fill_open_settlement_pool(
            ref world: WorldStorage,
            ref blitz_settlement_config: BlitzSettlementConfig,
            reward_profile_id: u8,
            target_open_settlement_count: u16,
        ) {
            let map_center = CoordImpl::center(ref world);
            while blitz_settlement_config.open_settlement_count < target_open_settlement_count {
                Self::open_next_settlement(ref world, ref blitz_settlement_config, map_center, reward_profile_id);
            }
        }

        fn claim_open_settlement(
            ref world: WorldStorage, ref blitz_settlement_config: BlitzSettlementConfig, vrf_seed: u256,
        ) -> Span<Coord> {
            let open_settlement_count = blitz_settlement_config.open_settlement_count;
            assert!(open_settlement_count.is_non_zero(), "Eternum: No open settlements available");

            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let settlement_number: u16 = 1
                + rng_library_dispatcher
                    .get_random_in_range(vrf_seed, 98139, open_settlement_count.into())
                    .try_into()
                    .unwrap();

            let open_settlement: BlitzSettlementPosition = world.read_model(settlement_number);
            if settlement_number != open_settlement_count {
                let last_open_settlement: BlitzSettlementPosition = world.read_model(open_settlement_count);
                world.write_model(@BlitzSettlementPosition { settlement_number, coords: last_open_settlement.coords });
            }

            blitz_settlement_config.open_settlement_count -= 1;
            open_settlement.coords
        }
    }

    ////////////////////////////////////////////////
    // Realm Settlement Helpers
    ////////////////////////////////////////////////

    #[generate_trait]
    impl BlitzRealmSettlementInternalImpl of BlitzRealmSettlementInternalTrait {
        fn create_player_realms(
            ref world: WorldStorage,
            owner: ContractAddress,
            settlement_coords: Span<Coord>,
            grant_starting_troops: bool,
        ) -> Array<ID> {
            let realm_count_selector = selector!("realm_count_config");
            let mut realm_count: RealmCountConfig = WorldConfigUtilImpl::get_member(world, realm_count_selector);
            let resources = blitz_produceable_resources();
            let (realm_internal_systems_address, _) = world.dns(@"realm_internal_systems").unwrap();
            let mut remaining_coords = settlement_coords;
            let mut settlement_structure_ids: Array<ID> = array![];

            while remaining_coords.len() > 0 {
                realm_count.count += 1;
                let realm_id = realm_count.count.into();
                let settlement_coord = *remaining_coords.pop_front().unwrap();
                let structure_id = IRealmInternalSystemsDispatcher { contract_address: realm_internal_systems_address }
                    .create_internal(
                        owner, realm_id, resources.clone(), 0, 1, settlement_coord, false, grant_starting_troops,
                    );

                let now = starknet::get_block_timestamp();
                world
                    .emit_event(
                        @StoryEvent {
                            id: world.dispatcher.uuid(),
                            owner: Option::Some(owner),
                            entity_id: Option::Some(structure_id),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::RealmCreatedStory(RealmCreatedStory { coord: settlement_coord }),
                            timestamp: now,
                        },
                    );

                AchievementTrait::progress(world, owner.into(), Tasks::REALM_SETTLEMENT, 1, now.into());

                settlement_structure_ids.append(structure_id);
            }

            WorldConfigUtilImpl::set_member(ref world, realm_count_selector, realm_count);
            settlement_structure_ids
        }

        fn store_player_name(ref world: WorldStorage, owner: ContractAddress, name: felt252) {
            world.write_model(@AddressName { address: owner.into(), name });

            let mut structure_owner_stats: StructureOwnerStats = world.read_model(owner);
            structure_owner_stats.name = name;
            world.write_model(@structure_owner_stats);
        }
    }
}
