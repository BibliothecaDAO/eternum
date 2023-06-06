#[system]
mod SetCapacityConfig {
    use traits::Into;
    use eternum::components::config::CapacityConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    fn execute(entity_type: u128, weight_gram: u128) {
        // set cost of creating labor for resource id 1 to only resource id 1 cost
        commands::<CapacityConfig>::set_entity(
            (WORLD_CONFIG_ID, entity_type).into(), (CapacityConfig { entity_type, weight_gram,  })
        );
    }
}
