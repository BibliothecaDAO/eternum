use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use eternum_randomness_protocol::recording::ExecutionRecorded;
use snforge_std::{EventSpy, EventSpyTrait};

#[generate_trait]
pub impl RecordedReceipts of RecordedReceiptsTrait {
    fn recorded_outcome(
        self: IRecordedExecutionViewsDispatcher, game: felt252, order: u64,
    ) -> Option<ExecutionRecorded> {
        let mut offset = array![0].span();
        let mut spy: EventSpy = Serde::deserialize(ref offset).unwrap();
        for (emitter, event) in spy.get_events().events {
            if emitter != self.contract_address || event.keys.is_empty() {
                continue;
            }
            if *event.keys.at(event.keys.len() - 1) != selector!("ExecutionRecorded") {
                continue;
            }
            let mut data = event.data.span();
            let recorded: ExecutionRecorded = Serde::deserialize(ref data).expect('malformed execution event');
            assert!(data.is_empty(), "trailing execution event data");
            if recorded.game_id == game && recorded.order == order {
                return Some(recorded);
            }
        }
        None
    }
}
