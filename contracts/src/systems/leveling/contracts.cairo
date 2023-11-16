#[dojo::contract]
mod leveling_systems {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::owner::{Owner};
    use eternum::models::config::{LevelingConfig};
    use eternum::models::realm::{Realm};
    use eternum::models::level::{Level, LevelTrait};

    use eternum::constants::{LEVELING_CONFIG_ID};

    use eternum::systems::leveling::interface::{ILevelingSystems};

    #[external(v0)]
    impl LevelingSystemsImpl of ILevelingSystems<ContractState> {
        
        fn level_up(
            self: @ContractState, world: IWorldDispatcher, 
            realm_entity_id: ID,
        ) {

            // check that entity is a realm
            let realm = get!(world, realm_entity_id, Realm);
            assert(realm.realm_id != 0, 'not a realm');

            // check realm ownership
            let caller = starknet::get_caller_address();
            let realm_owner = get!(world, realm_entity_id, Owner);
            assert(
                realm_owner.address == caller,
                    'not realm owner'
            );

            // leveling cost
            let mut level = get!(world, (realm_entity_id), Level);

            // assert that level is not 3 already
            assert(level.get_level() != 3, 'max level reached');

            // check that realm has enough resources to level up
            let leveling_config: LevelingConfig = get!(world, LEVELING_CONFIG_ID, LevelingConfig);

            let mut index = 0;
            loop {
                if index == leveling_config.resource_cost_count {
                    break;
                }

                let resource_cost 
                    = get!(world, (leveling_config.resource_cost_id, index), ResourceCost);
                let mut realm_resource 
                    = get!(world, (realm_entity_id, resource_cost.resource_type), Resource);

                assert(
                    realm_resource.balance >= resource_cost.amount,
                        'insufficient resources'
                );

                realm_resource.balance -= resource_cost.amount;
                set!(world, (realm_resource));

                index += 1;
            };

            // level up
            level.level = level.get_level() + 1;
            // one week of leveling
            let ts = starknet::get_block_timestamp();
            level.valid_until = ts + 604800;
            set!(world, (level));
        }   
    }
}
