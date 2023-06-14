// TODO: testing
#[system]
mod ChangeOrderStatus {
    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::trade::{Trade, Status, TradeStatus};

    use box::BoxTrait;
    use traits::Into;

    #[external]
    fn execute(entity_id: ID, trade_id: ID, new_status: TradeStatus) {
        // assert that the trade is open or cancelled
        let (meta, current_status) = commands::<Trade, Status>::entity(trade_id.into());
        // TODO: how to compare enum?
        // assert(current_status.value == TradeStatus::Open, 'Order already executed');

        // assert that caller is owner of the maker_id
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let owner = commands::<Owner>::entity(meta.maker_id.into());
        assert(owner.address == caller, 'not owned by caller');

        // assert that status is not the same
        // TODO: how to compare enum?
        // assert(current_status.value != new_status, 'status is the same');

        // set new status
        commands::set_entity(trade_id.into(), (Status { value: new_status }));
    }
}
