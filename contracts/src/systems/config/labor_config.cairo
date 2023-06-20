#[system]
mod SetLaborCostResources {
    use traits::Into;
    use eternum::components::config::LaborCostResources;

    fn execute(
        resource_type_labor: felt252, resource_types_packed: u128, resource_types_count: u8
    ) {
        // set cost of creating labor for resource id 1 to only resource id 1 cost
        commands::<LaborCostResources>::set_entity(
            resource_type_labor.into(),
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

    fn execute(
        resource_type_labor: felt252, resource_type_cost: felt252, resource_type_value: u128
    ) {
        commands::<LaborCostAmount>::set_entity(
            (resource_type_labor, resource_type_cost).into(),
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

    fn execute(base_labor_units: u128, vault_percentage: u128, base_resources_per_cycle: u128) {
        // set labor config
        commands::<LaborConfig>::set_entity(
            (LABOR_CONFIG_ID).into(),
            (LaborConfig { base_labor_units, vault_percentage, base_resources_per_cycle })
        );
    }
}
