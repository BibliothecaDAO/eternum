use starknet::ContractAddress;
use eternum::components::ComponentExistsTrait;

// contract address owning an entity
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Owner {
    #[key]
    entity_id: u128,
    address: ContractAddress,
}

impl OwnerExistsImpl of ComponentExistsTrait<Owner> {
    fn exists(self: Owner) -> bool {
        self.entity_id != 0_u128
    }
}

