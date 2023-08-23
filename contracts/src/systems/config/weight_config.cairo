#[system]
mod SetWeightConfig {
    use traits::Into;
    use eternum::components::config::WeightConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_type: u128, weight_gram: u128) {
        let _ = set!(
            ctx.world,
            (WeightConfig {
                config_id: WORLD_CONFIG_ID, weight_config_id: entity_type, entity_type, weight_gram, 
            })
        );
    }
}
