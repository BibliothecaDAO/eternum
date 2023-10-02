#[system]
mod SetMercenaryConfig {

    use eternum::constants::MERCENARY_CONFIG_ID;
    use eternum::components::config::MercenaryConfig;

    use dojo::world::Context;

    fn execute(ctx: Context, sec_per_km: u16, weight_gram: u128) {

        set!(ctx.world, (
            MercenaryConfig {
                config_id: MERCENARY_CONFIG_ID,
                sec_per_km,
                weight_gram
            }
        ));
    }
}
