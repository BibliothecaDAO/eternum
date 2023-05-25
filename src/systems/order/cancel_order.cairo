// TODO
#[system]
mod CancelOrder {
    use eternum::alias::ID;
    use eternum::constants::LORDS_ID;
    use eternum::components::realm::Realm;
    use eternum::components::owner::Owner;
    use eternum::components::resources::Resource;
    use eternum::components::order::Order;
    use eternum::components::position::Position;
    // use eternum::components::lords::Lords;

    use starknet::ContractAddress;

    use traits::Into;
    // use array::ArrayTrait;
    use box::BoxTrait;

    #[external]
    fn execute(order_id: ID) { // TODO
    }
}
