use snforge_std::{ContractClassTrait, DeclareResultTrait, EventSpyTrait, declare, spy_events};
use world_test_support::tests::event_transactions::{IEventTransactionsDispatcher, IEventTransactionsDispatcherTrait};

fn deploy() -> IEventTransactionsDispatcher {
    let (contract_address, _) = declare("EventTransactions").unwrap().contract_class().deploy(@array![]).unwrap();
    IEventTransactionsDispatcher { contract_address }
}

#[test]
fn event_transactions_keep_every_event_across_separate_calls() {
    let dispatcher = deploy();
    let mut events = spy_events();
    assert_eq!(dispatcher.emit_many(600), 600);
    assert_eq!(dispatcher.emit_many(600), 1200);
    let emitted = events.get_events().events;
    assert_eq!(emitted.len(), 1200);
    for index in 0..emitted.len() {
        let (address, event) = emitted.at(index);
        assert_eq!(*address, dispatcher.contract_address);
        assert_eq!(*event.keys.at(0), selector!("Count"));
        assert_eq!(*event.data.at(0), (index + 1).into());
    }
}

#[test]
#[ignore]
fn event_transactions_reject_one_oversized_call() {
    deploy().emit_many(1001);
}

#[test]
#[ignore]
fn event_transactions_reject_nested_calls_over_the_same_limit() {
    deploy().emit_nested(600);
}
