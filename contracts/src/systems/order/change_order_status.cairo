// TODO: testing
#[system]
mod ChangeOrderStatus {
    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::trade::{Trade, Status, TradeStatus};

    use box::BoxTrait;
    use traits::Into;

    use dojo::world::Context;

    // TODO: change back to enum when works with torii
    #[external]
    fn execute(ctx: Context, entity_id: u128, trade_id: u128, new_status: u128) {
        // assert that the trade is open or cancelled
        let (meta, current_status) = get !(ctx.world, trade_id.into(), (Trade, Status));
        // TODO: how to compare enum?
        // assert(current_status.value == TradeStatus::Open, 'Order already executed');

        // assert that caller is owner of the maker_id
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let owner = get !(ctx.world, meta.maker_id.into(), Owner);
        assert(owner.address == caller, 'not owned by caller');

        // assert that status is not the same
        // TODO: how to compare enum?
        // assert(current_status.value != new_status, 'status is the same');

        // set new status
        set !(ctx.world, trade_id.into(), (Status { value: new_status }));
    }
}
