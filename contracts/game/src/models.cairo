pub mod config;
pub mod event;
pub mod guild;
pub mod hyperstructure;
pub mod map;
pub mod message;
pub mod name;
pub mod owner;
pub mod position;
pub mod quantity;
pub mod realm;
pub mod season;
pub mod stamina;
pub mod structure;
pub mod trade;
pub mod troop;
pub mod village;
pub mod weight;
pub mod bank {
    pub mod liquidity;
    pub mod market;
}

pub mod resource {
    pub mod arrivals;
    pub mod resource;
    pub mod production {
        pub mod building;
        pub mod production;
    }
}
