// TODO
// - cancel
// - reopen
#[system]
mod CancelOrder {
    use eternum::alias::ID;
    use eternum::constants::LORDS_ID;
    use eternum::components::realm::Realm;
    use eternum::components::owner::Owner;
    use eternum::components::resources::Resource;
    use eternum::components::order::Order;
    use eternum::components::position::Position;

    use starknet::ContractAddress;

    use traits::Into;
    // use array::ArrayTrait;
    use box::BoxTrait;

    #[external]
    fn execute(entity_id: ID, trade_id: ID) {
        // assert caller is owner of the entity_id
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let owner = commands::<Owner>::entity(entity_id);
        assert(owner.address == caller, 'not owned by caller');

        // asset that the trade is open
        let (meta, status) = commands::<Meta, Status>::entity(trade_id);
        assert(status.value == Status::Open, 'Order already executed');
        // assert that the entity_id is the maker
        assert(meta.maker_id == entity_id, 'not the maker');

        // set new status
        commands::set_entity(trade_id, (Status { status: Status::Cancelled,  }));
    }
}

mod OpenOrder {
    use eternum::alias::ID;
    use eternum::constants::LORDS_ID;
    use eternum::components::realm::Realm;
    use eternum::components::owner::Owner;
    use eternum::components::resources::Resource;
    use eternum::components::order::Order;
    use eternum::components::position::Position;

    use starknet::ContractAddress;

    use traits::Into;
    // use array::ArrayTrait;
    use box::BoxTrait;

    #[external]
    fn execute(entity_id: ID, trade_id: ID) {
        // assert caller is owner of the entity_id
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let owner = commands::<Owner>::entity(entity_id);
        assert(owner.address == caller, 'not owned by caller');

        // asset that the trade is cancelled
        let (meta, status) = commands::<Meta, Status>::entity(trade_id);
        assert(status.value == Status::Cancelled, 'Order already executed');
        // assert that the entity_id is the maker
        assert(meta.maker_id == entity_id, 'not the maker');

        // set new status
        commands::set_entity(trade_id, (Status { status: Status::Open,  }));
    }
}
