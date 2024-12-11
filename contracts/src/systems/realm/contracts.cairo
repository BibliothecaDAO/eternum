use s0_eternum::alias::ID;
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
    fn create(ref self: T, owner: starknet::ContractAddress, realm_id: ID, frontend: ContractAddress) -> ID;
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

    use s0_eternum::alias::ID;
    use s0_eternum::constants::REALM_ENTITY_TYPE;
    use s0_eternum::constants::{WORLD_CONFIG_ID, REALM_FREE_MINT_CONFIG_ID, DEFAULT_NS, WONDER_QUEST_REWARD_BOOST};
    use s0_eternum::models::capacity::{CapacityCategory};
    use s0_eternum::models::config::{CapacityConfigCategory, RealmLevelConfig, SettlementConfig, SettlementConfigImpl};
    use s0_eternum::models::config::{QuestRewardConfig, QuestConfig, SeasonAddressesConfig, ProductionConfig};
    use s0_eternum::models::event::{SettleRealmData, EventType};
    use s0_eternum::models::map::Tile;
    use s0_eternum::models::movable::Movable;
    use s0_eternum::models::name::{AddressName};
    use s0_eternum::models::owner::{Owner, EntityOwner, EntityOwnerTrait};
    use s0_eternum::models::position::{Position, Coord};
    use s0_eternum::models::production::{ProductionOutput};
    use s0_eternum::models::quantity::QuantityTracker;
    use s0_eternum::models::quest::{Quest, QuestBonus};
    use s0_eternum::models::realm::{
        Realm, RealmTrait, RealmImpl, RealmResourcesTrait, RealmResourcesImpl, RealmNameAndAttrsDecodingTrait,
        RealmNameAndAttrsDecodingImpl, RealmReferenceImpl
    };
    use s0_eternum::models::resources::{
        DetachedResource, Resource, ResourceImpl, ResourceTrait, ResourceFoodImpl, ResourceFoodTrait
    };

    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountTrait};
    use s0_eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;
    use s0_eternum::systems::resources::contracts::resource_bridge_systems::{
        IResourceBridgeSystemsDispatcher, IResourceBridgeSystemsDispatcherTrait
    };
    use s0_eternum::utils::tasks::index::{Task, TaskTrait};

    use starknet::ContractAddress;
    use super::{ISeasonPassDispatcher, ISeasonPassDispatcherTrait, IERC20Dispatcher, IERC20DispatcherTrait};

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
        fn create(ref self: ContractState, owner: ContractAddress, realm_id: ID, frontend: ContractAddress) -> ID {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_has_started(world);
            SeasonImpl::assert_season_is_not_over(world);

            // collect season pass
            let season: SeasonAddressesConfig = world.read_model(WORLD_CONFIG_ID);
            InternalRealmLogicImpl::collect_season_pass(season.season_pass_address, realm_id);

            // retrieve realm metadata
            let (realm_name, regions, cities, harbors, rivers, wonder, order, resources) =
                InternalRealmLogicImpl::retrieve_metadata_from_season_pass(
                season.season_pass_address, realm_id
            );

            // create realm
            let mut coord: Coord = InternalRealmLogicImpl::get_new_location(ref world);
            let (entity_id, realm_produced_resources_packed) = InternalRealmLogicImpl::create_realm(
                ref world, owner, realm_id, resources, order, 0, wonder, coord
            );

            // collect lords attached to season pass and bridge into the realm
            let lords_amount_attached: u256 = InternalRealmLogicImpl::collect_lords_from_season_pass(
                season.season_pass_address, realm_id
            );

            // bridge attached lords into the realm
            if lords_amount_attached.is_non_zero() {
                InternalRealmLogicImpl::bridge_lords_into_realm(
                    ref world, season.lords_address, entity_id, lords_amount_attached, frontend
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
                    }
                );

            entity_id.into()
        }


        fn upgrade_level(ref self: ContractState, realm_id: ID) {
            // ensure caller owns the realm
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let entity_owner: EntityOwner = world.read_model(realm_id);
            entity_owner.assert_caller_owner(world);

            // ensure entity is a realm
            let mut realm: Realm = world.read_model(realm_id);
            realm.assert_is_set();

            // ensure realm is not already at max level
            let max_level = realm.max_level(world);
            assert(realm.level < max_level, 'realm is already at max level');

            // make payment to upgrade to next level
            let next_level = realm.level + 1;
            let realm_level_config: RealmLevelConfig = world.read_model(next_level);
            let required_resources_id = realm_level_config.required_resources_id;
            let required_resource_count = realm_level_config.required_resource_count;
            let mut index = 0;
            loop {
                if index == required_resource_count {
                    break;
                }

                let mut required_resource: DetachedResource = world.read_model((required_resources_id, index));

                // burn resource from realm
                let mut realm_resource = ResourceImpl::get(ref world, (realm_id, required_resource.resource_type));
                realm_resource.burn(required_resource.resource_amount);
                realm_resource.save(ref world);
                index += 1;
            };

            // set new level
            realm.level = next_level;
            world.write_model(@realm);

            // [Achievement] Upgrade to max level
            if realm.level == max_level {
                let player_id: felt252 = starknet::get_caller_address().into();
                let task_id: felt252 = Task::Maximalist.identifier();
                let store = StoreTrait::new(world);
                store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp(),);
            }
        }

        fn quest_claim(ref self: ContractState, quest_id: ID, entity_id: ID) {
            // ensure season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure entity is a realm
            let realm: Realm = world.read_model(entity_id);
            realm.assert_is_set();

            // ensure quest is not already completed
            let mut quest: Quest = world.read_model((entity_id, quest_id));
            assert(!quest.completed, 'quest already completed');

            assert(realm.settler_address == starknet::get_caller_address(), 'Caller not settler');

            // ensure quest has rewards
            let quest_config: QuestConfig = world.read_model(WORLD_CONFIG_ID);
            let quest_reward_config: QuestRewardConfig = world.read_model(quest_id);
            assert(quest_reward_config.detached_resource_count > 0, 'quest has no rewards');

            let mut index = 0;
            loop {
                if index == quest_reward_config.detached_resource_count {
                    break;
                }

                // get reward resource
                let mut detached_resource: DetachedResource = world
                    .read_model((quest_reward_config.detached_resource_id, index));
                let reward_resource_type = detached_resource.resource_type;
                let mut reward_resource_amount = detached_resource.resource_amount;

                let mut quest_bonus: QuestBonus = world.read_model((entity_id, reward_resource_type));

                // scale reward resource amount by quest production multiplier
                // if the reward resource is used to produce another resource in the realm.
                // it will only be scaled if the quest bonus has not been claimed yet and
                // the reward resource is not food.
                if !quest_bonus.claimed && !ResourceFoodImpl::is_food(reward_resource_type) {
                    let reward_resource_production_config: ProductionConfig = world.read_model(reward_resource_type);
                    let mut jndex = 0;
                    loop {
                        if jndex == reward_resource_production_config.output_count {
                            break;
                        }

                        let output_resource_type: ProductionOutput = world.read_model((reward_resource_type, jndex));
                        if realm.produces_resource(output_resource_type.output_resource_type) {
                            // scale reward resource amount by quest production multiplier
                            reward_resource_amount *= quest_config.production_material_multiplier.into();
                            // set quest bonus as claimed
                            quest_bonus.claimed = true;
                            world.write_model(@quest_bonus);

                            break;
                        }

                        jndex += 1;
                    }
                }

                if realm.has_wonder {
                    reward_resource_amount *= WONDER_QUEST_REWARD_BOOST.into();
                }

                let mut realm_resource = ResourceImpl::get(ref world, (entity_id.into(), reward_resource_type));
                realm_resource.add(reward_resource_amount);
                realm_resource.save(ref world);

                index += 1;
            };

            quest.completed = true;
            world.write_model(@quest);

            // [Achievement] Complete all quests
            let next_quest_id: ID = (quest_id + 1).into();
            let next_quest_reward_config: QuestRewardConfig = world.read_model(next_quest_id);
            // if the next quest has no rewards, the player has completed all quests
            if (next_quest_reward_config.detached_resource_count == 0) {
                let player_id: felt252 = starknet::get_caller_address().into();
                let task_id: felt252 = Task::Squire.identifier();
                let store = StoreTrait::new(world);
                store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp(),);
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
            coord: Coord
        ) -> (ID, u128) {
            // create realm

            let has_wonder = RealmReferenceImpl::wonder_mapping(wonder.into()) != "None";
            let realm_produced_resources_packed = RealmResourcesImpl::pack_resource_types(resources.span());
            let entity_id = world.dispatcher.uuid();
            let now = starknet::get_block_timestamp();
            world.write_model(@Owner { entity_id: entity_id.into(), address: owner });
            world.write_model(@EntityOwner { entity_id: entity_id.into(), entity_owner_id: entity_id.into() });
            world
                .write_model(
                    @Structure { entity_id: entity_id.into(), category: StructureCategory::Realm, created_at: now, }
                );
            world.write_model(@StructureCount { coord, count: 1 });
            world
                .write_model(
                    @CapacityCategory { entity_id: entity_id.into(), category: CapacityConfigCategory::Structure }
                );
            world
                .write_model(
                    @Realm {
                        entity_id: entity_id.into(),
                        realm_id,
                        produced_resources: realm_produced_resources_packed,
                        order,
                        level,
                        has_wonder,
                        settler_address: owner,
                    }
                );
            world.write_model(@Position { entity_id: entity_id.into(), x: coord.x, y: coord.y, });

            // explore tile where realm sits if not already explored
            let mut tile: Tile = world.read_model((coord.x, coord.y));
            if tile.explored_at.is_zero() {
                InternalMapSystemsImpl::explore(ref world, entity_id.into(), coord, array![(1, 0)].span());
            }

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
            frontend: ContractAddress
        ) {
            // get bridge systems address
            let (bridge_systems_address, _namespace_hash) =
                match world.dispatcher.resource(selector_from_tag!("s0_eternum-resource_bridge_systems")) {
                dojo::world::Resource::Contract((
                    contract_address, namespace_hash
                )) => (contract_address, namespace_hash),
                _ => (Zeroable::zero(), Zeroable::zero())
            };

            // approve bridge to spend lords
            IERC20Dispatcher { contract_address: lords_address }.approve(bridge_systems_address, amount);

            // deposit lords
            IResourceBridgeSystemsDispatcher { contract_address: bridge_systems_address }
                .deposit_initial(lords_address, realm_entity_id, amount, frontend);
        }


        fn retrieve_metadata_from_season_pass(
            season_pass_address: ContractAddress, realm_id: ID
        ) -> (felt252, u8, u8, u8, u8, u8, u8, Array<u8>) {
            let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };
            let (name_and_attrs, _urla, _urlb) = season_pass.get_encoded_metadata(realm_id.try_into().unwrap());
            RealmNameAndAttrsDecodingImpl::decode(name_and_attrs)
        }

        fn get_new_location(ref world: WorldStorage) -> Coord {
            // ensure that the coord is not occupied by any other structure
            let mut found_coords = false;
            let mut coord: Coord = Coord { x: 0, y: 0 };
            let mut settlement_config: SettlementConfig = world.read_model(WORLD_CONFIG_ID);
            while (!found_coords) {
                coord = settlement_config.get_next_settlement_coord();
                let mut structure_count: StructureCount = world.read_model(coord);
                if structure_count.is_none() {
                    found_coords = true;
                    structure_count.count = 1;
                    world.write_model(@structure_count);
                }
                // save the new config so that if there's no already a structure at the coord we can find a new one
                world.write_model(@settlement_config);
            };

            return coord;
        }
    }
}
