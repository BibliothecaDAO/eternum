// Rank one receives N shares, rank N one share. Rounding stays with first place.
pub fn prize_amount(pool: u128, count: u16, rank: u16) -> u128 {
    assert!(count > 0 && count <= 100 && rank > 0 && rank <= count, "invalid prize rank");
    let n: u128 = count.into();
    let shares = n * (n + 1) / 2;
    if rank > 1 {
        return (Into::<u128, u256>::into(pool) * (n + 1 - Into::<u16, u128>::into(rank)).into() / shares.into())
            .try_into()
            .unwrap();
    }
    let mut first = pool;
    for position in 2..count + 1 {
        first -= (Into::<u128, u256>::into(pool) * (n + 1 - Into::<u16, u128>::into(position)).into() / shares.into())
            .try_into()
            .unwrap();
    }
    first
}
