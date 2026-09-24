use starknet::Event;
use crate::ownership::{Story, StoryEvent};
use crate::resources::ResourceKey;

pub fn emit_entity_story(
    key: ResourceKey,
    actor: starknet::ContractAddress,
    story: Story,
    timestamp: u64,
    ref story_cursor: crate::ownership::StoryCursor,
) {
    let event = StoryEvent {
        version: 1,
        game_id: key.game_id,
        order: story_cursor.order,
        index: crate::ownership::StoryCursorTrait::next(ref story_cursor),
        owner: Some(actor),
        entity_id: Some(key.entity_id),
        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
        story,
        timestamp,
    };
    let mut keys = array![selector!("StoryEvent")];
    let mut data = array![];
    event.append_keys_and_data(ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}
