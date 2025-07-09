use s1_eternum::alias::ID;
use starknet::ContractAddress;


#[starknet::interface]
pub trait IBlitzRealmSystems<T> {
    fn register(ref self: T, owner: ContractAddress);
    fn create(ref self: T) -> Array<ID>;
}

#[dojo::contract]
pub mod blitz_realm_systems {
    use core::num::traits::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait};
    use dojo::world::{WorldStorage, WorldStorageTrait};

    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::{
        BlitzRegistrationConfig, BlitzRegistrationConfigImpl, BlitzSettlementConfig, BlitzSettlementConfigImpl,
        RealmCountConfig, SeasonConfigImpl, WorldConfigUtilImpl,
    };
    use s1_eternum::models::event::{EventType, SettleRealmData};
    use s1_eternum::models::map::{TileImpl};
    use s1_eternum::models::name::{AddressName};
    use s1_eternum::models::position::{Coord};
    use s1_eternum::models::realm::{
        BlitzRealmPlayerRegister, BlitzRealmPositionRegister, RealmNameAndAttrsDecodingImpl, RealmReferenceImpl,
    };
    use s1_eternum::models::resource::production::building::{BuildingImpl};
    use s1_eternum::models::resource::resource::{ResourceImpl};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{
        StructureBaseStoreImpl, StructureImpl, StructureMetadataStoreImpl, StructureOwnerStoreImpl,
    };
    use s1_eternum::systems::realm::utils::contracts::{
        IERC20Dispatcher, IERC20DispatcherTrait, IRealmInternalSystemsDispatcher, IRealmInternalSystemsDispatcherTrait,
    };
    use s1_eternum::systems::utils::realm::iRealmImpl;
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use s1_eternum::utils::achievements::index::{AchievementTrait, Tasks};
    use s1_eternum::utils::random;
    use s1_eternum::utils::random::VRFImpl;
    use starknet::ContractAddress;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct BlitzRegistrationEvent {
        #[key]
        player: ContractAddress,
        timestamp: u64,
    }

    #[abi(embed_v0)]
    impl BlitzRealmSystemsImpl of super::IBlitzRealmSystems<ContractState> {
        // Register for the game and pay the registration fee
        // Owner is the address that is going to own the realm
        fn register(ref self: ContractState, owner: ContractAddress) {
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

            // collect registration fee if any
            if blitz_registration_config.fee_amount.is_non_zero() {
                let caller: ContractAddress = starknet::get_caller_address();
                let fee_token_contract: IERC20Dispatcher = IERC20Dispatcher {
                    contract_address: blitz_registration_config.fee_token,
                };
                fee_token_contract
                    .transfer_from(
                        caller, blitz_registration_config.fee_recipient, blitz_registration_config.fee_amount,
                    );
            }

            // ensure that the player is not already registered
            let mut blitz_player_register: BlitzRealmPlayerRegister = world.read_model(owner);
            assert!(!blitz_player_register.registered, "Eternum: Player is already registered");

            // register the player
            blitz_player_register.registered = true;
            world.write_model(@blitz_player_register);

            // save the registration config
            WorldConfigUtilImpl::set_member(
                ref world, selector!("blitz_registration_config"), blitz_registration_config,
            );

            // generate the next possible spawn point (3 coords) for any player and store it
            let mut blitz_settlement_config: BlitzSettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_settlement_config"),
            );
            let mut coords: Array<Coord> = blitz_settlement_config.generate_coords();
            let mut blitz_position_register: BlitzRealmPositionRegister = world
                .read_model(blitz_registration_config.registration_count);
            blitz_position_register.coords = coords.span();
            world.write_model(@blitz_position_register);

            // save the updated blitz settlement config
            blitz_settlement_config.next();
            WorldConfigUtilImpl::set_member(ref world, selector!("blitz_settlement_config"), blitz_settlement_config);

            // emit registration event
            world.emit_event(@BlitzRegistrationEvent { player: owner, timestamp: now.into() });
        }


        fn create(ref self: ContractState) -> Array<ID> {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_settling_started_and_not_over();

            // ensure time window is open for realm settlement
            let mut blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );
            let now: u32 = starknet::get_block_timestamp().try_into().unwrap();
            assert!(blitz_registration_config.is_creation_open(now), "Eternum: Realm settlement period is over");

            // ensure player registered
            let caller: ContractAddress = starknet::get_caller_address();
            let mut blitz_player_register: BlitzRealmPlayerRegister = world.read_model(caller);
            assert!(blitz_player_register.registered, "Eternum: Player is not registered");

            // remove player registration
            blitz_player_register.registered = false;
            world.write_model(@blitz_player_register);

            // find a random position for the player from the list of available positions
            let vrf_provider: ContractAddress = WorldConfigUtilImpl::get_member(
                world, selector!("vrf_provider_address"),
            );
            let vrf_seed: u256 = VRFImpl::seed(caller, vrf_provider);
            let upper_bound: u128 = blitz_registration_config.registration_count.into();
            let lower_bound: u128 = blitz_registration_config.assigned_positions_count.into();
            let range: u128 = (upper_bound - lower_bound).into();
            let player_position_spot_number: u16 = 1 + random::random(vrf_seed, 98139, range).try_into().unwrap();
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
                // println!("\n realm_count.count: {}", realm_count.count);
                let realm_id = realm_count.count.into();
                let coord = *coords.pop_front().unwrap();
                let resources = array![1, 2, 3, 4];
                let (realm_internal_systems_address, _) = world.dns(@"realm_internal_systems").unwrap();
                let structure_id = IRealmInternalSystemsDispatcher { contract_address: realm_internal_systems_address }
                    .create_internal(caller, realm_id, resources, 0, 1, coord, false);
                // emit realm settle event
                let address_name: AddressName = world.read_model(caller);
                world
                    .emit_event(
                        @SettleRealmData {
                            id: world.dispatcher.uuid(),
                            event_id: EventType::SettleRealm,
                            entity_id: structure_id,
                            owner_address: caller,
                            owner_name: address_name.name,
                            realm_name: '',
                            produced_resources: 0, // why?
                            cities: 0,
                            harbors: 0,
                            rivers: 0,
                            regions: 0,
                            wonder: 1,
                            order: 0,
                            x: coord.x,
                            y: coord.y,
                            timestamp: now.into(),
                        },
                    );

                // emit achievement progression
                AchievementTrait::progress(world, caller.into(), Tasks::REALM_SETTLEMENT, 1, now.into());

                structure_ids.append(structure_id);
            };

            // update realm count
            WorldConfigUtilImpl::set_member(ref world, realm_count_selector, realm_count);

            structure_ids
        }
    }
}
