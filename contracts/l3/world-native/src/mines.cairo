#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MineKindKey {
    pub game_id: u32,
    pub kind: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MinePoolKey {
    pub game_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct MineKindConfig {
    pub resource_type: u8,
    pub building_category: u8,
    pub production_rate: u64,
    pub cap_min: u128,
    pub cap_steps: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MineKindEntry {
    pub kind: u8,
    pub config: MineKindConfig,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct MineWeight {
    pub kind: u8,
    pub weight: u32,
}

#[starknet::interface]
pub trait IMineRules<T> {
    #[cfg(test)]
    fn mine_kind(self: @T, key: MineKindKey) -> MineKindConfig;
    #[cfg(test)]
    fn mine_pool(self: @T, key: MinePoolKey) -> Span<MineWeight>;
    fn mine_draw(self: @T, key: MinePoolKey, seed: u256) -> (u8, MineKindConfig, u128);
}

pub fn select_kind(weights: Span<MineWeight>, seed: u256) -> u8 {
    let mut total = 0_u128;
    for entry in weights {
        total += Into::<u32, u128>::into(*entry.weight);
    }
    assert!(total != 0, "mine discovery pool is empty");
    let mut roll = crate::random::range(seed, 'MINE_KIND', total);
    for entry in weights {
        let weight: u128 = (*entry.weight).into();
        if roll < weight {
            return *entry.kind;
        }
        roll -= weight;
    }
    panic!("invalid mine pool");
}

pub fn cap(config: MineKindConfig, seed: u256) -> u128 {
    config.cap_min * (1 + crate::random::range(seed, 124, config.cap_steps.into()))
}
