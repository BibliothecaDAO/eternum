#[system]
mod SetSpeedConfig {
    use traits::Into;
    use eternum::components::config::SpeedConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_type: u128, sec_per_km: u16) {
        set !(
            ctx.world,
            (WORLD_CONFIG_ID, entity_type).into(), (SpeedConfig { entity_type, sec_per_km,  })
        );
    }
}
