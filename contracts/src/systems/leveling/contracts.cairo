use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait ILevelingSystems {
    fn level_up_realm(realm_entity_id: ID);
}

#[dojo::contract]
mod leveling_systems {
    use eternum::alias::ID;

    use eternum::constants::{
        REALM_LEVELING_CONFIG_ID, LevelIndex, ResourceTypes, REALM_LEVELING_START_TIER,
        HYPERSTRUCTURE_LEVELING_START_TIER
    };
    use eternum::models::config::{LevelingConfig};
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::owner::{Owner};
    use eternum::models::realm::{Realm};
    use eternum::models::resources::ResourceTrait;
    use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};

    use eternum::systems::leveling::contracts::leveling_systems::{
        InternalLevelingSystemsImpl as leveling
    };

    #[abi(embed_v0)]
    impl LevelingSystemsImpl of super::ILevelingSystems<ContractState> {
        fn level_up_realm(world: IWorldDispatcher, realm_entity_id: ID,) {
            // check that entity is a realm
            let realm = get!(world, realm_entity_id, Realm);
            assert(realm.realm_id != 0, 'not a realm');

            // check realm ownership
            let caller = starknet::get_caller_address();
            let realm_owner = get!(world, realm_entity_id, Owner);
            assert(realm_owner.address == caller, 'not realm owner');

            leveling::level_up(world, realm_entity_id, REALM_LEVELING_CONFIG_ID);
        }
    }


    #[generate_trait]
    impl InternalLevelingSystemsImpl of InternalLevelingSystemsTrait {
        fn get_realm_level_bonus(
            world: IWorldDispatcher, realm_entity_id: ID, leveling_index: u8
        ) -> u128 {
            let level = get!(world, (realm_entity_id), Level);
            let leveling_config: LevelingConfig = get!(
                world, REALM_LEVELING_CONFIG_ID, LevelingConfig
            );
            level.get_index_multiplier(leveling_config, leveling_index, REALM_LEVELING_START_TIER)
        }

        fn level_up(world: IWorldDispatcher, entity_id: ID, leveling_config_id: ID) {
            // leveling cost
            let mut level = get!(world, (entity_id), Level);

            // check that entity has enough resources to level up
            let leveling_config: LevelingConfig = get!(world, (leveling_config_id), LevelingConfig);

            let current_level = level.get_level();

            assert(current_level < leveling_config.max_level, 'reached max level');

            let cost_multiplier = level.get_cost_multiplier(leveling_config.cost_percentage_scaled);
            let next_index: u8 = (current_level % 4 + 1).try_into().unwrap();

            if (next_index == LevelIndex::FOOD) {
                let wheat_cost = (cost_multiplier * leveling_config.wheat_base_amount) / 100;
                let mut wheat = ResourceImpl::get(world, (entity_id, ResourceTypes::WHEAT));
                wheat.burn(wheat_cost);
                wheat.save(world);

                let fish_cost = (cost_multiplier * leveling_config.fish_base_amount) / 100;
                let mut fish = ResourceImpl::get(world, (entity_id, ResourceTypes::FISH));
                fish.burn(fish_cost);
                fish.save(world);
            } else {
                let mut resource_cost_id: u128 = 0;
                let mut resource_cost_len: u32 = 0;

                if (next_index == LevelIndex::RESOURCE) {
                    resource_cost_id = leveling_config.resource_1_cost_id;
                    resource_cost_len = leveling_config.resource_1_cost_count;
                } else if (next_index == LevelIndex::TRAVEL) {
                    resource_cost_id = leveling_config.resource_2_cost_id;
                    resource_cost_len = leveling_config.resource_2_cost_count;
                } else if (next_index == LevelIndex::COMBAT) {
                    resource_cost_id = leveling_config.resource_3_cost_id;
                    resource_cost_len = leveling_config.resource_3_cost_count;
                }

                let mut index = 0;
                loop {
                    if index == resource_cost_len {
                        break;
                    }

                    let resource_cost = get!(world, (resource_cost_id, index), ResourceCost);

                    let total_cost = (cost_multiplier * resource_cost.amount) / 100;

                    let mut resource = ResourceImpl::get(
                        world, (entity_id, resource_cost.resource_type)
                    );
                    assert(resource.balance >= total_cost, 'not enough resource');
                    resource.burn(total_cost);
                    resource.save(world);

                    index += 1;
                }
            }

            // level up
            level.level = current_level + 1;
            // one week of leveling
            let ts = starknet::get_block_timestamp();
            // 604800
            level.valid_until = ts.into() + leveling_config.decay_interval;
            set!(world, (level));
        }
    }
}
