use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::resources::ResourceAmount;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettleVillage {
    pub pass_id: u16,
    pub connected_realm_entity_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct VillageResource {
    pub resource_type: u8,
    pub weight: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct VillageRules {
    pub troop_delay_ticks: u16,
    pub resources: Span<ResourceAmount>,
    pub resource_pool: Span<VillageResource>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct VillagePassKey {
    pub game_id: u32,
    pub pass_id: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct VillagePass {
    pub owner: ContractAddress,
    pub village_id: u32,
}

#[starknet::interface]
pub trait IVillages<T> {
    fn configure_villages(ref self: T, game_id: u32, rules: VillageRules);
    fn village_rules(self: @T, game_id: u32) -> VillageRules;
    fn register_village_pass(ref self: T, key: VillagePassKey, owner: ContractAddress);
    fn village_pass(self: @T, key: VillagePassKey) -> Option<VillagePass>;
    fn settle_village(
        ref self: T, game_id: u32, actor: ContractAddress, command: SettleVillage, context: ExecutionContext,
    );
}

#[starknet::interface]
pub trait IVillageArmy<T> {
    fn receive_village_army(
        ref self: T, game_id: u32, actor: ContractAddress, village_id: u32, context: ExecutionContext,
    );
}

pub fn select_resource(pool: Span<VillageResource>, seed: u256, timestamp: u64) -> u8 {
    assert!(pool.len() == 22, "incomplete village resource pool");
    let mut total = 0_u128;
    for choice in pool {
        total += *choice.weight;
    }
    assert!(total > 0, "empty village resource pool");
    let draw = crate::random::range(seed, timestamp.into() + 18, total);
    let mut cumulative = 0;
    for choice in pool {
        cumulative += *choice.weight;
        if draw < cumulative {
            return *choice.resource_type;
        }
    }
    panic!("village resource draw outside pool")
}

#[starknet::component]
pub mod VillageState {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::resources::ResourceAmount;
    use super::{VillagePass, VillagePassKey, VillageResource, VillageRules};

    #[storage]
    pub struct Storage {
        #[flat]
        pub data: games_storage::village::VillageStateStorage<ResourceAmount, VillageResource, VillagePass>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn configure(ref self: ComponentState<TContractState>, game_id: u32, rules: VillageRules) {
            assert!(self.data.village_delay.read(game_id).is_none(), "immutable village rules");
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
                self.data.village_pool.write((game_id, index), choice);
            }
            assert!(total > 0, "empty village resource pool");
            self.data.village_delay.write(game_id, Some(rules.troop_delay_ticks));
            self.data.village_grant_count.write(game_id, rules.resources.len());
            for index in 0..rules.resources.len() {
                self.data.village_grants.write((game_id, index), *rules.resources.at(index));
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
            let troop_delay_ticks = self.data.village_delay.read(game_id).expect('missing village rules');
            let mut resources = array![];
            for index in 0..self.data.village_grant_count.read(game_id) {
                resources.append(self.data.village_grants.read((game_id, index)));
            }
            let mut resource_pool = array![];
            for index in 0..22_u8 {
                resource_pool.append(self.data.village_pool.read((game_id, index)));
            }
            VillageRules { troop_delay_ticks, resources: resources.span(), resource_pool: resource_pool.span() }
        }
        fn pass(self: @ComponentState<TContractState>, key: VillagePassKey) -> Option<VillagePass> {
            self.data.village_passes.read((key.game_id, key.pass_id))
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
            self.data.village_passes.write((key.game_id, key.pass_id), Some(pass));
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
