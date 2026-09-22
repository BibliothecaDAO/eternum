#[starknet::storage_node]
pub struct LifecycleStorage<TDomainState> {
    pub state: TDomainState,
}
