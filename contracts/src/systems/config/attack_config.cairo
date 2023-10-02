#[system]
mod SetAttackConfig {

    use eternum::constants::ATTACK_CONFIG_ID;
    use eternum::components::config::AttackConfig;

    use dojo::world::Context;

    fn execute(
            ctx: Context,
            min_attack_distance: u32, 
            min_cooldown_minutes: u64,
            fee_resource_type: u8, 
            fee_amount: u128,
            value: u8
        ) {

        set!(ctx.world, (
            AttackConfig {
                config_id: ATTACK_CONFIG_ID,
                min_attack_distance,
                min_cooldown_minutes,
                fee_resource_type,
                fee_amount,
                value
            }
        ));
    }
}
