//! A fake world for testing the world factory.

use snforge_std::{DeclareResultTrait, declare};
use starknet::ClassHash;
use world_factory::factory_models::{FactoryConfigContract, FactoryConfigLibrary};

#[dojo::model]
pub struct ModelA {
    #[key]
    pub key: u32,
    pub value: felt252,
}

#[starknet::interface]
pub trait IMyContract<T> {
    fn set_model_a(ref self: T, key: u32, value: felt252);
}

#[dojo::contract]
pub mod my_contract {
    use dojo::model::ModelStorage;
    use super::{IMyContract, ModelA};

    #[abi(embed_v0)]
    impl IMyContractImpl of IMyContract<ContractState> {
        fn set_model_a(ref self: ContractState, key: u32, value: felt252) {
            let mut world = self.world_default();
            let mut model: ModelA = world.read_model(key);
            model.value = value;
            world.write_model(@model);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"ns")
        }
    }
}

#[derive(Debug, Drop)]
pub struct FakeWorldResources {
    pub models: Array<ClassHash>,
    pub contracts: Array<FactoryConfigContract>,
    pub events: Array<ClassHash>,
    pub libraries: Array<FactoryConfigLibrary>,
}

pub fn declare_fake_world() -> FakeWorldResources {
    let model_contract = declare("m_ModelA").unwrap().contract_class();
    let my_contract_contract = declare("my_contract").unwrap().contract_class();
    let fake_library_contract = declare("fake_library").unwrap().contract_class();

    FakeWorldResources {
        models: array![*model_contract.class_hash],
        contracts: array![
            FactoryConfigContract {
                selector: selector_from_tag!("ns-my_contract"),
                class_hash: *my_contract_contract.class_hash,
                init_args: array![].span(),
                writer_of_resources: array![].span(),
                owner_of_resources: array![].span(),
            },
        ],
        events: array![],
        libraries: array![
            FactoryConfigLibrary {
                class_hash: *fake_library_contract.class_hash,
                name: "fake_library",
                version: "1_0_0",
            },
        ],
    }
}
