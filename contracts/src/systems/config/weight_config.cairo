#[system]
mod SetWeightConfig {
    use traits::Into;
    use eternum::components::config::WeightConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    fn execute(entity_type: u128, weight_gram: u128) {
        commands::<WeightConfig>::set_entity(
            (WORLD_CONFIG_ID, entity_type).into(), (WeightConfig { entity_type, weight_gram,  })
        );
    }
}
