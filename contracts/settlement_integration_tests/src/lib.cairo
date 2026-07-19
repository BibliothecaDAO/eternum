pub mod generated_dispatcher_conformance;

#[cfg(test)]
mod tests {
    use settlement_integration_tests::generated_dispatcher_conformance::{
        PROTOCOL_DISPATCHER_COUNT, protocol_dispatcher_addresses,
    };
    use starknet::ContractAddress;

    #[test]
    fn every_frozen_protocol_dispatcher_compiles_from_the_dependency_leaf() {
        let address: ContractAddress = 1.try_into().unwrap();
        let dispatchers = protocol_dispatcher_addresses(address);

        assert!(dispatchers.len() == PROTOCOL_DISPATCHER_COUNT.into());
        for dispatcher_address in dispatchers {
            assert!(dispatcher_address == address);
        }
    }
}
