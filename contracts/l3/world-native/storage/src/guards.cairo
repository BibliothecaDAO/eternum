use starknet::storage::Map;

#[starknet::storage_node]
pub struct GuardStateStorage<TGuard> {
    pub guards: Map<(u32, u64, u8), TGuard>,
}
