#[system]
mod HarvestLabor {
    use traits::Into;
    use array::ArrayTrait;
    use box::BoxTrait;
    use traits::TryInto;
    use debug::PrintTrait;
    use integer::u128_safe_divmod;

    use eternum::components::config::WorldConfig;
    use eternum::components::owner::Owner;
    use eternum::components::realm::Realm;
    use eternum::components::realm::RealmTrait;
    use eternum::components::resources::Resource;
    use eternum::components::resources::Vault;
    use eternum::components::labor::Labor;
    use eternum::components::labor::LaborTrait;
    use eternum::components::config::LaborConf;
    use starknet::ContractAddress;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::constants::ResourceIds;

    fn execute(realm_id: felt252, resource_id: u8) {
        let player_id: ContractAddress = starknet::get_tx_info().unbox().account_contract_address;
        let (realm, owner) = commands::<Realm, Owner>::entity(realm_id.into());

        // TODO: do that when starknet::testing::set_account_contract_address works in test
        // assert(owner.address == player_id, 'Realm does not belong to player');

        // check that resource is on realm
        let realm_has_resource = realm.has_resource(resource_id);
        let is_food = resource_id == ResourceIds::FISH
            | resource_id == ResourceIds::WHEAT;
        if realm_has_resource == false {
            assert(is_food == true, 'Resource is not on realm');
        }

        // Get Config
        let labor_config: LaborConf = commands::<LaborConf>::entity(LABOR_CONFIG_ID.into());

        let resource_id_felt: felt252 = resource_id.into();
        let resource_query: Query = (realm_id, resource_id_felt).into();
        let maybe_labor = commands::<Labor>::try_entity(resource_query);
        let labor = match maybe_labor {
            Option::Some(labor) => labor,
            Option::None(_) => Labor { balance: 0, last_harvest: 0, multiplier: 1,  }
        };
        let maybe_resource = commands::<Resource>::try_entity(resource_query);
        let resource = match maybe_resource {
            Option::Some(resource) => resource,
            Option::None(_) => Resource { id: resource_id, balance: 0,  }
        };

        // transform timestamp from u64 to u128
        let ts: u128 = starknet::get_block_timestamp().into();

        // generated labor
        let (labor_generated, _, _) = labor.get_labor_generated(ts);

        // assert base labor units not zero
        assert(labor_config.base_labor_units != 0, 'Base labor units cannot be zero');

        // labor units and part units
        let mut labor_units_generated = labor_generated / labor_config.base_labor_units;
        let rest = labor_generated % labor_config.base_labor_units;

        // get vault for that resource
        let maybe_vault = commands::<Vault>::try_entity(resource_query);
        let vault = match maybe_vault {
            Option::Some(vault) => {
                vault
            },
            Option::None(_) => {
                Vault { balance: 0 }
            },
        };

        if resource_id != ResourceIds::FISH
            & resource_id != ResourceIds::WHEAT {
                // remove 25% to the vault
                let vault_units_generated = (labor_units_generated * labor_config.vault_percentage)
                    / 1000;
                labor_units_generated = labor_units_generated - vault_units_generated;

                // the balance in the vault is in cycles so need to multiply by base resource per cycle
                // update the vault
                commands::set_entity(
                    resource_query,
                    (Vault { balance: vault.balance + vault_units_generated }, )
                );
            }

        // update the labor and resources
        commands::set_entity(
            resource_query,
            (
                Resource {
                    id: resource_id,
                    balance: resource.balance
                        + labor_units_generated * labor_config.base_resources_per_cycle
                    }, Labor {
                    balance: labor.balance + rest, last_harvest: ts, multiplier: labor.multiplier, 
                }
            )
        );
    }
}

mod tests {
    // components
    use eternum::components::owner::OwnerComponent;
    use eternum::components::labor::LaborComponent;
    use eternum::components::realm::RealmComponent;
    use eternum::components::config::LaborConfComponent;
    use eternum::components::config::LaborCVComponent;
    use eternum::components::config::LaborCRComponent;
    use eternum::components::resources::ResourceComponent;
    use eternum::components::resources::VaultComponent;
    use eternum::components::realm::Realm;
    use eternum::components::config::LaborConf;
    use eternum::components::config::LaborCR;
    use eternum::components::config::LaborCV;

    // systems
    use eternum::systems::labor::build_labor::BuildLaborSystem;
    use eternum::systems::labor::harvest_labor::HarvestLaborSystem;
    use eternum::systems::config::labor_config::CreateLaborConfSystem;
    use eternum::systems::config::labor_config::CreateLaborCRSystem;
    use eternum::systems::config::labor_config::CreateLaborCVSystem;
    use eternum::systems::test::CreateRealmSystem;
    use eternum::systems::test::MintResourcesSystem;

    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::constants::ResourceIds;

    use core::traits::Into;
    use core::result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use traits::TryInto;
    use debug::PrintTrait;

    use starknet::syscalls::deploy_syscall;
    use starknet::class_hash::Felt252TryIntoClassHash;
    use starknet::ClassHash;

    use dojo_core::world::World;
    use dojo_core::executor::Executor;
    use dojo_core::interfaces::IExecutorDispatcher;
    use dojo_core::interfaces::IExecutorDispatcherTrait;
    use dojo_core::interfaces::IWorldDispatcher;
    use dojo_core::interfaces::IWorldDispatcherTrait;
    use dojo_core::storage::query::Query;
    use dojo_core::test_utils::spawn_test_world;

    #[test]
    #[available_gas(30000000)]
    fn test_harvest_labor_non_food() {
        /// REGISTER COMPONENTS ///
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(LaborComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(LaborConfComponent::TEST_CLASS_HASH);
        components.append(LaborCVComponent::TEST_CLASS_HASH);
        components.append(LaborCRComponent::TEST_CLASS_HASH);
        components.append(ResourceComponent::TEST_CLASS_HASH);
        components.append(VaultComponent::TEST_CLASS_HASH);
        components.append(OwnerComponent::TEST_CLASS_HASH);

        /// REGISTER SYSTEMS ///
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(BuildLaborSystem::TEST_CLASS_HASH);
        systems.append(HarvestLaborSystem::TEST_CLASS_HASH);
        systems.append(CreateRealmSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborConfSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborCRSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborCVSystem::TEST_CLASS_HASH);
        systems.append(MintResourcesSystem::TEST_CLASS_HASH);

        let world = spawn_test_world(components, systems);

        /// CREATE ENTITIES ///
        // set realm entity
        let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
        create_realm_calldata.append(1);
        create_realm_calldata.append(starknet::get_caller_address().into());
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        world.execute('CreateRealm'.into(), create_realm_calldata.span());

        // set labor configuration entity
        let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_conf_calldata.append(7200);
        create_labor_conf_calldata.append(250);
        create_labor_conf_calldata.append(21000000000000000000);
        world.execute('CreateLaborConf'.into(), create_labor_conf_calldata.span());

        let mut creat_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
        creat_labor_cr_calldata.append(1);
        creat_labor_cr_calldata.append(1);
        creat_labor_cr_calldata.append(1);
        world.execute('CreateLaborCR'.into(), creat_labor_cr_calldata.span());

        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(1000);
        world.execute('CreateLaborCV'.into(), create_labor_cv_calldata.span());

        // mint 100000 resource id 1 for realm id 1;
        let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
        mint_resources_calldata.append(1);
        mint_resources_calldata.append(1);
        mint_resources_calldata.append(100000);
        world.execute('MintResources'.into(), mint_resources_calldata.span());

        // set block timestamp in order to harvest labor
        // initial ts = 0
        starknet::testing::set_block_timestamp(1000);

        // call build labor system
        let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
        build_labor_calldata.append(1);
        build_labor_calldata.append(1);
        build_labor_calldata.append(20);
        // multiplier
        build_labor_calldata.append(1);
        world.execute('BuildLabor'.into(), build_labor_calldata.span());

        // set block timestamp in order to harvest labor
        // initial ts = 0
        starknet::testing::set_block_timestamp(40000);

        // call build labor system
        let mut harvest_labor_calldata = array::ArrayTrait::<felt252>::new();
        // realm_id
        harvest_labor_calldata.append(1);
        // resource_id
        harvest_labor_calldata.append(1);
        world.execute('HarvestLabor'.into(), harvest_labor_calldata.span());

        // get labor after harvest 
        let labor_after_harvest = world.entity('Labor'.into(), (1, (1)).into(), 0_u8, 0_usize);
        // labor after harvest = current labor balance + rest from division by 72000
        assert(*labor_after_harvest[0] == 145000 + 3000, 'wrong labor balance');
        assert(*labor_after_harvest[1] == 40000, 'wrong last harvest');

        let last_harvest = 1000_u128;
        let current_ts = 40000_u128;
        let labor_per_unit = 7200_u128;
        let base_resources_per_cycle = 21000000000000000000_u128;
        let vault_percentage = 250; // on base 1000
        let resource_balance_before_harvest = 80000_u128;

        // because current_ts < balance
        let generated_labor = current_ts - last_harvest;

        // generated units
        let mut generated_units = generated_labor / labor_per_unit;
        // vault units
        let vault_units = generated_units * vault_percentage / 1000;
        generated_units -= vault_units;

        let generated_resources = generated_units * base_resources_per_cycle;

        // verify resource is right amount
        let resource = world.entity('Resource'.into(), (1, (1)).into(), 0_u8, 0_usize);
        assert(
            *resource[1] == (resource_balance_before_harvest + generated_resources).into(),
            'failed resource amount'
        );

        // verify vault balance 
        let vault = world.entity('Vault'.into(), (1, (1)).into(), 0_u8, 0_usize);
        assert(*vault[0] == 1, 'failed vault balance');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_harvest_labor_food() {
        /// REGISTER COMPONENTS ///
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(LaborComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(LaborConfComponent::TEST_CLASS_HASH);
        components.append(LaborCVComponent::TEST_CLASS_HASH);
        components.append(LaborCRComponent::TEST_CLASS_HASH);
        components.append(ResourceComponent::TEST_CLASS_HASH);
        components.append(VaultComponent::TEST_CLASS_HASH);
        components.append(OwnerComponent::TEST_CLASS_HASH);

        /// REGISTER SYSTEMS ///
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(BuildLaborSystem::TEST_CLASS_HASH);
        systems.append(HarvestLaborSystem::TEST_CLASS_HASH);
        systems.append(CreateRealmSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborConfSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborCRSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborCVSystem::TEST_CLASS_HASH);
        systems.append(MintResourcesSystem::TEST_CLASS_HASH);

        let world = spawn_test_world(components, systems);

        /// CREATE ENTITIES ///
        // set realm entity
        let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
        create_realm_calldata.append(1);
        create_realm_calldata.append(starknet::get_caller_address().into());
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        world.execute('CreateRealm'.into(), create_realm_calldata.span());

        // set labor configuration entity
        let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_conf_calldata.append(7200);
        create_labor_conf_calldata.append(250);
        create_labor_conf_calldata.append(21000000000000000000);
        world.execute('CreateLaborConf'.into(), create_labor_conf_calldata.span());

        let mut creat_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
        creat_labor_cr_calldata.append(ResourceIds::WHEAT.into());
        creat_labor_cr_calldata.append(1);
        creat_labor_cr_calldata.append(1);
        world.execute('CreateLaborCR'.into(), creat_labor_cr_calldata.span());

        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(ResourceIds::WHEAT.into());
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(1000);
        world.execute('CreateLaborCV'.into(), create_labor_cv_calldata.span());

        // mint 100000 resource id 1 for realm id 1;
        let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
        mint_resources_calldata.append(1);
        mint_resources_calldata.append(1);
        mint_resources_calldata.append(100000);
        world.execute('MintResources'.into(), mint_resources_calldata.span());

        // set block timestamp in order to harvest labor
        // initial ts = 0
        starknet::testing::set_block_timestamp(1000);

        // call build labor system
        let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
        build_labor_calldata.append(1);
        build_labor_calldata.append(ResourceIds::WHEAT.into());
        build_labor_calldata.append(20);
        // multiplier
        build_labor_calldata.append(1);
        world.execute('BuildLabor'.into(), build_labor_calldata.span());

        // set block timestamp in order to harvest labor
        // initial ts = 0
        starknet::testing::set_block_timestamp(40000);

        // call build labor system
        let mut harvest_labor_calldata = array::ArrayTrait::<felt252>::new();
        // realm_id
        harvest_labor_calldata.append(1);
        // resource_id
        harvest_labor_calldata.append(ResourceIds::WHEAT.into());
        world.execute('HarvestLabor'.into(), harvest_labor_calldata.span());

        let wheat_felt: felt252 = ResourceIds::WHEAT.into();
        let wheat_query: Query = (1, wheat_felt).into();
        // get labor after harvest 
        let labor_after_harvest = world.entity(
            'Labor'.into(), wheat_query, 0_u8, 0_usize
        );
        // labor after harvest = current labor balance + rest from division by 72000
        assert(*labor_after_harvest[0] == 145000 + 3000, 'wrong labor balance');
        assert(*labor_after_harvest[1] == 40000, 'wrong last harvest');

        let last_harvest = 1000_u128;
        let current_ts = 40000_u128;
        let labor_per_unit = 7200_u128;
        let base_resources_per_cycle = 21000000000000000000_u128;

        // because current_ts < balance
        let generated_labor = current_ts - last_harvest;

        // generated units
        let mut generated_units = generated_labor / labor_per_unit;

        let generated_resources = generated_units * base_resources_per_cycle;

        // verify resource is right amount
        let resource = world.entity(
            'Resource'.into(), wheat_query, 0_u8, 0_usize
        );
        assert(*resource[1] == generated_resources.into(), 'failed resource amount');
    }
}
