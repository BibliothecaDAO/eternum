mod internal_leveling_systems {

    use eternum::constants::{ResourceTypes};
    use eternum::models::resources::Resource;
    use eternum::models::level::Level;
    use eternum::models::position::Position;

    use eternum::utils::testing::{spawn_eternum, deploy_system};

    use core::traits::Into;
    use core::option::OptionTrait;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use eternum::systems::leveling::contracts::leveling_systems::{InternalLevelingSystemsImpl as leveling};


    use eternum::systems::config::contracts::config_systems;
    use eternum::systems::config::interface::{
        ILevelingConfigDispatcher,
        ILevelingConfigDispatcherTrait,
    };

    const LEVELING_CONFIG_ID: u128 = 8888;

    fn setup() -> (IWorldDispatcher, u128) {
        let world = spawn_eternum();

        // define leveling config 

        let decay_scaled: u128 = 1844674407370955161;
        let base_multiplier: u128 = 25;
        // 25%
        let cost_percentage_scaled: u128 = 4611686018427387904;
        // half a day of average production
        let wheat_base_amount: u128 = 3780;
        // half a day of average production
        let fish_base_amount: u128 = 1260;
        let decay_interval = 604600;
        let max_level = 1000;

        // 3 tier resources
        let mut resource_1_costs 
            = array![(ResourceTypes::WOOD, 1000), (ResourceTypes::STONE, 1000)].span();
        let mut resource_2_costs 
            = array![(ResourceTypes::COAL, 1000), (ResourceTypes::COPPER, 1000)].span();
        let mut resource_3_costs 
            = array![(ResourceTypes::OBSIDIAN, 1000), (ResourceTypes::SILVER, 1000)].span();


        let config_systems_address 
            = deploy_system(config_systems::TEST_CLASS_HASH);
        let level_config_dispatcher = ILevelingConfigDispatcher {
            contract_address: config_systems_address
        };

        level_config_dispatcher.set_leveling_config(
            world,
            LEVELING_CONFIG_ID,
            decay_interval,
            max_level,
            decay_scaled,
            cost_percentage_scaled,
            base_multiplier,
            wheat_base_amount,
            fish_base_amount,
            resource_1_costs,
            resource_2_costs,
            resource_3_costs
        );

        let entity_id = 44;



        // mint 100_000 of each resource for the entity;
        let mut resources = array![
            ResourceTypes::WHEAT, ResourceTypes::FISH, ResourceTypes::WOOD,
            ResourceTypes::STONE, ResourceTypes::COAL, ResourceTypes::COPPER,
            ResourceTypes::OBSIDIAN, ResourceTypes::SILVER,
        ];
        starknet::testing::set_contract_address(world.executor());
        loop {
            match resources.pop_front() {
                Option::Some(resource_type) => {
                    set!(world, (
                        Resource {
                            entity_id: entity_id,
                            resource_type,
                            balance: 100_000
                        }
                    ));
                    
                },
                Option::None => {break;},
            }
        };

        (world, entity_id)
    }


    #[test]
    #[available_gas(300000000000)]
    fn test_level_up() {
        let (world, entity_id) = setup();

        let level = get!(world, (entity_id), Level);
        assert(level.level == 0, 'wrong level');

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );

        // assert resources are the right amount
        let wheat_resource = get!(world, (entity_id, ResourceTypes::WHEAT), Resource);
        assert(wheat_resource.balance == 96220, 'failed resource amount');

        let fish_resource = get!(world, (entity_id, ResourceTypes::FISH), Resource);
        assert(fish_resource.balance == 98740, 'failed resource amount');

        let wood_resource = get!(world, (entity_id, ResourceTypes::WOOD), Resource);
        assert(wood_resource.balance == 100000, 'failed resource amount');

        let level = get!(world, entity_id, Level);
        assert(level.level == 1, 'wrong level');

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );

        // assert resources are the right amount
        let wheat_resource = get!(world, (entity_id, ResourceTypes::WHEAT), Resource);
        assert(wheat_resource.balance == 96220, 'failed resource amount');

        let fish_resource = get!(world, (entity_id, ResourceTypes::FISH), Resource);
        assert(fish_resource.balance == 98740, 'failed resource amount');

        let wood_resource = get!(world, (entity_id, ResourceTypes::WOOD), Resource);
        assert(wood_resource.balance == 99000, 'failed resource amount');

        let stone_resource = get!(world, (entity_id, ResourceTypes::STONE), Resource);
        assert(stone_resource.balance == 99000, 'failed resource amount');

        let level = get!(world, entity_id, Level);
        assert(level.level == 2, 'wrong level');

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );


        let coal_resource = get!(world, (entity_id, ResourceTypes::COAL), Resource);
        assert(coal_resource.balance == 99000, 'failed resource amount');

        let copper_resource = get!(world, (entity_id, ResourceTypes::COPPER), Resource);
        assert(copper_resource.balance == 99000, 'failed resource amount');

        let level = get!(world, entity_id, Level);
        assert(level.level == 3, 'wrong level');    

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );

        let obsidian_resource = get!(world, (entity_id, ResourceTypes::OBSIDIAN), Resource);
        assert(obsidian_resource.balance == 99000, 'failed resource amount');

        let silver_resource = get!(world, (entity_id, ResourceTypes::SILVER), Resource);
        assert(silver_resource.balance == 99000, 'failed resource amount');

        let level = get!(world, entity_id, Level);
        assert(level.level == 4, 'wrong level');    

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );


        let wheat_resource = get!(world, (entity_id, ResourceTypes::WHEAT), Resource);
        assert(wheat_resource.balance == 91495, 'failed resource amount');

        let level = get!(world, entity_id, Level);
        assert(level.level == 5, 'wrong level');    

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );


        let level = get!(world, entity_id, Level);
        assert(level.level == 6, 'wrong level');    

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );


        let level = get!(world, entity_id, Level);
        assert(level.level == 7, 'wrong level');    

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );

        let level = get!(world, entity_id, Level);
        assert(level.level == 8, 'wrong level');    

        // level up 
        leveling::level_up(
            world,
            entity_id,
            LEVELING_CONFIG_ID
        );

        let level = get!(world, entity_id, Level);
        assert(level.level == 9, 'wrong level');    

        let wheat_resource = get!(world, (entity_id, ResourceTypes::WHEAT), Resource);
        assert(wheat_resource.balance == 85599, 'failed resource amount');

        let silver_resource = get!(world, (entity_id, ResourceTypes::SILVER), Resource);
        assert(silver_resource.balance == 97750, 'failed resource amount');
    }

}