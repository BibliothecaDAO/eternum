use starknet_crypto::{Felt, poseidon_hash_many};

fn draw(seed: u128, salt: u128, bound: u128) -> u128 {
    poseidon_hash_many(&[Felt::from(seed), Felt::ZERO, Felt::from(salt)])
        .to_bytes_be()
        .iter()
        .fold(0, |rest, byte| (rest * 256 + u128::from(*byte)) % bound)
}
fn lottery(seed: u128, offset: u128, bound: u128) -> u128 {
    draw(
        if seed > offset {
            seed - offset
        } else {
            seed + offset
        },
        18,
        bound,
    )
}
fn main() {
    let mut mine = None;
    let mut camp = None;
    let mut edge = None;
    let mut btc_win = None;
    let mut btc_edge = None;
    for seed in 0..5_000_000u128 {
        let m = lottery(seed, 2, 50000);
        if mine.is_none() && m == 299 {
            mine = Some(seed);
        }
        if camp.is_none() && m >= 1000 && lottery(seed, 7, 50000) == 299 {
            camp = Some(seed);
        }
        if edge.is_none() && m == 1000 && lottery(seed, 7, 50000) < 1500 {
            edge = Some((seed, lottery(seed, 7, 50000)));
        }
        if btc_win.is_none() && lottery(seed, 10, 10000) == 199 {
            btc_win = Some(seed);
        }
        if btc_edge.is_none() && lottery(seed, 10, 10000) == 200 {
            btc_edge = Some(seed);
        }
        if mine.is_some()
            && camp.is_some()
            && edge.is_some()
            && btc_win.is_some()
            && btc_edge.is_some()
        {
            break;
        }
    }
    println!(
        "{{\"mine299\":{},\"camp299\":{},\"mineBoundary\":{},\"campAtBoundary\":{},\"bitcoin199\":{},\"bitcoin200\":{}}}",
        mine.unwrap(),
        camp.unwrap(),
        edge.unwrap().0,
        edge.unwrap().1,
        btc_win.unwrap(),
        btc_edge.unwrap()
    );
    let weights: Vec<u128> = (0..18)
        .map(|i| match i {
            14 | 15 => 0,
            16 => 600,
            17 => 200,
            _ => {
                if i % 2 == 0 {
                    750
                } else {
                    400
                }
            }
        })
        .collect();
    let total: u128 = weights.iter().sum();
    let relics: Vec<usize> = (1..=6)
        .map(|i| {
            let roll = draw(12345, i * 18, total);
            let mut cumulative = 0;
            weights
                .iter()
                .position(|weight| {
                    cumulative += weight;
                    roll < cumulative
                })
                .unwrap()
                + 39
        })
        .collect();
    let mut salt = 0;
    let mut chosen = Vec::new();
    while chosen.len() < 3 {
        salt += 18;
        let direction = draw(321 - 12, salt, 6);
        if !chosen.contains(&direction) {
            chosen.push(direction);
        }
    }
    println!(
        "{{\"relics\":{:?},\"chestDirections\":{:?}}}",
        relics, chosen
    );
    let mut discovery = [0u32; 7];
    let mut doubled = 0u32;
    let mut essence = 0u32;
    for sample in 0..100000u128 {
        let roll = draw(0x46524f4e54494552 + sample, 29, 10000);
        let thresholds = [600, 1000, 1400, 1500, 1800, 2100, 10000];
        discovery[thresholds
            .iter()
            .position(|threshold| roll < *threshold)
            .unwrap()] += 1;
        if draw(0x5354524147474c455253 + sample, 29, 10000) < 1200 {
            doubled += 1;
        }
        if sample < 10000 && draw(0x46524f4e54494552 + sample, 18, 2) == 0 {
            essence += 1;
        }
    }
    println!(
        "{{\"discoveryCounts\":{:?},\"doubledStragglers\":{},\"essenceOf10000\":{}}}",
        discovery, doubled, essence
    );
}
