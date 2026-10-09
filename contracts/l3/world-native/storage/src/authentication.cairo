
#[starknet::storage_node]
pub struct AuthenticationStorage<TAuthentication> {
    pub authentication: TAuthentication,
}
