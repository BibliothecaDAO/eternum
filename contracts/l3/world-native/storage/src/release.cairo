use core::num::traits::Zero;
use starknet::ClassHash;

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct LogicClasses {
    pub season: ClassHash,
    pub map: ClassHash,
    pub placement: ClassHash,
    pub construction: ClassHash,
    pub production: ClassHash,
    pub structures: ClassHash,
    pub troops: ClassHash,
    pub settlement: ClassHash,
    pub resources: ClassHash,
    pub economy: ClassHash,
    pub prizes: ClassHash,
    pub registry: ClassHash,
    pub combat: ClassHash,
    pub raid: ClassHash,
    pub bridge: ClassHash,
    pub relics: ClassHash,
}

pub fn validate(classes: LogicClasses) {
    for class_hash in array![
        classes.season, classes.map, classes.placement, classes.construction, classes.production, classes.structures,
        classes.troops, classes.settlement, classes.resources, classes.economy, classes.prizes, classes.registry,
        classes.combat, classes.raid, classes.bridge, classes.relics,
    ] {
        assert!(class_hash.is_non_zero(), "missing logic class");
    }
}
