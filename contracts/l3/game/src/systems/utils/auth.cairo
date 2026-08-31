use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use crate::constants::WORLD_CONFIG_ID;
use crate::models::config::ChainConfig;
use crate::models::game::GameRegistryImpl;

#[generate_trait]
pub impl iGameAdminImpl of iGameAdminTrait {
    fn is_chain_admin(world: WorldStorage) -> bool {
        let chain_config: ChainConfig = world.read_model(WORLD_CONFIG_ID);
        starknet::get_caller_address() == chain_config.admin_address
    }

    fn assert_chain_admin(world: WorldStorage) {
        assert!(Self::is_chain_admin(world), "Eternum: caller is not admin");
    }

    fn assert_dev_mode(world: WorldStorage, game_id: u32) {
        let game = GameRegistryImpl::get(world, game_id);
        assert!(game.dev_mode_on, "Eternum: developer resources require dev mode");
    }
}
