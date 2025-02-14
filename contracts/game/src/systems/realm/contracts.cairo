use s1_eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
trait ISeasonPass<TState> {
    fn get_encoded_metadata(self: @TState, token_id: u16) -> (felt252, felt252, felt252);
    fn transfer_from(self: @TState, from: ContractAddress, to: ContractAddress, token_id: u256);
    fn lords_balance(self: @TState, token_id: u256) -> u256;
    fn detach_lords(self: @TState, token_id: u256, amount: u256);
}

#[starknet::interface]
trait IERC20<TState> {
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
}


#[starknet::interface]
trait IRealmSystems<T> {
    fn create(
        ref self: T,
        owner: starknet::ContractAddress,
        realm_id: ID,
        frontend: ContractAddress,
        lords_resource_index: u8,
    ) -> ID;
    fn upgrade_level(ref self: T, realm_id: ID);
    fn quest_claim(ref self: T, quest_id: ID, entity_id: ID);
}

#[dojo::contract]
mod realm_systems {
    use achievement::store::{Store, StoreTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use s1_eternum::alias::ID;
    use s1_eternum::constants::REALM_ENTITY_TYPE;
    use s1_eternum::constants::{DEFAULT_NS, WONDER_QUEST_REWARD_BOOST, WORLD_CONFIG_ID};
    use s1_eternum::models::config::{
        ProductionConfig, QuestRewardConfig, RealmLevelConfig, SeasonAddressesConfig, SettlementConfig,
        SettlementConfigImpl, WorldConfigUtilImpl,
    };
    use s1_eternum::models::event::{EventType, SettleRealmData};
    use s1_eternum::models::map::Tile;
    use s1_eternum::models::movable::Movable;
    use s1_eternum::models::name::{AddressName};
    use s1_eternum::models::owner::{Owner, OwnerTrait};
    use s1_eternum::models::position::{Coord, OccupiedBy, Occupier, OccupierTrait, Position};
    use s1_eternum::models::quantity::QuantityTracker;
    use s1_eternum::models::quest::{Quest};
    use s1_eternum::models::realm::{
        Realm, RealmImpl, RealmNameAndAttrsDecodingImpl, RealmNameAndAttrsDecodingTrait, RealmReferenceImpl,
        RealmResourcesImpl, RealmResourcesTrait, RealmTrait,
    };
    use s1_eternum::models::resource::production::building::{Building, BuildingCategory, BuildingImpl};
    use s1_eternum::models::resource::resource::{ResourceList};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::season::Season;
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{Structure, StructureCategory, StructureImpl};
    use s1_eternum::models::weight::{Weight, WeightImpl};
    use s1_eternum::systems::resources::contracts::resource_bridge_systems::{
        IResourceBridgeSystemsDispatcher, IResourceBridgeSystemsDispatcherTrait,
    };
    use s1_eternum::systems::utils::map::iMapImpl;
    use s1_eternum::utils::map::{biomes::{Biome, get_biome}};
    use s1_eternum::utils::tasks::index::{Task, TaskTrait};
    use starknet::ContractAddress;
    use super::{IERC20Dispatcher, IERC20DispatcherTrait, ISeasonPassDispatcher, ISeasonPassDispatcherTrait};

    #[abi(embed_v0)]
    impl RealmSystemsImpl of super::IRealmSystems<ContractState> {
        /// Create a new realm
        /// @param owner the address that'll own the realm in the game
        /// @param realm_id The ID of the realm
        /// @param frontend: address to pay client fees to
        /// @return The realm's entity ID
        ///
        /// @note This function is only callable by the season pass owner
        /// and the season pass owner must approve this contract to
        /// spend their season pass NFT
        ///
        fn create(
            ref self: ContractState,
            owner: ContractAddress,
            realm_id: ID,
            frontend: ContractAddress,
            lords_resource_index: u8,
        ) -> ID {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut season: Season = world.read_model(WORLD_CONFIG_ID);
            season.assert_has_started();
            SeasonImpl::assert_season_is_not_over(world);

            // collect season pass
            let season_addresses_config: SeasonAddressesConfig = WorldConfigUtilImpl::get_member(
                world, selector!("season_addresses_config"),
            );
            InternalRealmLogicImpl::collect_season_pass(season_addresses_config.season_pass_address, realm_id);

            // retrieve realm metadata
            let (realm_name, regions, cities, harbors, rivers, wonder, order, resources) =
                InternalRealmLogicImpl::retrieve_metadata_from_season_pass(
                season_addresses_config.season_pass_address, realm_id,
            );

            // create realm
            let mut coord: Coord = InternalRealmLogicImpl::get_new_location(ref world);
            let (entity_id, realm_produced_resources_packed) = InternalRealmLogicImpl::create_realm(
                ref world, owner, realm_id, resources, order, 0, wonder, coord,
            );

            // collect lords attached to season pass and bridge into the realm
            let lords_amount_attached: u256 = InternalRealmLogicImpl::collect_lords_from_season_pass(
                season_addresses_config.season_pass_address, realm_id,
            );

            // bridge attached lords into the realm
            if lords_amount_attached.is_non_zero() {
                InternalRealmLogicImpl::bridge_lords_into_realm(
                    ref world,
                    season_addresses_config.lords_address,
                    entity_id,
                    lords_amount_attached,
                    frontend,
                    lords_resource_index,
                );
            }

            // emit realm settle event
            let address_name: AddressName = world.read_model(owner);
            world
                .emit_event(
                    @SettleRealmData {
                        id: world.dispatcher.uuid(),
                        event_id: EventType::SettleRealm,
                        entity_id,
                        owner_address: owner,
                        owner_name: address_name.name,
                        realm_name: realm_name,
                        produced_resources: realm_produced_resources_packed,
                        cities,
                        harbors,
                        rivers,
                        regions,
                        wonder,
                        order,
                        x: coord.x,
                        y: coord.y,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            entity_id.into()
        }


        fn upgrade_level(ref self: ContractState, realm_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure caller owns the realm
            let mut structure: Structure = world.read_model(realm_id);
            structure.owner.assert_caller_owner();

            // ensure entity is a realm
            assert(structure.category == StructureCategory::Realm, 'entity is not a realm');

            // ensure realm is not already at max level
            let mut realm: Realm = world.read_model(realm_id);
            let max_level = realm.max_level(world);
            assert(realm.level < max_level, 'realm is already at max level');

            // make payment to upgrade to next level
            let next_level = realm.level + 1;
            let realm_level_config: RealmLevelConfig = world.read_model(next_level);
            let required_resources_id = realm_level_config.required_resources_id;
            let required_resource_count = realm_level_config.required_resource_count;

            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_id);
            let mut index = 0;
            loop {
                if index == required_resource_count {
                    break;
                }

                let mut required_resource: ResourceList = world.read_model((required_resources_id, index));

                // burn resource from realm
                let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, required_resource.resource_type);
                let mut realm_resource = SingleResourceStoreImpl::retrieve(
                    ref world,
                    realm_id,
                    required_resource.resource_type,
                    ref structure_weight,
                    resource_weight_grams,
                    true,
                );
                realm_resource.spend(required_resource.amount, ref structure_weight, resource_weight_grams);
                realm_resource.store(ref world);

                index += 1;
            };

            // update structure weight
            structure_weight.store(ref world, realm_id);

            // set new level
            realm.level = next_level;
            world.write_model(@realm);

            // allow structure more one more army
            structure.troop.max_troops_allowed += 1;
            structure.troop.max_guards_allowed += 1;
            world.write_model(@structure);

            // [Achievement] Upgrade to max level
            if realm.level == max_level {
                let player_id: felt252 = starknet::get_caller_address().into();
                let task_id: felt252 = Task::Maximalist.identifier();
                let store = StoreTrait::new(world);
                store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp());
            }
        }

        fn quest_claim(ref self: ContractState, quest_id: ID, entity_id: ID) {
            // ensure season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure entity is a realm
            let structure: Structure = world.read_model(entity_id);
            assert(structure.category == StructureCategory::Realm, 'entity is not a realm');

            // ensure caller owns the realm
            structure.owner.assert_caller_owner();

            // ensure quest is not already completed
            let mut quest: Quest = world.read_model((entity_id, quest_id));
            assert(!quest.completed, 'quest already completed');

            // ensure quest has rewards
            let quest_reward_config: QuestRewardConfig = world.read_model(quest_id);
            assert(quest_reward_config.resource_list_count > 0, 'quest has no rewards');

            let mut index = 0;
            let realm: Realm = world.read_model(entity_id);

            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
            loop {
                if index == quest_reward_config.resource_list_count {
                    break;
                }

                // get reward resource
                let mut resource_list: ResourceList = world.read_model((quest_reward_config.resource_list_id, index));
                let reward_resource_type = resource_list.resource_type;
                let mut reward_resource_amount = resource_list.amount;

                //todo: remove?
                if realm.has_wonder {
                    reward_resource_amount *= WONDER_QUEST_REWARD_BOOST.into();
                }

                // add resource to realm
                let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, reward_resource_type);
                let mut realm_resource = SingleResourceStoreImpl::retrieve(
                    ref world, entity_id, reward_resource_type, ref structure_weight, resource_weight_grams, true,
                );
                realm_resource.add(reward_resource_amount, ref structure_weight, resource_weight_grams);
                realm_resource.store(ref world);
                index += 1;
            };

            // update structure weight
            structure_weight.store(ref world, entity_id);

            quest.completed = true;
            world.write_model(@quest);

            // [Achievement] Complete all quests
            let next_quest_id: ID = (quest_id + 1).into();
            let next_quest_reward_config: QuestRewardConfig = world.read_model(next_quest_id);
            // if the next quest has no rewards, the player has completed all quests
            if (next_quest_reward_config.resource_list_count == 0) {
                let player_id: felt252 = starknet::get_caller_address().into();
                let task_id: felt252 = Task::Squire.identifier();
                let store = StoreTrait::new(world);
                store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp());
            };
        }
    }


    #[generate_trait]
    impl InternalRealmLogicImpl of InternalRealmLogicTrait {
        fn create_realm(
            ref world: WorldStorage,
            owner: ContractAddress,
            realm_id: ID,
            resources: Array<u8>,
            order: u8,
            level: u8,
            wonder: u8,
            coord: Coord,
        ) -> (ID, u128) {
            // create realm

            let has_wonder = RealmReferenceImpl::wonder_mapping(wonder.into()) != "None";
            let realm_produced_resources_packed = RealmResourcesImpl::pack_resource_types(resources.span());
            let entity_id = world.dispatcher.uuid();

            let owner: Owner = Owner { entity_id: entity_id.into(), address: owner };
            let structure: Structure = StructureImpl::new(entity_id.into(), StructureCategory::Realm, coord, owner);
            world.write_model(@structure);

            let occupier: Occupier = Occupier {
                x: coord.x, y: coord.y, entity: OccupiedBy::Structure(entity_id.into()),
            };
            world.write_model(@occupier);

            world
                .write_model(
                    @Realm {
                        entity_id: entity_id.into(),
                        realm_id,
                        produced_resources: realm_produced_resources_packed,
                        order,
                        level,
                        has_wonder,
                    },
                );

            // explore tile where realm sits if not already explored
            let mut tile: Tile = world.read_model((coord.x, coord.y));
            if tile.explored_at.is_zero() {
                let biome = get_biome(coord.x.into(), coord.y.into());
                iMapImpl::explore(ref world, ref tile, biome);
            }

            // place castle building
            BuildingImpl::create(ref world, entity_id, BuildingCategory::Castle, Option::None, BuildingImpl::center());

            (entity_id, realm_produced_resources_packed)
        }

        fn collect_season_pass(season_pass_address: ContractAddress, realm_id: ID) {
            let caller = starknet::get_caller_address();
            let this = starknet::get_contract_address();
            let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };

            // transfer season pass from caller to this
            season_pass.transfer_from(caller, this, realm_id.into());
        }

        fn collect_lords_from_season_pass(season_pass_address: ContractAddress, realm_id: ID) -> u256 {
            // detach lords from season pass
            let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };
            let token_lords_balance: u256 = season_pass.lords_balance(realm_id.into());
            season_pass.detach_lords(realm_id.into(), token_lords_balance);
            assert!(season_pass.lords_balance(realm_id.into()).is_zero(), "lords amount attached to realm should be 0");

            // at this point, this contract's lords balance must have increased by
            // `token_lords_balance`
            token_lords_balance
        }


        fn bridge_lords_into_realm(
            ref world: WorldStorage,
            lords_address: ContractAddress,
            realm_entity_id: ID,
            amount: u256,
            frontend: ContractAddress,
            lords_resource_index: u8,
        ) {
            // get bridge systems address
            let (bridge_systems_address, _namespace_hash) =
                match world.dispatcher.resource(selector_from_tag!("s1_eternum-resource_bridge_systems")) {
                dojo::world::Resource::Contract((
                    contract_address, namespace_hash,
                )) => (contract_address, namespace_hash),
                _ => (Zeroable::zero(), Zeroable::zero()),
            };

            // approve bridge to spend lords
            IERC20Dispatcher { contract_address: lords_address }.approve(bridge_systems_address, amount);

            // deposit lords
            IResourceBridgeSystemsDispatcher { contract_address: bridge_systems_address }
                .deposit_initial(lords_address, realm_entity_id, amount, frontend, lords_resource_index);
        }


        fn retrieve_metadata_from_season_pass(
            season_pass_address: ContractAddress, realm_id: ID,
        ) -> (felt252, u8, u8, u8, u8, u8, u8, Array<u8>) {
            let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };
            let (name_and_attrs, _urla, _urlb) = season_pass.get_encoded_metadata(realm_id.try_into().unwrap());
            RealmNameAndAttrsDecodingImpl::decode(name_and_attrs)
        }

        fn get_new_location(ref world: WorldStorage) -> Coord {
            // ensure that the coord is not occupied by any other structure
            let mut found_coords = false;
            let mut coord: Coord = Coord { x: 0, y: 0 };
            let mut settlement_config: SettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("settlement_config"),
            );
            while (!found_coords) {
                //todo: note: ask if its okay if new realm is not settled at
                // correct location when a troop is on it
                coord = settlement_config.get_next_settlement_coord();
                let occupier: Occupier = world.read_model(coord);
                if occupier.not_occupied() {
                    found_coords = true;
                }
            };
            // save the new config so that if there's no already a structure at the coord we can
            // find a new one
            WorldConfigUtilImpl::set_member(ref world, selector!("settlement_config"), settlement_config);
            return coord;
        }
    }
}
