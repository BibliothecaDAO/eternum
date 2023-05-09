#[system]
mod CreateLaborCR {
    use traits::Into;
    use traits::TryInto;
    use array::ArrayTrait;
    use box::BoxTrait;
    use eternum::utils::unpack::unpack_resource_ids;
    use eternum::components::config::LaborCR;
    use eternum::components::config::LaborCV;

    use debug::PrintTrait;

    fn execute(resource_id_labor: felt252, resource_id_packed: u128, resource_id_count: u8) {
        // set cost of creating labor for resource id 1 to only resource id 1 cost
        commands::<LaborCR>::set_entity(
            resource_id_labor.into(),
            (LaborCR {
                id: resource_id_labor,
                resource_ids_packed: resource_id_packed,
                resource_ids_count: resource_id_count,
            })
        );
    }
}

#[system]
mod CreateLaborCV {
    use traits::Into;
    use traits::TryInto;
    use array::ArrayTrait;
    use box::BoxTrait;
    use eternum::utils::unpack::unpack_resource_ids;
    use eternum::components::config::LaborCR;
    use eternum::components::config::LaborCV;

    use debug::PrintTrait;

    fn execute(resource_id_labor: felt252, resource_id_cost: felt252, resource_id_value: u128) {
        commands::<LaborCV>::set_entity(
            (resource_id_labor, resource_id_cost).into(),
            (LaborCV {
                id: resource_id_labor, resource_id: resource_id_cost, value: resource_id_value
            })
        );
    }
}

#[system]
mod CreateLaborConf {
    use traits::Into;
    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::components::config::LaborConf;

    fn execute(base_labor_units: u128, vault_percentage: u128, base_resources_per_cycle: u128) {
        // set labor config
        commands::<LaborConf>::set_entity(
            LABOR_CONFIG_ID.into(),
            (LaborConf {
                base_labor_units: base_labor_units,
                vault_percentage: vault_percentage,
                base_resources_per_cycle: base_resources_per_cycle
            })
        );
    }
}
