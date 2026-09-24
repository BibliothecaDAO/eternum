use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use crate::village::*;

pub fn rules(game_id: u32) -> VillageRules {
    let preset = crate::logic::preset_record::for_game(game_id);
    let troop_delay_ticks = preset.village_delay.read();
    let mut resources = array![];
    for index in 0..preset.village_grant_count.read() {
        resources.append(preset.village_grants.read(index));
    }
    let mut resource_pool = array![];
    for index in 0..22_u8 {
        resource_pool.append(preset.village_pool.read(index));
    }
    VillageRules { troop_delay_ticks, resources: resources.span(), resource_pool: resource_pool.span() }
}
#[starknet::component]
pub mod VillageState {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::village::{VillagePass, VillagePassKey, VillageRules};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> VillageRules {
            crate::logic::village::rules(game_id)
        }
        fn pass(self: @ComponentState<TContractState>, key: VillagePassKey) -> Option<VillagePass> {
            self.data.village.village_passes.read((key.game_id, key.pass_id))
        }
        fn register(ref self: ComponentState<TContractState>, key: VillagePassKey, owner: ContractAddress) {
            assert!(owner != 0.try_into().unwrap(), "empty village pass owner");
            if let Some(previous) = self.pass(key) {
                assert!(previous.owner == owner, "conflicting village pass");
                return;
            }
            self.write_pass(key, VillagePass { owner, village_id: 0 });
        }
        fn require_pass(self: @ComponentState<TContractState>, key: VillagePassKey, owner: ContractAddress) {
            let pass = self.pass(key).expect('village pass required');
            assert!(pass.owner == owner, "wallet does not own village pass");
            assert!(pass.village_id == 0, "village pass already consumed");
        }
        fn consume(
            ref self: ComponentState<TContractState>, key: VillagePassKey, owner: ContractAddress, village_id: u32,
        ) {
            self.require_pass(key, owner);
            assert!(village_id != 0, "invalid village identity");
            self.write_pass(key, VillagePass { owner, village_id });
        }
        fn write_pass(ref self: ComponentState<TContractState>, key: VillagePassKey, pass: VillagePass) {
            self.data.village.village_passes.write((key.game_id, key.pass_id), Some(pass));
            let mut values = array![];
            pass.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'VillagePass',
                        keys: array![key.game_id.into(), key.pass_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
