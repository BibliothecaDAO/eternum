use crate::game::PointActivity;
use crate::ownership::{Story, StructureCapturedStory};
use crate::resources::ResourceKey;
use crate::structures::Structure;

pub fn capture(key: ResourceKey, capturing_home: u64, target: Structure, timestamp: u64) {
    let owner = crate::logic::structures::owner(ResourceKey { game_id: key.game_id, entity_id: capturing_home });
    assert!(owner != 0.try_into().unwrap(), "capturing home is unowned");
    crate::logic::guards::GuardState::reset(key);
    crate::logic::structures::StructureState::transfer_owner(key, owner);
    if target.owner == 0.try_into().unwrap() {
        crate::logic::blitz::points::award(
            key.game_id, owner, PointActivity::StructureCapture, crate::balance::points::CAPTURE_POINTS,
        );
    }
    crate::logic::stories::emit_entity_story(
        key,
        owner,
        Story::StructureCapturedStory(StructureCapturedStory { previous_owner: target.owner, new_owner: owner }),
        timestamp,
    );
}
