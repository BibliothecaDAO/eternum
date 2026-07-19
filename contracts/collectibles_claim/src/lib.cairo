pub mod contracts {
    pub mod cosmetics;
}
pub mod utils {
    pub mod cartridge;
    pub mod random;
}
pub mod tests {
    pub mod mocks {
        pub mod account;
        pub mod contracts;
    }
    mod test_cosmetics_claim;
}
