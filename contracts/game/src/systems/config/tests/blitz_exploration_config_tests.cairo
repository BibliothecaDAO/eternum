#[cfg(test)]
mod tests {
    use dojo::world::WorldStorageTrait;
    use dojo_snf_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };
    use snforge_std::{start_cheat_caller_address, start_cheat_chain_id_global};
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
    use crate::systems::config::contracts::{
        IBlitzExplorationConfigDispatcher, IBlitzExplorationConfigDispatcherTrait, IWorldConfigDispatcher,
        IWorldConfigDispatcherTrait,
    };

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [TestResource::Model("WorldConfig"), TestResource::Contract("config_systems")].span(),
        }
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"config_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    fn setup() -> IBlitzExplorationConfigDispatcher {
        start_cheat_chain_id_global('SN_TEST');

        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());

        let (config_systems_address, _) = world.dns(@"config_systems").unwrap();
        let admin = starknet::contract_address_const::<'admin'>();
        start_cheat_caller_address(config_systems_address, admin);

        let world_config_dispatcher = IWorldConfigDispatcher { contract_address: config_systems_address };
        world_config_dispatcher.set_world_config(admin);

        IBlitzExplorationConfigDispatcher { contract_address: config_systems_address }
    }

    #[test]
    #[should_panic]
    fn rejects_unknown_blitz_exploration_profile_ids() {
        let dispatcher = setup();

        dispatcher.set_blitz_exploration_config(7);
    }
}
