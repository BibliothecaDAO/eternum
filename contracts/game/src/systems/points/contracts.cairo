use starknet::ContractAddress;

#[starknet::interface]
trait IPointSystems<T> {
    fn view_registered_points(
        self: @T, game_id: u32, players: Array<ContractAddress>,
    ) -> Array<(ContractAddress, u128)>;
}


#[dojo::contract]
pub mod point_systems {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use starknet::ContractAddress;
    use crate::constants::DEFAULT_NS;
    use crate::models::hyperstructure::PlayerRegisteredPoints;


    #[abi(embed_v0)]
    impl PointSystemsImpl of super::IPointSystems<ContractState> {
        fn view_registered_points(
            self: @ContractState, game_id: u32, players: Array<ContractAddress>,
        ) -> Array<(ContractAddress, u128)> {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut result: Array<(ContractAddress, u128)> = array![];
            for player in players {
                let player_points: PlayerRegisteredPoints = world.read_model((game_id, player));
                result.append((player, player_points.registered_points));
            }
            return result;
        }
    }
}
