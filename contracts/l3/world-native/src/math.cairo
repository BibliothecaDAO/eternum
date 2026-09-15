pub trait PercentageTrait<T> {
    fn get(value: T, numerator: u64) -> T;
}

pub impl PercentageImpl<T, +Mul<T>, +Div<T>, +Into<u64, T>, +Copy<T>, +Drop<T>> of PercentageTrait<T> {
    fn get(value: T, numerator: u64) -> T {
        return (value * numerator.into()) / PercentageValueImpl::_100().into();
    }
}

#[generate_trait]
pub impl PercentageValueImpl of PercentageValueTrait {
    fn _1() -> u64 {
        100
    }

    fn _100() -> u64 {
        10_000
    }
}
