#[system]
mod WorldConfig {
    use traits::Into;

    use eternum::components::config::WorldConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    fn execute(
        day_unix: u128,
        vault_bp: u128,
        base_resources_per_day: u128,
        vault_unix: u128,
        lords_per_day: u128,
        tick_time: u128,
        realm_l2_contract: starknet::ContractAddress
    ) {
        // TODO: can only be executed by Governance Vote
        let _ = commands::set_entity(
            WORLD_CONFIG_ID.into(),
            (WorldConfig {
                day_unix,
                vault_bp,
                base_resources_per_day,
                vault_unix,
                lords_per_day,
                tick_time,
                realm_l2_contract
            })
        );
    }
}
