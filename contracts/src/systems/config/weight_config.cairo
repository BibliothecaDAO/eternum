#[system]
mod SetWeightConfig {
    use traits::Into;
    use eternum::components::config::WeightConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_type: u128, weight_gram: u128) {
        set !(
            ctx.world,
            (WORLD_CONFIG_ID, entity_type).into(), (WeightConfig { entity_type, weight_gram,  })
        );
    }
}
