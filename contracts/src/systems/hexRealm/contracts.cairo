#[dojo::contract]
mod realm_construction {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::owner::Owner;
    use eternum::models::hyperstructure::{HyperStructure};
    use eternum::models::realm::{Realm};
    use eternum::models::order::{Orders};
    use eternum::models::position::{Coord, Position, PositionTrait};

    use eternum::systems::hyperstructure::interface::IHyperstructureSystems;
    use eternum::constants::WORLD_CONFIG_ID;


    #[abi(embed_v0)]
    impl HyperstructureSystemsImpl of IHyperstructureSystems<ContractState> {
        fn start_production() { // starts production on a Resource
        // this will keep producing until either the supply is full or the inputs are depleted

        // calculate total production per tick
        // resource buildings on realm + production bonuses
        // calculate timestamp when no more resources are available
        // save timestamp

        }

        fn build_building() { // this is called on any change to any production
        // builds building on Realm Hex
        // checks if building is allowed
        // checks if building is affordable
        }

        fn lazy_harvest() { // this is called on any change to any production
        }
    }
}
