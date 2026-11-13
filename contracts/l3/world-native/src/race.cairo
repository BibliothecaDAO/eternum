// Largest remainders allocate the indivisible units; home identity breaks an exact tie.
pub fn split_payment(amount: u128, shares: Span<crate::deep::DeepShare>) -> Span<u128> {
    assert!(!shares.is_empty() && shares.len() <= 4, "invalid reward guard count");
    let mut total = 0_u256;
    for index in 0..shares.len() {
        let share = *shares.at(index);
        assert!(share.home != 0 && share.troops != 0, "empty reward guard");
        for previous in 0..index {
            assert!(*shares.at(previous).home != share.home, "duplicate reward home");
        }
        total += share.troops.into();
    }
    let mut allocated = 0_u128;
    let mut bases = array![];
    let mut remainders = array![];
    for share in shares {
        let weighted = Into::<u128, u256>::into(amount) * Into::<u128, u256>::into(*share.troops);
        let base: u128 = (weighted / total).try_into().unwrap();
        allocated += base;
        bases.append(base);
        remainders.append(weighted % total);
    }
    let remaining = amount - allocated;
    let mut result = array![];
    for index in 0..shares.len() {
        let remainder = *remainders.at(index);
        let home = *shares.at(index).home;
        let mut ahead = 0_u128;
        for other in 0..shares.len() {
            let other_remainder = *remainders.at(other);
            let other_home = *shares.at(other).home;
            if other_remainder > remainder || (other_remainder == remainder && other_home < home) {
                ahead += 1;
            }
        }
        result.append(*bases.at(index) + if ahead < remaining {
            1
        } else {
            0
        });
    }
    result.span()
}
