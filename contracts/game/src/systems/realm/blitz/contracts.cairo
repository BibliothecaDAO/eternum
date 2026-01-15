use crate::alias::ID;

#[starknet::interface]
pub trait IBlitzRealmSystems<T> {
    fn list_registered_players(self: @T) -> Array<starknet::ContractAddress>;

    fn obtain_entry_token(ref self: T);
    fn register(ref self: T, name: felt252, entry_token_id: u128, cosmetic_token_ids: Span<u128>);
    fn make_hyperstructures(ref self: T, count: u8);
    fn assign_realm_positions(ref self: T);
    fn settle_realms(ref self: T, settlement_count: u8) -> Array<ID>;
}

#[dojo::contract]
pub mod blitz_realm_systems {
    use core::num::traits::{Bounded, Zero};
    use starknet::ContractAddress;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use crate::alias::ID;
    
    use crate::constants::{DEFAULT_NS, ResourceTypes, blitz_produceable_resources};
    use crate::models::config::{
        BlitzHypersSettlementConfig, BlitzHypersSettlementConfigImpl, BlitzRealmPlayerRegister, BlitzEntryTokenRegister,
        BlitzRealmPositionRegister, BlitzRegistrationConfig, BlitzRegistrationConfigImpl, BlitzSettlementConfig,
        BlitzSettlementConfigImpl, MapConfig, RealmCountConfig, SeasonConfigImpl, TroopLimitConfig, TroopStaminaConfig,
        WorldConfigUtilImpl, BlitzCosmeticAttrsRegister, BlitzRealmSettleFinish, BlitzPlayerRegisterList
    };
    use crate::models::events::{RealmCreatedStory, Story, StoryEvent};
    use crate::models::map::TileImpl;
    use crate::models::name::AddressName;
    use crate::models::position::{Coord, CoordImpl};
    use crate::models::realm::{RealmNameAndAttrsDecodingImpl, RealmReferenceImpl};
    use crate::models::resource::production::building::BuildingImpl;
    use crate::models::resource::production::production::{Production, ProductionImpl};
    use crate::models::resource::resource::{
        ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{
        StructureBaseStoreImpl, StructureImpl, StructureMetadataStoreImpl, StructureOwnerStats, StructureOwnerStoreImpl,
        StructureReservation,
    };
    use crate::systems::realm::utils::contracts::{
        IERC20Dispatcher, IERC20DispatcherTrait, IRealmInternalSystemsDispatcher, IRealmInternalSystemsDispatcherTrait,
    };
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::realm::iRealmImpl;
    use crate::systems::utils::structure::iStructureImpl;
    use crate::utils::collectibles::iCollectiblesImpl;
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::systems::prize_distribution::contracts::prize_distribution_systems;
    use crate::utils::interfaces::collectibles::{ICollectibleDispatcher, ICollectibleDispatcherTrait};
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct BlitzRegistrationEvent {
        #[key]
        player: ContractAddress,
        timestamp: u64,
    }

    #[abi(embed_v0)]
    impl BlitzRealmSystemsImpl of super::IBlitzRealmSystems<ContractState> {

        fn list_registered_players(self: @ContractState) -> Array<ContractAddress> {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let blitz_registration_config: BlitzRegistrationConfig 
                = WorldConfigUtilImpl::get_member(world, selector!("blitz_registration_config"));

            let mut end: u16 = blitz_registration_config.registration_count;
            let mut players: Array<ContractAddress> = array![];
            while end.is_non_zero() {
                let register: BlitzPlayerRegisterList = world.read_model(end);
                players.append(register.player);
                end -= 1;
            }
            players
        }

        fn obtain_entry_token(ref self: ContractState) {

            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut blitz_registration_config: BlitzRegistrationConfig 
                = WorldConfigUtilImpl::get_member(world, selector!("blitz_registration_config"));

            if blitz_registration_config.fee_amount.is_non_zero() {
                // collect registration erc20 fee
                let caller: ContractAddress = starknet::get_caller_address();
                let fee_token_contract: IERC20Dispatcher = IERC20Dispatcher {
                    contract_address: blitz_registration_config.fee_token,
                };

                // transfer the fee to the prize distribution systems contract
                let prize_distribution_systems = prize_distribution_systems::get_dispatcher(@world);
                assert!(
                    fee_token_contract.transfer_from(
                        caller, 
                        prize_distribution_systems.contract_address, 
                        blitz_registration_config.fee_amount
                    )
                , "Eternum: Fee transfer failed");


                // mint entry erc721 token
                let entry_token_contract = ICollectibleDispatcher {
                    contract_address: blitz_registration_config.entry_token_address,
                };
                entry_token_contract.mint(caller, blitz_registration_config.entry_token_attrs_raw());

                // Security note: this means we don't allow burning of entry tokens
                //
                // ensure the new supply is not greater than registration_count_max
                assert!(
                    entry_token_contract.total_supply() 
                    <= blitz_registration_config.registration_count_max.into()
                , "Eternum: All entry tokens have been minted");
            }
        }


        // Register for the game and pay the registration fee
        // Owner is the address that is going to own the realm
        fn register(ref self: ContractState, name: felt252, entry_token_id: u128, cosmetic_token_ids: Span<u128>) {

            // todo ensure owner is a cartridge controller address
            assert!(name.is_non_zero(), "Eternum: Name cannot be empty");

            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_settling_started_and_not_over();

            let mut blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );

            // ensure that registration is still open
            let now: u32 = starknet::get_block_timestamp().try_into().unwrap();
            assert!(blitz_registration_config.is_registration_open(now), "Eternum: Registration time is over");

            // ensure that there is still space for registration
            assert!(
                !blitz_registration_config.is_registration_full(), "Eternum: All registration slots have been filled",
            );
            blitz_registration_config.increase_registration_count();


            world.write_model(
                @BlitzPlayerRegisterList {
                    count: blitz_registration_config.registration_count,
                    player: starknet::get_caller_address(),
            });

            // if there is a required fee amount, ensure token is locked  
            if blitz_registration_config.fee_amount.is_non_zero() {

                let entry_token_contract = ICollectibleDispatcher {
                    contract_address: blitz_registration_config.entry_token_address,
                };
                let (lock_id, _) = entry_token_contract.token_lock_state(entry_token_id.into());
                assert!(
                    lock_id.is_non_zero() 
                    && lock_id == blitz_registration_config.entry_token_lock_id(),
                    "Eternum: Entry token is not locked",
                );

                // ensure token cant be reused
                let entry_token_register: BlitzEntryTokenRegister = world.read_model(entry_token_id);
                assert!(!entry_token_register.registered, "Eternum: Entry token has already been used");
                world.write_model(@BlitzEntryTokenRegister { token_id: entry_token_id, registered: true } );
            }

            // ensure that the player is not already registered
            let owner = starknet::get_caller_address();
            let mut blitz_player_register: BlitzRealmPlayerRegister = world.read_model(owner);
            assert!(!blitz_player_register.registered, "Eternum: Player is already registered");

            // register the player
            blitz_player_register.registered = true;
            blitz_player_register.once_registered = true;
            world.write_model(@blitz_player_register);

            // save the registration config
            WorldConfigUtilImpl::set_member(
                ref world, selector!("blitz_registration_config"), blitz_registration_config,
            );


            ////////////////////////////////////////////////
            /// Register player's cosmetic items
            ////////////////////////////////////////////////
            
            // create lock if registration_count is 1
            let collectibles_lock_id: u64 = season_config.end_at;
            let collectibles_cosmetics_address = blitz_registration_config.collectibles_cosmetics_address;
            let collectibles_timelock_address = blitz_registration_config.collectibles_timelock_address;
            if collectibles_cosmetics_address.is_non_zero() && collectibles_timelock_address.is_non_zero() {
                if blitz_registration_config.registration_count == 1 {
                    iCollectiblesImpl::create_lock(
                        collectibles_timelock_address,
                        collectibles_cosmetics_address,
                        collectibles_lock_id
                    );
                }

                // ensure all token ids are locked and retrieve their attributes
                if cosmetic_token_ids.len() > 0 {
                    let player_cosmetic_attrs 
                        = iCollectiblesImpl::ensure_locked_and_retrieve_attrs(
                            collectibles_cosmetics_address,
                            owner,
                            cosmetic_token_ids,
                            collectibles_lock_id.into(),
                            blitz_registration_config.collectibles_cosmetics_max
                        );

                    world.write_model(
                        @BlitzCosmeticAttrsRegister {
                            player: starknet::get_caller_address(),
                            attrs: player_cosmetic_attrs,
                        }
                    );
                }
            }




            ////////////////////////////////////////////////
            /// Generate the next 3 possible spawn points
            /// for any player and store it
            ////////////////////////////////////////////////

            // generate the next possible spawn point (3 coords) for any player and store it
            let mut blitz_settlement_config: BlitzSettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_settlement_config"),
            );
            let map_center: Coord = CoordImpl::center(ref world);
            let mut coords: Array<Coord> = blitz_settlement_config.generate_coords(map_center);
            // let player_position_spot_number: u16 = blitz_registration_config.registration_count;

            // this allows dev mode registration as opposed to the previous line
            let player_position_spot_number: u16 = blitz_registration_config.registration_count
                - blitz_registration_config.assigned_positions_count;

            let mut blitz_position_register: BlitzRealmPositionRegister = BlitzRealmPositionRegister {
                spot_number: player_position_spot_number, coords: coords.span(),
            };
            world.write_model(@blitz_position_register);

            // save the updated blitz settlement config
            blitz_settlement_config.next();
            WorldConfigUtilImpl::set_member(ref world, selector!("blitz_settlement_config"), blitz_settlement_config);

            // store structure reservation
            for coord in coords {
                world.write_model(@StructureReservation { coord: coord, reserved: true });
            }

            ////////////////////////////////////////////////
            /// Update Hyperstructure Ring Count
            ////////////////////////////////////////////////

            // increase hyperstructure ring count
            // [when (r_squared <= Math.floor(P/6) && P % 6 != 0) OR (r_squared == 0)]
            // Where P is num registered players
            // and R is hyperstructure ring count

            let blitz_hyperstructure_settlement_config_selector: felt252 = selector!("blitz_hypers_settlement_config");
            let mut blitz_hyperstructure_settlement_config: BlitzHypersSettlementConfig =
                WorldConfigUtilImpl::get_member(
                world, blitz_hyperstructure_settlement_config_selector,
            );
            let registration_count = blitz_registration_config.registration_count.into();
            let max_ring_count = blitz_hyperstructure_settlement_config.max_ring_count;
            let max_ring_count_squared: u128 = max_ring_count.into() * max_ring_count.into();
            if max_ring_count_squared.is_zero()
                || (max_ring_count_squared <= registration_count / 6 && registration_count % 6 != 0) {
                blitz_hyperstructure_settlement_config.max_ring_count += 1;
                WorldConfigUtilImpl::set_member(
                    ref world, blitz_hyperstructure_settlement_config_selector, blitz_hyperstructure_settlement_config,
                );
            }

            // set name for the player
            //note: this can be abused. as you can pay to set the name for any player

            let mut address_name: AddressName = world.read_model(owner);
            address_name.name = name;
            world.write_model(@address_name);

            let mut structure_owner_stats: StructureOwnerStats = world.read_model(owner);
            structure_owner_stats.name = name;
            world.write_model(@structure_owner_stats);

            // emit registration event
            world.emit_event(@BlitzRegistrationEvent { player: owner, timestamp: now.into() });
        }


        /// Callable by anyone to make hyperstructures.
        ///
        /// It can be called during or after registration period. But all hyperstructures must be created
        /// before the
        ///creation period ends.
        ///
        /// The maximum number of hyperstructures is 6 x blitz_hyperstructure_settlement_config.max_ring_count
        /// So the count parameter should be <=
        ///  6 x blitz_hyperstructure_settlement_config.max_ring_count
        ///     - hyperstructure_globals.created_count
        ///
        /// The count should generally be a small number like 6 or 7 to prevent out of gas errors
        ///
        fn make_hyperstructures(ref self: ContractState, count: u8) {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_settling_started_and_not_over();

            ////////////////////////////////////////////////
            /// Create hyperstructures
            ////////////////////////////////////////////////

            // obtain vrf seed
            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher.get_random_number(starknet::get_caller_address(), world);

            // retrieve relevant configs
            let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
            let troop_limit_config: TroopLimitConfig = WorldConfigUtilImpl::get_member(
                world, selector!("troop_limit_config"),
            );
            let troop_stamina_config: TroopStaminaConfig = WorldConfigUtilImpl::get_member(
                world, selector!("troop_stamina_config"),
            );

            // create center hyperstructure [when num hyperstructures is 0]
            let mut blitz_hyperstructure_settlement_config: BlitzHypersSettlementConfig =
                WorldConfigUtilImpl::get_member(
                world, selector!("blitz_hypers_settlement_config"),
            );

            let map_center: Coord = CoordImpl::center(ref world);

            for i in 0..count {
                if !blitz_hyperstructure_settlement_config.is_valid_ring() {
                    break;
                }

                let next_coord: Coord = blitz_hyperstructure_settlement_config.next_coord(map_center);
                iHyperstructureDiscoveryImpl::create(
                    ref world,
                    next_coord,
                    Zero::zero(),
                    map_config,
                    troop_limit_config,
                    troop_stamina_config,
                    vrf_seed + i.into(),
                    true,
                    true,
                );

                // move to the next location and see if we are done
                blitz_hyperstructure_settlement_config.next();
            }

            WorldConfigUtilImpl::set_member(
                ref world, selector!("blitz_hypers_settlement_config"), blitz_hyperstructure_settlement_config,
            );
        }

        fn assign_realm_positions(ref self: ContractState) {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure all hyperstructures have been created
            let mut blitz_hyperstructure_settlement_config: BlitzHypersSettlementConfig =
                WorldConfigUtilImpl::get_member(
                world, selector!("blitz_hypers_settlement_config"),
            );
            assert!(
                !blitz_hyperstructure_settlement_config.is_valid_ring(),
                "Eternum: Not all hyperstructures have been created",
            );

            // ensure player registered
            let caller: ContractAddress = starknet::get_caller_address();
            let mut blitz_player_register: BlitzRealmPlayerRegister = world.read_model(caller);
            assert!(blitz_player_register.registered, "Eternum: Player is not registered");

            // remove player registration
            blitz_player_register.registered = false;
            world.write_model(@blitz_player_register);

            // find a random position for the player from the list of available positions
            let mut blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );
            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher.get_random_number(starknet::get_caller_address(), world);
            let upper_bound: u128 = blitz_registration_config.registration_count.into();
            let lower_bound: u128 = blitz_registration_config.assigned_positions_count.into();
            let range: u128 = (upper_bound - lower_bound).into();
            let player_position_spot_number: u16 = 1
                + rng_library_dispatcher.get_random_in_range(vrf_seed, 98139, range).try_into().unwrap();
            let player_position_register: BlitzRealmPositionRegister = world.read_model(player_position_spot_number);

            // reduce the number of available positions by 1
            let last_position_spot_number: u16 = blitz_registration_config.registration_count
                - blitz_registration_config.assigned_positions_count;
            let last_position_register: BlitzRealmPositionRegister = world.read_model(last_position_spot_number);
            world
                .write_model(
                    @BlitzRealmPositionRegister {
                        spot_number: player_position_spot_number, coords: last_position_register.coords,
                    },
                );

            blitz_registration_config.assigned_positions_count += 1;
            WorldConfigUtilImpl::set_member(
                ref world, selector!("blitz_registration_config"), blitz_registration_config,
            );

            world
                .write_model(
                    @BlitzRealmSettleFinish {
                        player: caller,
                        coords: player_position_register.coords,
                        structure_ids: array![].span(),
                        labor_prod_started: false,
                    },
                );
        }

        fn settle_realms(ref self: ContractState, settlement_count: u8) -> Array<ID> {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            let caller: ContractAddress = starknet::get_caller_address();
            let mut player_settle_finish: BlitzRealmSettleFinish = world.read_model(caller);
            assert!(
                player_settle_finish.coords.len() > 0,
                "Eternum: Player has no assigned realm positions or has finished settlement",
            );


            // get realm count
            let realm_count_selector: felt252 = selector!("realm_count_config");
            let mut realm_count: RealmCountConfig = WorldConfigUtilImpl::get_member(world, realm_count_selector);

            let mut coords = player_settle_finish.coords;
            let mut structure_ids: Array<ID> = player_settle_finish.structure_ids.into();
            let resources = blitz_produceable_resources();
            let (realm_internal_systems_address, _) = world.dns(@"realm_internal_systems").unwrap();

            
            assert!(
                coords.len() >= settlement_count.into(),
                "Eternum: Not enough assigned coords to settle realms",
            );
            for _ in 0..settlement_count {
                 // create realm structure
                realm_count.count += 1;
                let realm_id = realm_count.count.into();
                let coord = *coords.pop_front().unwrap();
                let structure_id = IRealmInternalSystemsDispatcher { contract_address: realm_internal_systems_address }
                    .create_internal(caller, realm_id, resources.clone(), 0, 1, coord, false);

                 // set infinite labor production
                let labor_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LABOR);
                let mut structure_weight = WeightStoreImpl::retrieve(ref world, structure_id);
                let mut structure_labor_resource = SingleResourceStoreImpl::retrieve(
                    ref world,
                    structure_id,
                    ResourceTypes::LABOR,
                    ref structure_weight,
                    labor_resource_weight_grams,
                    true,
                );
                let mut structure_labor_production: Production = structure_labor_resource.production;
                structure_labor_production.increase_output_amout_left(Bounded::MAX);
                structure_labor_resource.production = structure_labor_production;
                structure_labor_resource.store(ref world);

                // update structure weight
                structure_weight.store(ref world, structure_id);

                // emit realm settle event
                let now = starknet::get_block_timestamp();
                world
                    .emit_event(
                        @StoryEvent {
                            owner: Option::Some(caller),
                            entity_id: Option::Some(structure_id),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::RealmCreatedStory(RealmCreatedStory { coord }),
                            timestamp: now,
                        },
                    );

                // emit achievement progression
                AchievementTrait::progress(world, caller.into(), Tasks::REALM_SETTLEMENT, 1, now.into());

                structure_ids.append(structure_id);
            }

            // update realm count
            WorldConfigUtilImpl::set_member(ref world, realm_count_selector, realm_count);

            // update player allocated realms
            player_settle_finish.structure_ids = structure_ids.span();
            player_settle_finish.coords = coords;
            world.write_model(@player_settle_finish);

            structure_ids
        }
    }
}
