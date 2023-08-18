#[system]
mod SetLaborCostResources {
    use traits::Into;
    use eternum::components::config::LaborCostResources;

    use dojo::world::Context;

    fn execute(
        ctx: Context,
        resource_type_labor: felt252,
        resource_types_packed: u128,
        resource_types_count: u8
    ) {
        // set cost of creating labor for resource id 1 to only resource id 1 cost
        let _ = set!(
            ctx.world,
            (LaborCostResources {
                resource_type_labor, resource_types_packed, resource_types_count, 
            })
        );
    }
}

#[system]
mod SetLaborCostAmount {
    use traits::Into;
    use eternum::components::config::LaborCostAmount;

    use dojo::world::Context;

    fn execute(
        ctx: Context,
        resource_type_labor: felt252,
        resource_type_cost: felt252,
        resource_type_value: u128
    ) {
        let _ = set!(
            ctx.world,
            (LaborCostAmount {
                resource_type_labor, resource_type_cost, value: resource_type_value
            })
        );
    }
}

#[system]
mod SetLaborConfig {
    use traits::Into;
    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::components::config::LaborConfig;

    use dojo::world::Context;

    fn execute(
        ctx: Context,
        base_labor_units: u64,
        base_resources_per_cycle: u128,
        base_food_per_cycle: u128
    ) {
        // set labor config
        let _ = set!(
            ctx.world,
            (LaborConfig {
                config_id: LABOR_CONFIG_ID,
                base_labor_units,
                base_resources_per_cycle,
                base_food_per_cycle
            })
        );
    }
}
