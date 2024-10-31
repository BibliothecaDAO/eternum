use eternum::alias::ID;
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
trait IRealmSystems {
    fn create(
        ref world: IWorldDispatcher, owner: starknet::ContractAddress, realm_id: ID, frontend: ContractAddress
    ) -> ID;
    fn upgrade_level(ref world: IWorldDispatcher, realm_id: ID);
    fn quest_claim(ref world: IWorldDispatcher, quest_id: ID, entity_id: ID);
}

#[dojo::contract]
mod realm_systems {
    use eternum::alias::ID;
    use eternum::constants::REALM_ENTITY_TYPE;
    use eternum::constants::{WORLD_CONFIG_ID, REALM_FREE_MINT_CONFIG_ID};
    use eternum::models::capacity::{CapacityCategory};
    use eternum::models::config::{CapacityConfigCategory, RealmLevelConfig, SettlementConfig, SettlementConfigImpl};
    use eternum::models::config::{QuestRewardConfig, QuestConfig, SeasonConfig, ProductionConfig};
    use eternum::models::event::{SettleRealmData, EventType};
    use eternum::models::map::Tile;
    use eternum::models::movable::Movable;
    use eternum::models::name::{AddressName};
    use eternum::models::owner::{Owner, EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::position::{Position, Coord};
    use eternum::models::production::{ProductionOutput};
    use eternum::models::quantity::QuantityTracker;
    use eternum::models::quest::{Quest, QuestBonus};
    use eternum::models::realm::{
        Realm, RealmCustomTrait, RealmCustomImpl, RealmResourcesTrait, RealmResourcesImpl,
        RealmNameAndAttrsDecodingTrait, RealmNameAndAttrsDecodingImpl
    };
    use eternum::models::resources::{
        DetachedResource, Resource, ResourceCustomImpl, ResourceCustomTrait, ResourceFoodImpl, ResourceFoodTrait
    };

    use eternum::models::season::SeasonImpl;
    use eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;
    use eternum::systems::resources::contracts::resource_bridge_systems::{
        IResourceBridgeSystemsDispatcher, IResourceBridgeSystemsDispatcherTrait
    };

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
        fn create(ref world: IWorldDispatcher, owner: ContractAddress, realm_id: ID, frontend: ContractAddress) -> ID {
            // check that season is still active
            SeasonImpl::assert_season_is_not_over(world);

            // collect season pass
            let season: SeasonConfig = get!(world, WORLD_CONFIG_ID, SeasonConfig);
            InternalRealmLogicImpl::collect_season_pass(season.season_pass_address, realm_id);

            // retrieve realm metadata
            let (realm_name, regions, cities, harbors, rivers, wonder, order, resources) =
                InternalRealmLogicImpl::retrieve_metadata_from_season_pass(
                season.season_pass_address, realm_id
            );

            // create realm
            let mut coord: Coord = InternalRealmLogicImpl::get_new_location(world);
            let (entity_id, realm_produced_resources_packed) = InternalRealmLogicImpl::create_realm(
                world, owner, realm_id, resources, order, 0, coord
            );

            // collect lords attached to season pass and bridge into the realm
            let lords_amount_attached: u256 = InternalRealmLogicImpl::collect_lords_from_season_pass(
                season.season_pass_address, realm_id
            );

            // bridge attached lords into the realm
            if lords_amount_attached.is_non_zero() {
                InternalRealmLogicImpl::bridge_lords_into_realm(
                    world, season.lords_address, entity_id, lords_amount_attached, frontend
                );
            }

            // emit realm settle event
            emit!(
                world,
                (SettleRealmData {
                    id: world.dispatcher.uuid(),
                    event_id: EventType::SettleRealm,
                    entity_id,
                    owner_address: owner,
                    owner_name: get!(world, owner, AddressName).name,
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
                }),
            );

            entity_id.into()
        }


        fn upgrade_level(ref world: IWorldDispatcher, realm_id: ID) {
            // ensure caller owns the realm
            get!(world, realm_id, EntityOwner).assert_caller_owner(world);

            // ensure entity is a realm
            let mut realm = get!(world, realm_id, Realm);
            realm.assert_is_set();

            // ensure realm is not already at max level
            assert(realm.level < realm.max_level(world), 'realm is already at max level');

            // make payment to upgrade to next level
            let next_level = realm.level + 1;
            let realm_level_config = get!(world, next_level, RealmLevelConfig);
            let required_resources_id = realm_level_config.required_resources_id;
            let required_resource_count = realm_level_config.required_resource_count;
            let mut index = 0;
            loop {
                if index == required_resource_count {
                    break;
                }

                let mut required_resource = get!(world, (required_resources_id, index), DetachedResource);

                // burn resource from realm
                let mut realm_resource = ResourceCustomImpl::get(world, (realm_id, required_resource.resource_type));
                realm_resource.burn(required_resource.resource_amount);
                realm_resource.save(ref world);
                index += 1;
            };

            // set new level
            realm.level = next_level;
            set!(world, (realm));
        }

        fn quest_claim(ref world: IWorldDispatcher, quest_id: ID, entity_id: ID) {
            // ensure season is still active
            SeasonImpl::assert_season_is_not_over(world);

            // ensure entity is a realm
            let realm = get!(world, (entity_id), Realm);
            realm.assert_is_set();

            // ensure quest is not already completed
            let mut quest: Quest = get!(world, (entity_id, quest_id), Quest);
            assert(!quest.completed, 'quest already completed');

            // get index
            let quest_config: QuestConfig = get!(world, WORLD_CONFIG_ID, QuestConfig);
            let quest_reward_config: QuestRewardConfig = get!(world, quest_id, QuestRewardConfig);
            let mut index = 0;
            loop {
                if index == quest_reward_config.detached_resource_count {
                    break;
                }

                // get reward resource
                let mut detached_resource = get!(
                    world, (quest_reward_config.detached_resource_id, index), DetachedResource
                );
                let reward_resource_type = detached_resource.resource_type;
                let mut reward_resource_amount = detached_resource.resource_amount;

                let mut quest_bonus: QuestBonus = get!(world, (entity_id, reward_resource_type), QuestBonus);

                // scale reward resource amount by quest production multiplier
                // if the reward resource is used to produce another resource in the realm.
                // it will only be scaled if the quest bonus has not been claimed yet and
                // the reward resource is not food.
                if !quest_bonus.claimed && !ResourceFoodImpl::is_food(reward_resource_type) {
                    let reward_resource_production_config: ProductionConfig = get!(
                        world, reward_resource_type, ProductionConfig
                    );
                    let mut jndex = 0;
                    loop {
                        if jndex == reward_resource_production_config.output_count {
                            break;
                        }

                        let output_resource_type = get!(world, (reward_resource_type, jndex), ProductionOutput)
                            .output_resource_type;
                        if realm.produces_resource(output_resource_type) {
                            // scale reward resource amount by quest production multiplier
                            reward_resource_amount *= quest_config.production_material_multiplier.into();
                            // set quest bonus as claimed
                            quest_bonus.claimed = true;
                            set!(world, (quest_bonus));

                            break;
                        }

                        jndex += 1;
                    }
                }

                let mut realm_resource = ResourceCustomImpl::get(world, (entity_id.into(), reward_resource_type));
                realm_resource.add(reward_resource_amount);
                realm_resource.save(ref world);

                index += 1;
            };

            quest.completed = true;
            set!(world, (quest));
        }
    }


    #[generate_trait]
    impl InternalRealmLogicImpl of InternalRealmLogicTrait {
        fn create_realm(
            world: IWorldDispatcher,
            owner: ContractAddress,
            realm_id: ID,
            resources: Array<u8>,
            order: u8,
            level: u8,
            coord: Coord
        ) -> (ID, u128) {
            // create realm
            let realm_produced_resources_packed = RealmResourcesImpl::pack_resource_types(resources.span());
            let entity_id = world.dispatcher.uuid();
            let now = starknet::get_block_timestamp();
            set!(
                world,
                (
                    Owner { entity_id: entity_id.into(), address: owner },
                    EntityOwner { entity_id: entity_id.into(), entity_owner_id: entity_id.into() },
                    Structure { entity_id: entity_id.into(), category: StructureCategory::Realm, created_at: now, },
                    StructureCount { coord, count: 1 },
                    CapacityCategory { entity_id: entity_id.into(), category: CapacityConfigCategory::Structure },
                    Realm {
                        entity_id: entity_id.into(),
                        realm_id,
                        produced_resources: realm_produced_resources_packed,
                        order,
                        level
                    },
                    Position { entity_id: entity_id.into(), x: coord.x, y: coord.y, },
                )
            );

            // explore tile where realm sits if not already explored
            let mut tile: Tile = get!(world, (coord.x, coord.y), Tile);
            if tile.explored_at.is_zero() {
                InternalMapSystemsImpl::explore(world, entity_id.into(), coord, array![(1, 0)].span());
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

            // at this point, this contract's lords balance must have increased by `token_lords_balance`
            token_lords_balance
        }


        fn bridge_lords_into_realm(
            world: IWorldDispatcher,
            lords_address: ContractAddress,
            realm_entity_id: ID,
            amount: u256,
            frontend: ContractAddress
        ) {
            // get bridge systems address
            let (_bridge_systems_class_hash, bridge_systems_address) =
                match world.resource(selector_from_tag!("eternum-resource_bridge_systems")) {
                dojo::world::Resource::Contract((class_hash, contract_address)) => (class_hash, contract_address),
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

        fn get_new_location(world: IWorldDispatcher) -> Coord {
            // ensure that the coord is not occupied by any other structure
            let timestamp = starknet::get_block_timestamp();
            let mut found_coords = false;
            let mut coord: Coord = Coord { x: 0, y: 0 };
            let mut settlement_config = get!(world, WORLD_CONFIG_ID, SettlementConfig);
            while (!found_coords) {
                coord = settlement_config.get_next_settlement_coord(timestamp);
                let structure_count: StructureCount = get!(world, coord, StructureCount);
                if structure_count.is_none() {
                    found_coords = true;
                }
            };
            // save the new config
            set!(world, (settlement_config));

            return coord;
        }
    }
}
