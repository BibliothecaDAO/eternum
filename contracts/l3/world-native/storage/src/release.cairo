use starknet::ClassHash;

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct Release {
    pub family: u8,
    pub previous: u32,
    pub slot_count: u8,
    pub migration: ClassHash,
}
