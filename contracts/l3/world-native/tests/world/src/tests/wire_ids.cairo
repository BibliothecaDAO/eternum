use crate::commands::{Command, route_command};
use crate::ownership::{Story, StructureLevelUpStory};

#[test]
fn commands_keep_their_original_tags_and_payloads_across_retired_holes() {
    let mut encoded = array![];
    Command::LevelUp(7).serialize(ref encoded);
    assert_eq!(encoded.span(), array![6, 7].span());
    let mut frame = encoded.span();
    assert_eq!(Serde::<Command>::deserialize(ref frame), Some(Command::LevelUp(7)));
    assert!(frame.is_empty());
    let (tag, _, payload) = route_command(encoded.span()).unwrap();
    assert_eq!(tag, 6);
    assert_eq!(payload, array![7].span());

    let mut encoded = array![];
    Command::MarkGameSettled.serialize(ref encoded);
    assert_eq!(encoded.span(), array![58].span());
}

#[test]
fn retired_command_tags_have_neither_a_route_nor_a_typed_command() {
    let routes = crate::command_routes::COMMAND_ROUTES.span();
    for index in 0..routes.len() {
        if routes.at(index).is_none() {
            let values = array![index.into(), 7];
            assert!(route_command(values.span()).is_err());
            let mut frame = values.span();
            assert!(Serde::<Command>::deserialize(ref frame).is_none());
        }
    }
}

#[test]
fn stories_keep_their_original_tags_and_reject_retired_tags() {
    let story = Story::StructureLevelUpStory(StructureLevelUpStory { new_level: 2 });
    let mut encoded = array![];
    story.serialize(ref encoded);
    assert_eq!(encoded.span(), array![1, 2].span());
    let mut frame = encoded.span();
    assert_eq!(Serde::<Story>::deserialize(ref frame), Some(story));
    assert!(frame.is_empty());
    let mut retired = array![0, 2].span();
    assert!(Serde::<Story>::deserialize(ref retired).is_none());
}
