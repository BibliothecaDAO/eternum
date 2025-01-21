// copy pasta from https://github.com/gizatechxyz/orion/tree/main/src/operators

pub trait NumberTrait<T, MAG> {
    fn abs(self: T) -> T;
}


pub impl i128Number of NumberTrait<i128, i128> {
    fn abs(self: i128) -> i128 {
        if self >= 0 {
            return self;
        } else {
            self * -1_i128
        }
    }
}
