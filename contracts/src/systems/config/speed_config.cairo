#[system]
mod SetSpeedConfig {
    use traits::Into;
    use eternum::components::config::SpeedConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_type: u128, sec_per_km: u16) {
        let _ = set!(
            ctx.world,
            (SpeedConfig {
                config_id: WORLD_CONFIG_ID, speed_config_id: entity_type, entity_type, sec_per_km, 
            })
        );
    }
}
