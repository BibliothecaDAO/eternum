trait TaskTrait {
    fn identifier() -> felt252;
    fn description(difficulty: u8, count: u32) -> ByteArray;
}
