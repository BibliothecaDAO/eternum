pub mod contracts {
    pub mod cosmetics;
}
pub mod utils {
    pub mod cartridge;
    pub mod random;
}
pub mod tests {
    mod mocks {
        mod account;
        mod contracts;
    }
    mod test_cosmetics_claim;
}
