pub fn validate(orders: Span<u8>) {
    if orders.is_empty() {
        return;
    }
    assert!(orders.len() == 16, "Aspects need every Order");
    for aspect in 1_u8..5 {
        let mut members = 0_u8;
        for order in orders {
            assert!(*order >= 1 && *order <= 4, "invalid Aspect");
            if *order == aspect {
                members += 1;
            }
        }
        assert!(members == 4, "Aspect needs four Orders");
    }
}

pub fn pack(orders: Span<u8>) -> Option<u128> {
    validate(orders);
    if orders.is_empty() {
        return None;
    }
    let mut packed = 0_u128;
    for index in 0..16 {
        packed = packed * 256 + Into::<u8, u128>::into(*orders.at(15 - index));
    }
    Some(packed)
}

pub fn order_aspect(mut packed: u128, order: u8) -> u8 {
    assert!(order >= 1 && order <= 16, "invalid Order");
    for _ in 1..order {
        packed /= 256;
    }
    (packed % 256).try_into().unwrap()
}
