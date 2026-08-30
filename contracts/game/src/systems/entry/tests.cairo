#[cfg(test)]
mod tests {
    use core::num::traits::zero::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorageTrait;
    use dojo_snf_test::{ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};
    use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
    use starknet::ContractAddress;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, WORLD_CONFIG_ID};
    use crate::models::config::{AgentControllerConfig, ChainConfig};
    use crate::models::ledger::LedgerRegistration;
    use crate::systems::entry::contracts::{IEntrySystemsDispatcher, IEntrySystemsDispatcherTrait};

    const GAME_ID: u32 = 7;

    fn addr(value: felt252) -> ContractAddress {
        value.try_into().unwrap()
    }

    fn setup() -> (dojo::world::WorldStorage, IEntrySystemsDispatcher, ContractAddress) {
        let operator = addr('operator');
        let mut world = spawn_test_world(
            [
                NamespaceDef {
                    namespace: DEFAULT_NS_STR(),
                    resources: [
                        TestResource::Model("ChainConfig"), TestResource::Model("LedgerRegistration"),
                        TestResource::Contract("entry_systems"),
                    ]
                        .span(),
                },
            ]
                .span(),
        );
        let namespace = dojo::utils::bytearray_hash(DEFAULT_NS());
        world
            .sync_perms_and_inits(
                [ContractDefTrait::new(DEFAULT_NS(), @"entry_systems").with_writer_of([namespace].span()),].span(),
            );
        world
            .write_model_test(
                @ChainConfig {
                    config_id: WORLD_CONFIG_ID,
                    admin_address: addr('admin'),
                    ledger_operator_address: operator,
                    player_registry_address: Zero::zero(),
                    vrf_provider_address: Zero::zero(),
                    agent_controller_config: AgentControllerConfig { address: Zero::zero() },
                    collectibles_cosmetics_address: Zero::zero(),
                    collectibles_timelock_address: Zero::zero(),
                    collectibles_lootchest_address: Zero::zero(),
                    collectibles_elitenft_address: Zero::zero(),
                },
            );
        let (entry_address, _) = world.dns(@"entry_systems").unwrap();
        (world, IEntrySystemsDispatcher { contract_address: entry_address }, operator)
    }

    #[test]
    fn operator_registration_is_idempotent() {
        let (world, entry, operator) = setup();
        let owner = addr('owner');
        let metadata = ('realm', 'url-a', 'url-b');
        start_cheat_caller_address(entry.contract_address, operator);

        entry.register_from_l2(GAME_ID, owner, 42, metadata);
        entry.register_from_l2(GAME_ID, owner, 42, metadata);
        stop_cheat_caller_address(entry.contract_address);

        let registration: LedgerRegistration = world.read_model((GAME_ID, owner));
        assert!(registration.registered, "registration missing");
        assert!(registration.realm_id == 42, "realm id changed");
        assert!(registration.metadata == metadata, "metadata changed");
    }

    #[test]
    #[should_panic(expected: "Eternum: conflicting ledger registration")]
    fn operator_cannot_replace_registration() {
        let (_, entry, operator) = setup();
        let owner = addr('owner');
        start_cheat_caller_address(entry.contract_address, operator);
        entry.register_from_l2(GAME_ID, owner, 42, ('realm', 'url-a', 'url-b'));
        entry.register_from_l2(GAME_ID, owner, 43, ('realm', 'url-a', 'url-b'));
    }

    #[test]
    #[should_panic(expected: "Eternum: caller is not the ledger operator")]
    fn non_operator_cannot_register() {
        let (_, entry, _) = setup();
        start_cheat_caller_address(entry.contract_address, addr('attacker'));
        entry.register_from_l2(GAME_ID, addr('owner'), 42, ('realm', 'url-a', 'url-b'));
    }
}
