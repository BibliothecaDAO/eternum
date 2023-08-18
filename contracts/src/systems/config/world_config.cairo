#[system]
mod SetWorldConfig {
    use traits::Into;

    use eternum::components::config::WorldConfig;
    use eternum::constants::WORLD_CONFIG_ID;

    use dojo::world::Context;

    fn execute(ctx: Context, realm_l2_contract: starknet::ContractAddress, ) {
        // TODO: can only be executed by Governance Vote
        let _ = set!(ctx.world, (WorldConfig { config_id: WORLD_CONFIG_ID, realm_l2_contract }));
    }
}
