#[system]
mod CreateLaborCostResources {
    use traits::Into;
    use eternum::components::config::LaborCostResources;

    fn execute(resource_id_labor: felt252, resource_ids_packed: u128, resource_ids_count: u8) {
        // set cost of creating labor for resource id 1 to only resource id 1 cost
        commands::<LaborCostResources>::set_entity(
            resource_id_labor.into(),
            (LaborCostResources {
                id: resource_id_labor,
                resource_ids_packed,
                resource_ids_count,
            })
        );
    }
}

#[system]
mod CreateLaborCostAmount {
    use traits::Into;
    use eternum::components::config::LaborCostAmount;

    fn execute(resource_id_labor: felt252, resource_id_cost: felt252, resource_id_value: u128) {
        commands::<LaborCostAmount>::set_entity(
            (resource_id_labor, resource_id_cost).into(),
            (LaborCostAmount {
                id: resource_id_labor, resource_id: resource_id_cost, value: resource_id_value
            })
        );
    }
}

#[system]
mod CreateLaborConfig {
    use traits::Into;
    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::components::config::LaborConfig;

    fn execute(base_labor_units: u128, vault_percentage: u128, base_resources_per_cycle: u128) {
        // set labor config
        commands::<LaborConfig>::set_entity(
            LABOR_CONFIG_ID.into(),
            (LaborConfig {
                base_labor_units,
                vault_percentage,
                base_resources_per_cycle
            })
        );
    }
}
