use s1_eternum::alias::ID;
use starknet::ContractAddress;



// Note: dont include burn as that would affect the total supply check in `obtain_entry_token` function
#[starknet::interface]
pub trait IERC721MintLock<T> {
    fn safe_mint(ref self: T, recipient: ContractAddress, attributes_raw: u128);
    fn token_lock_state(self: @T, token_id: u256) -> (felt252, felt252);
    fn total_supply(self: @T) -> u256;
}

#[starknet::interface]
pub trait IBlitzRealmSystems<T> {
    fn obtain_entry_token(ref self: T);
    fn register(ref self: T, name: felt252, token_id: u128);
    fn make_hyperstructures(ref self: T, count: u8);
    fn create(ref self: T) -> Array<ID>;
}

#[dojo::contract]
pub mod blitz_realm_systems {
    use core::num::traits::{Bounded, Zero};
    use starknet::ContractAddress;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    
    use s1_eternum::constants::{DEFAULT_NS, ResourceTypes, blitz_produceable_resources};
    use s1_eternum::models::config::{
        BlitzHypersSettlementConfig, BlitzHypersSettlementConfigImpl, BlitzRealmPlayerRegister, BlitzEntryTokenRegister,
        BlitzRealmPositionRegister, BlitzRegistrationConfig, BlitzRegistrationConfigImpl, BlitzSettlementConfig,
        BlitzSettlementConfigImpl, MapConfig, RealmCountConfig, SeasonConfigImpl, TroopLimitConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use s1_eternum::models::events::{RealmCreatedStory, Story, StoryEvent};
    use s1_eternum::models::map::TileImpl;
    use s1_eternum::models::name::AddressName;
    use s1_eternum::models::position::Coord;
    use s1_eternum::models::realm::{RealmNameAndAttrsDecodingImpl, RealmReferenceImpl};
    use s1_eternum::models::resource::production::building::BuildingImpl;
    use s1_eternum::models::resource::production::production::{Production, ProductionImpl};
    use s1_eternum::models::resource::resource::{
        ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{
        StructureBaseStoreImpl, StructureImpl, StructureMetadataStoreImpl, StructureOwnerStats, StructureOwnerStoreImpl,
        StructureReservation,
    };
    use s1_eternum::systems::realm::utils::contracts::{
        IERC20Dispatcher, IERC20DispatcherTrait, IRealmInternalSystemsDispatcher, IRealmInternalSystemsDispatcherTrait,
    };
    use s1_eternum::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use s1_eternum::systems::utils::realm::iRealmImpl;
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use s1_eternum::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::systems::prize_distribution::contracts::prize_distribution_systems;
    use super::{IERC721MintLockDispatcher, IERC721MintLockDispatcherTrait};
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
                let entry_token_contract = IERC721MintLockDispatcher {
                    contract_address: blitz_registration_config.entry_token_address,
                };
                entry_token_contract.safe_mint(caller, 0x0);

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
        fn register(ref self: ContractState, name: felt252, token_id: u128) {

            // todo ensure owner is a cartridge controller address
            assert!(name.is_non_zero(), "Eternum: Name cannot be empty");

            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_settling_started_and_not_over();

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

            // if there is a required fee amount, ensure token is locked  
            if blitz_registration_config.fee_amount.is_non_zero() {

                let entry_token_contract = IERC721MintLockDispatcher {
                    contract_address: blitz_registration_config.entry_token_address,
                };
                let (lock_id, _) = entry_token_contract.token_lock_state(token_id.into());
                assert!(
                    lock_id.is_non_zero() 
                    && lock_id == blitz_registration_config.entry_token_lock_id(),
                    "Eternum: Entry token is not locked",
                );

                // ensure token cant be reused
                let entry_token_register: BlitzEntryTokenRegister = world.read_model(token_id);
                assert!(!entry_token_register.registered, "Eternum: Entry token has already been used");
                world.write_model(@BlitzEntryTokenRegister { token_id: token_id, registered: true } );
            }

            // ensure that the player is not already registered
            let owner = starknet::get_caller_address();
            let mut blitz_player_register: BlitzRealmPlayerRegister = world.read_model(owner);
            assert!(!blitz_player_register.registered, "Eternum: Player is already registered");

            // register the player
            blitz_player_register.registered = true;
            world.write_model(@blitz_player_register);

            // save the registration config
            WorldConfigUtilImpl::set_member(
                ref world, selector!("blitz_registration_config"), blitz_registration_config,
            );

            ////////////////////////////////////////////////
            /// Generate the next 3 possible spawn points
            /// for any player and store it
            ////////////////////////////////////////////////

            // generate the next possible spawn point (3 coords) for any player and store it
            let mut blitz_settlement_config: BlitzSettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_settlement_config"),
            );
            let mut coords: Array<Coord> = blitz_settlement_config.generate_coords();
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

            for i in 0..count {
                if !blitz_hyperstructure_settlement_config.is_valid_ring() {
                    break;
                }

                let next_coord: Coord = blitz_hyperstructure_settlement_config.next_coord();
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

        fn create(ref self: ContractState) -> Array<ID> {
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

            // get realm count
            let realm_count_selector: felt252 = selector!("realm_count_config");
            let mut realm_count: RealmCountConfig = WorldConfigUtilImpl::get_member(world, realm_count_selector);

            let mut coords = player_position_register.coords;
            let mut structure_ids: Array<ID> = array![];
            while coords.len() > 0 {
                realm_count.count += 1;
                let realm_id = realm_count.count.into();
                let coord = *coords.pop_front().unwrap();
                let resources = blitz_produceable_resources();
                let (realm_internal_systems_address, _) = world.dns(@"realm_internal_systems").unwrap();
                let structure_id = IRealmInternalSystemsDispatcher { contract_address: realm_internal_systems_address }
                    .create_internal(caller, realm_id, resources, 0, 1, coord, false);

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

            structure_ids
        }
    }
}
