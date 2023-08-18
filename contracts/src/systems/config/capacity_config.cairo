#[system]
mod SetCapacityConfig {
    use traits::Into;
    use eternum::components::config::CapacityConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_type: u128, weight_gram: u128) {
        // set cost of creating labor for resource id 1 to only resource id 1 cost
        set!(
            ctx.world,
            (CapacityConfig {
                config_id: WORLD_CONFIG_ID,
                carry_capacity_config_id: entity_type,
                entity_type,
                weight_gram,
            })
        );
    }
}
