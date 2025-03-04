pub trait TaskTrait {
    fn identifier() -> felt252;
    fn description(count: u32) -> ByteArray;
}
