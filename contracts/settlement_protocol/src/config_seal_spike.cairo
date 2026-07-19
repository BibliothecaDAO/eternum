use core::poseidon::poseidon_hash_span;
use crate::config_setter_vectors::config_setter_selectors;

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum ConfigSealError {
    Unauthorized,
    UnknownSetter,
    Sealed,
    AlreadySealed,
}

#[derive(Copy, Drop, Debug, PartialEq)]
pub struct ConfigSealState {
    pub admin: felt252,
    pub sealed: bool,
    pub config_hash: felt252,
    pub sealed_config_hash: felt252,
    pub mutation_count: u64,
}

pub trait ConfigSealStateTrait {
    fn apply_setter(
        self: ConfigSealState, caller: felt252, selector: felt252, value_hash: felt252,
    ) -> Result<ConfigSealState, ConfigSealError>;
    fn seal(self: ConfigSealState, caller: felt252) -> Result<ConfigSealState, ConfigSealError>;
}

pub impl ConfigSealStateImpl of ConfigSealStateTrait {
    fn apply_setter(
        self: ConfigSealState, caller: felt252, selector: felt252, value_hash: felt252,
    ) -> Result<ConfigSealState, ConfigSealError> {
        if self.sealed {
            return Err(ConfigSealError::Sealed);
        }
        if caller != self.admin {
            return Err(ConfigSealError::Unauthorized);
        }
        if !is_known_setter(selector) {
            return Err(ConfigSealError::UnknownSetter);
        }

        Ok(
            ConfigSealState {
                config_hash: hash_config_mutation(self.config_hash, selector, value_hash),
                mutation_count: self.mutation_count + 1,
                ..self,
            },
        )
    }

    fn seal(self: ConfigSealState, caller: felt252) -> Result<ConfigSealState, ConfigSealError> {
        if self.sealed {
            return Err(ConfigSealError::AlreadySealed);
        }
        if caller != self.admin {
            return Err(ConfigSealError::Unauthorized);
        }

        Ok(ConfigSealState { admin: 0, sealed: true, sealed_config_hash: self.config_hash, ..self })
    }
}

pub fn new_config_seal_state(admin: felt252) -> ConfigSealState {
    assert!(admin != 0, "ZERO_ADMIN");
    ConfigSealState { admin, sealed: false, config_hash: 0, sealed_config_hash: 0, mutation_count: 0 }
}

fn is_known_setter(selector: felt252) -> bool {
    for known_selector in config_setter_selectors().span() {
        if selector == *known_selector {
            return true;
        }
    }
    false
}

fn hash_config_mutation(previous_hash: felt252, selector: felt252, value_hash: felt252) -> felt252 {
    poseidon_hash_span(array!['CONFIG_SETTER_MUTATION_V0', previous_hash, selector, value_hash].span())
}
