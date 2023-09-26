#[system]
mod SetRoadConfig {

    use eternum::constants::ROAD_CONFIG_ID;
    use eternum::components::config::RoadConfig;

    use dojo::world::Context;

    fn execute(ctx: Context, fee_resource_type: u8, fee_amount: u128, speed_up_by: u64 ) {
        set!(ctx.world, (
            RoadConfig { 
                config_id: ROAD_CONFIG_ID, 
                fee_resource_type,
                fee_amount,
                speed_up_by
            }
        ));
    }
}
