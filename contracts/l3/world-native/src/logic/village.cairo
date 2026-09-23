use starknet::storage::StorageMapReadAccess;
use crate::village::*;

pub fn rules(game_id: u32) -> VillageRules {
    let troop_delay_ticks = crate::state::read().village.village_delay.read(game_id).expect('missing village rules');
    let mut resources = array![];
    for index in 0..crate::state::read().village.village_grant_count.read(game_id) {
        resources.append(crate::state::read().village.village_grants.read((game_id, index)));
    }
    let mut resource_pool = array![];
    for index in 0..22_u8 {
        resource_pool.append(crate::state::read().village.village_pool.read((game_id, index)));
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
        fn configure(ref self: ComponentState<TContractState>, game_id: u32, rules: VillageRules) {
            assert!(self.data.village.village_delay.read(game_id).is_none(), "immutable village rules");
            assert!(rules.resource_pool.len() == 22, "incomplete village resource pool");
            let mut total = 0_u128;
            let mut seen = 0_u32;
            for index in 0..22_u8 {
                let choice = *rules.resource_pool.at(index.into());
                assert!(
                    choice.weight > 0 && choice.resource_type > 0 && choice.resource_type <= 22,
                    "invalid village resource outcome",
                );
                let mut bit = 1_u32;
                for _ in 0..choice.resource_type {
                    bit *= 2;
                }
                assert!((seen & bit) == 0, "duplicate village resource outcome");
                seen = seen | bit;
                total += choice.weight;
                self.data.village.village_pool.write((game_id, index), choice);
            }
            assert!(total > 0, "empty village resource pool");
            self.data.village.village_delay.write(game_id, Some(rules.troop_delay_ticks));
            self.data.village.village_grant_count.write(game_id, rules.resources.len());
            for index in 0..rules.resources.len() {
                self.data.village.village_grants.write((game_id, index), *rules.resources.at(index));
            }
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'VillageRules', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
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
