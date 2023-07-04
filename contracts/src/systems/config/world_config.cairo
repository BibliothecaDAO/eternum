#[system]
mod SetWorldConfig {
    use traits::Into;

    use eternum::components::config::WorldConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    fn execute(realm_l2_contract: starknet::ContractAddress, ) {
        // TODO: can only be executed by Governance Vote
        let _ = commands::set_entity(WORLD_CONFIG_ID.into(), (WorldConfig { realm_l2_contract,  }));
    }
}
